<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import type { Message } from '$lib/types/message';

	const user = $derived(
		page.data.user as { id: string; email: string; name: string; role: 'admin' | 'employee' }
	);

	let chatMessages = $state<Message[]>([]);
	let inputText = $state('');
	let isAtBottom = $state(true);
	let showNewPill = $state(false);
	let connected = $state(false);

	let listEl: HTMLDivElement | undefined;

	function scrollToBottom() {
		if (listEl) listEl.scrollTop = listEl.scrollHeight;
	}

	function checkAtBottom(): boolean {
		if (!listEl) return true;
		return listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 50;
	}

	function handleScroll() {
		isAtBottom = checkAtBottom();
		if (isAtBottom) showNewPill = false;
	}

	function onSnapshot(data: { messages: Message[] }) {
		chatMessages = data.messages; // oldest first from server
		connected = true;
		showNewPill = false;
		setTimeout(scrollToBottom, 0);
	}

	function onMessageNew(message: Message) {
		chatMessages = [...chatMessages, message];
		if (isAtBottom) {
			setTimeout(scrollToBottom, 0);
		} else {
			showNewPill = true;
		}
	}

	function onMessageDeleted({ id }: { id: string }) {
		chatMessages = chatMessages.filter((m) => m.id !== id);
	}

	async function sendMessage() {
		const text = inputText.trim();
		if (!text) return;
		inputText = '';
		// Don't append locally — wait for SSE broadcast to confirm acceptance
		await fetch('/api/messages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content: [{ type: 'text', value: text }] })
		});
	}

	async function deleteMessage(id: string) {
		if (!confirm('Delete this message?')) return;
		await fetch(`/api/messages/${id}`, { method: 'DELETE' });
		// Don't remove locally — wait for SSE broadcast
	}

	function canDelete(msg: Message): boolean {
		return user?.role === 'admin' || msg.userId === user?.id;
	}

	function formatTime(iso: string): string {
		const d = new Date(iso);
		const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
		if (diffMin < 1) return 'just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		if (diffMin < 1440) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		return d.toLocaleDateString();
	}

	function textContent(msg: Message): string {
		return msg.content
			.filter((s) => s.type === 'text')
			.map((s) => (s as { type: 'text'; value: string }).value)
			.join('');
	}

	onMount(() => {
		const es = new EventSource('/api/events');

		es.addEventListener('snapshot', (e: MessageEvent) => onSnapshot(JSON.parse(e.data)));
		es.addEventListener('message_new', (e: MessageEvent) => onMessageNew(JSON.parse(e.data)));
		es.addEventListener('message_deleted', (e: MessageEvent) =>
			onMessageDeleted(JSON.parse(e.data))
		);
		es.onopen = () => (connected = true);
		es.onerror = () => (connected = false);

		return () => es.close();
	});
</script>

<!-- Fill height below the nav; -m-4 escapes layout's p-4 -->
<div class="-m-4 flex flex-col" style="height: calc(100svh - 57px)">
	{#if !connected}
		<div class="bg-yellow-100 px-4 py-1 text-center text-xs text-yellow-800">Reconnecting…</div>
	{/if}

	<!-- Message list + new-message pill -->
	<div class="relative min-h-0 flex-1">
		<div
			bind:this={listEl}
			onscroll={handleScroll}
			class="h-full space-y-4 overflow-y-auto px-4 py-4"
		>
			{#each chatMessages as msg (msg.id)}
				<div class="group flex items-start gap-3">
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline gap-2">
							<span class="text-sm font-semibold">{msg.userName}</span>
							<span class="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</span>
						</div>
						<p class="whitespace-pre-wrap wrap-break-word text-sm">{textContent(msg)}</p>
					</div>
					{#if canDelete(msg)}
						<button
							onclick={() => deleteMessage(msg.id)}
							class="shrink-0 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
						>
							Delete
						</button>
					{/if}
				</div>
			{/each}
		</div>

		{#if showNewPill}
			<div class="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
				<button
					onclick={() => {
						isAtBottom = true;
						showNewPill = false;
						scrollToBottom();
					}}
					class="rounded-full bg-primary px-4 py-1 text-sm text-primary-foreground shadow"
				>
					New messages ↓
				</button>
			</div>
		{/if}
	</div>

	<!-- Input row -->
	<div class="border-t px-4 py-3" style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom))">
		<form
			onsubmit={(e) => {
				e.preventDefault();
				sendMessage();
			}}
			class="flex gap-2"
		>
			<input
				bind:value={inputText}
				type="text"
				placeholder="Message…"
				class="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
			/>
			<Button type="submit" disabled={!inputText.trim()}>Send</Button>
		</form>
	</div>
</div>
