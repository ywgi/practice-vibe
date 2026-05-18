import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { messages, users } from '$lib/server/db/schema';
import {
	addConnection,
	removeConnection,
	getEventsSince,
	getEventCounter,
	type Connection
} from '$lib/server/sse';
import { desc, eq, isNull } from 'drizzle-orm';
import type { Message } from '$lib/types/message';

async function getLastMessages(): Promise<Message[]> {
	const rows = await db
		.select({
			id: messages.id,
			userId: messages.userId,
			userName: users.name,
			content: messages.content,
			createdAt: messages.createdAt
		})
		.from(messages)
		.innerJoin(users, eq(messages.userId, users.id))
		.where(isNull(messages.deletedAt))
		.orderBy(desc(messages.createdAt))
		.limit(50);

	return rows.reverse().map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export const GET: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const encoder = new TextEncoder();
	let conn: Connection | null = null;
	let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			const lastEventIdHeader = request.headers.get('Last-Event-ID');
			const lastEventId =
				lastEventIdHeader !== null ? parseInt(lastEventIdHeader, 10) : null;

			const sendSnapshot = async () => {
				const msgs = await getLastMessages();
				const raw = `event: snapshot\nid: ${getEventCounter()}\ndata: ${JSON.stringify({ messages: msgs })}\n\n`;
				controller.enqueue(encoder.encode(raw));
			};

			if (lastEventId !== null && !isNaN(lastEventId)) {
				const { events, tooOld } = getEventsSince(lastEventId);
				if (tooOld) {
					await sendSnapshot();
				} else {
					for (const stored of events) {
						const raw = `id: ${stored.id}\nevent: ${stored.event.type}\ndata: ${JSON.stringify(stored.event.data)}\n\n`;
						controller.enqueue(encoder.encode(raw));
					}
				}
			} else {
				await sendSnapshot();
			}

			conn = { controller, encoder, userId: locals.user!.id };
			addConnection(conn);

			keepaliveInterval = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': ping\n\n'));
				} catch {
					// Connection already closed
				}
			}, 25000);
		},
		cancel() {
			if (keepaliveInterval) clearInterval(keepaliveInterval);
			if (conn) removeConnection(conn);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
