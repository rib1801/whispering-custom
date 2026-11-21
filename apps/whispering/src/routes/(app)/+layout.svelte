<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { rpc } from '$lib/query';
	import { services } from '$lib/services';
	import { settings } from '$lib/stores/settings.svelte';
	import * as Sidebar from '@epicenter/ui/sidebar';
	import AppLayout from './_components/AppLayout.svelte';
	import CompactBar from './_components/CompactBar.svelte';
	import VerticalNav from './_components/VerticalNav.svelte';
	import { windowMode } from '$lib/stores/window-mode.svelte';

	let { children } = $props();

	let sidebarOpen = $state(false);
	let unlistenNavigate: UnlistenFn | null = null;

	$effect(() => {
		const unlisten = services.localShortcutManager.listen();
		return () => unlisten();
	});

	// Log app started event once on mount
	$effect(() => {
		rpc.analytics.logEvent.execute({ type: 'app_started' });
	});

	// Listen for navigation events from other windows
	onMount(async () => {
		unlistenNavigate = await listen<{ path: string }>(
			'navigate-main-window',
			(event) => {
				goto(event.payload.path);
			},
		);
	});

	onDestroy(() => {
		unlistenNavigate?.();
	});
</script>

<Sidebar.Provider bind:open={sidebarOpen}>
	{#if !windowMode.isCompact && settings.value['ui.layoutMode'] === 'sidebar'}
		<VerticalNav />
	{/if}
	<Sidebar.Inset>
		<AppLayout>
			{@render children()}
		</AppLayout>
	</Sidebar.Inset>
</Sidebar.Provider>

<!-- Modo compacto: cobre a janela inteira com uma barra horizontal. O layout
     normal continua montado por baixo (atalhos, bandeja e efeitos seguem vivos),
     só que escondido atrás desta camada opaca. -->
{#if windowMode.isCompact}
	<div class="bg-background fixed inset-0 z-50">
		<CompactBar />
	</div>
{/if}
