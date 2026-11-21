import type { UnlistenFn } from '@tauri-apps/api/event';
import {
	LogicalPosition,
	LogicalSize,
	availableMonitors,
	getCurrentWindow,
} from '@tauri-apps/api/window';

/**
 * Modo compacto ("minimizado" do app).
 *
 * O modo compacto transforma a janela numa barra horizontal estreita, ao invés
 * do quadrado minúsculo que cortava os botões de minimizar/restaurar/fechar do
 * Windows. A largura mínima existe justamente para esses botões continuarem
 * clicáveis.
 *
 * A posição da barra compacta é lembrada entre usos (localStorage), então o
 * usuário sempre a encontra onde a deixou — normalmente num canto onde ela não
 * atrapalha outros apps.
 */

/** Largura suficiente para os três botões da barra de título do Windows sobem
 *  até 200% de escala, e altura que deixa o botão de gravação confortável. */
const COMPACT_SIZE = { width: 360, height: 84 } as const;

const DEFAULT_FULL_SIZE = { width: 1080, height: 800 } as const;

const STORAGE_KEYS = {
	compactPosition: 'whispering-window-compact-position',
	fullState: 'whispering-window-full-state',
} as const;

type Point = { x: number; y: number };

type Rect = Point & { width: number; height: number };

type FullWindowState = Rect & { maximized: boolean };

type MonitorRect = Rect & { scaleFactor: number };

const SAVE_DEBOUNCE_MS = 400;

let mode = $state<'full' | 'compact'>('full');
let unlistenMoved: UnlistenFn | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function readJson<T>(key: string): T | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw) as T;
	} catch (error) {
		console.error(`[window-mode] falha ao ler ${key}`, error);
		return null;
	}
}

function writeJson(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (error) {
		console.error(`[window-mode] falha ao gravar ${key}`, error);
	}
}

function isFinitePoint(value: unknown): value is Point {
	return (
		typeof value === 'object' &&
		value !== null &&
		Number.isFinite((value as Point).x) &&
		Number.isFinite((value as Point).y)
	);
}

/** Mantém a janela dentro de algum monitor, mesmo que a posição salva venha de
 *  uma tela que não existe mais (monitor desconectado, resolução trocada). */
async function clampToVisibleArea(position: Point, size: { width: number; height: number }): Promise<Point> {
	const monitors = await availableMonitors();
	if (monitors.length === 0) return position;

	const rects: MonitorRect[] = monitors.map((monitor) => ({
		x: monitor.position.x / monitor.scaleFactor,
		y: monitor.position.y / monitor.scaleFactor,
		width: monitor.size.width / monitor.scaleFactor,
		height: monitor.size.height / monitor.scaleFactor,
		scaleFactor: monitor.scaleFactor,
	}));

	const containing = rects.find(
		(rect) =>
			position.x >= rect.x &&
			position.x < rect.x + rect.width &&
			position.y >= rect.y &&
			position.y < rect.y + rect.height,
	);

	const target = containing ?? rects[0];
	const margin = 8;

	const maxX = target.x + target.width - size.width - margin;
	const maxY = target.y + target.height - size.height - margin;

	return {
		x: Math.min(Math.max(position.x, target.x + margin), Math.max(target.x + margin, maxX)),
		y: Math.min(Math.max(position.y, target.y + margin), Math.max(target.y + margin, maxY)),
	};
}

async function captureFullState(): Promise<FullWindowState> {
	const window = getCurrentWindow();
	const [position, size, scaleFactor, maximized] = await Promise.all([
		window.outerPosition(),
		window.innerSize(),
		window.scaleFactor(),
		window.isMaximized(),
	]);

	return {
		x: position.x / scaleFactor,
		y: position.y / scaleFactor,
		width: size.width / scaleFactor,
		height: size.height / scaleFactor,
		maximized,
	};
}

async function rememberCompactPosition() {
	const window = getCurrentWindow();
	const [position, scaleFactor] = await Promise.all([
		window.outerPosition(),
		window.scaleFactor(),
	]);
	writeJson(STORAGE_KEYS.compactPosition, {
		x: position.x / scaleFactor,
		y: position.y / scaleFactor,
	} satisfies Point);
}

function scheduleRememberCompactPosition() {
	if (saveTimeout) clearTimeout(saveTimeout);
	saveTimeout = setTimeout(() => {
		saveTimeout = null;
		void rememberCompactPosition();
	}, SAVE_DEBOUNCE_MS);
}

async function enterCompact() {
	if (mode === 'compact') return;
	const window = getCurrentWindow();

	try {
		writeJson(STORAGE_KEYS.fullState, await captureFullState());
	} catch (error) {
		console.error('[window-mode] não consegui salvar o tamanho da janela aberta', error);
	}

	// Estado antes de mexer na janela: a UI compacta já substitui o layout
	// principal e evita um piscar do layout grande durante o redimensionamento.
	mode = 'compact';

	try {
		if (await window.isMaximized()) await window.unmaximize();
		await window.setSize(new LogicalSize(COMPACT_SIZE.width, COMPACT_SIZE.height));

		const remembered = readJson<Point>(STORAGE_KEYS.compactPosition);
		const current = await captureFullState();
		const desired = isFinitePoint(remembered) ? remembered : { x: current.x, y: current.y };
		const safe = await clampToVisibleArea(desired, COMPACT_SIZE);
		await window.setPosition(new LogicalPosition(safe.x, safe.y));

		unlistenMoved?.();
		unlistenMoved = await window.onMoved(() => scheduleRememberCompactPosition());
	} catch (error) {
		console.error('[window-mode] falha ao entrar no modo compacto', error);
	}
}

async function exitCompact() {
	if (mode === 'full') return;
	const window = getCurrentWindow();

	unlistenMoved?.();
	unlistenMoved = null;

	mode = 'full';

	try {
		const stored = readJson<FullWindowState>(STORAGE_KEYS.fullState);
		const target =
			stored && Number.isFinite(stored.width) && Number.isFinite(stored.height)
				? stored
				: {
						...DEFAULT_FULL_SIZE,
						x: 0,
						y: 0,
						maximized: false,
					};

		await window.setSize(
			new LogicalSize(
				Math.max(target.width, DEFAULT_FULL_SIZE.width / 2),
				Math.max(target.height, DEFAULT_FULL_SIZE.height / 2),
			),
		);

		if (Number.isFinite(target.x) && Number.isFinite(target.y) && (target.x !== 0 || target.y !== 0)) {
			const safe = await clampToVisibleArea({ x: target.x, y: target.y }, target);
			await window.setPosition(new LogicalPosition(safe.x, safe.y));
		}

		if (target.maximized) await window.maximize();
	} catch (error) {
		console.error('[window-mode] falha ao sair do modo compacto', error);
	}
}

async function hideToTray() {
	const window = getCurrentWindow();
	if (mode === 'compact') await rememberCompactPosition();
	await window.hide();
}

export const windowMode = {
	get current() {
		return mode;
	},
	get isCompact() {
		return mode === 'compact';
	},
	get compactSize() {
		return COMPACT_SIZE;
	},
	enterCompact: () => void enterCompact(),
	exitCompact: () => void exitCompact(),
	toggle: () => void (mode === 'compact' ? exitCompact() : enterCompact()),
	/** Esconde a janela na bandeja (usado pelo X e pelo botão da barra compacta). */
	hideToTray: () => void hideToTray(),
	/** Grava a posição atual (chamado quando o app esconde a janela na bandeja). */
	rememberCompactPosition: () => void rememberCompactPosition(),
};
