<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<nav class="border-b px-4 py-3">
	<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
		<span class="font-semibold">Dealership</span>
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
			<a href="/chat" class="hover:underline">Chat</a>
			<a href="/inventory" class="hover:underline">Inventory</a>
			<a href="/calendar" class="hover:underline">Calendar</a>
			{#if data.user.role === 'admin'}
				<a href="/admin/users" class="hover:underline">Admin</a>
			{/if}
			<form method="POST" action="/logout">
				<button type="submit" class="hover:underline">Logout</button>
			</form>
		</div>
	</div>
</nav>

<main class="mx-auto max-w-6xl p-4">
	{@render children()}
</main>
