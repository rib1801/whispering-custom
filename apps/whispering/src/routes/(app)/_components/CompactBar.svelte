<script lang="ts">
	import { commandCallbacks } from '$lib/commands';
	import { Button } from '@epicenter/ui/button';
	import { rpc } from '$lib/query';
	import { windowMode } from '$lib/stores/window-mode.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import MaximizeIcon from '@lucide/svelte/icons/maximize-2';
	import MinimizeIcon from '@lucide/svelte/icons/minus';

	/**
	 * Barra compacta: substitui a janela inteira quando o usuário escolhe
	 * "Minimize". Larga o suficiente para os botões da barra de título do
	 * Windows continuarem clicáveis, e arrastável pela área do texto.
	 */

	const recorderStateQuery = createQuery(
		() => rpc.recorder.getRecorderState.options,
	);

	const isRecording = $derived(recorderStateQuery.data === 'RECORDING');
</script>

<div
	class="bg-background flex h-screen w-screen items-center gap-2 overflow-hidden pr-2 pl-2 select-none"
	data-tauri-drag-region
>
	<button
		type="button"
		onclick={() => commandCallbacks.toggleManualRecording()}
		class="hover:bg-accent flex size-10 shrink-0 items-center justify-center rounded-md text-[22px] leading-none transition-colors"
		title={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
	>
		{#if isRecording}
			⏹️
		{:else}
			🎙️
		{/if}
	</button>

	<div
		class="pointer-events-none flex min-w-0 flex-1 flex-col justify-center gap-0.5"
		data-tauri-drag-region
	>
		<span class="text-foreground truncate text-xs font-medium">
			{isRecording ? 'Gravando…' : 'Whispering'}
		</span>
		<span class="text-muted-foreground truncate text-[11px]">
			{isRecording
				? 'Clique no quadrado para parar'
				: 'Clique no microfone para gravar'}
		</span>
	</div>

	<div class="flex shrink-0 items-center gap-1">
		<Button
			variant="ghost"
			size="icon"
			tooltip="Voltar ao tamanho normal"
			onclick={() => windowMode.exitCompact()}
		>
			<MaximizeIcon />
		</Button>
		<Button
			variant="ghost"
			size="icon"
			tooltip="Esconder na bandeja"
			onclick={() => windowMode.hideToTray()}
		>
			<MinimizeIcon />
		</Button>
	</div>
</div>
