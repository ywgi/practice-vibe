import type { Message } from '$lib/types/message';

// KNOWN LIMITATIONS:
// - Counter and ring buffer are in-memory. On server restart, clients reconnecting
//   with a stale Last-Event-ID will receive a fresh snapshot instead of a replay.
// - Single-process broadcast only. Multi-instance deployments need Redis pub/sub.
// - Keepalive is 25 s. Some corporate proxies kill idle connections faster — tune down if needed.

export type BroadcastEvent =
	| { type: 'message_new'; data: Message }
	| { type: 'message_deleted'; data: { id: string } };

export type Connection = {
	controller: ReadableStreamDefaultController;
	encoder: TextEncoder;
	userId: string;
};

export type StoredEvent = {
	id: number;
	event: BroadcastEvent;
};

const connections = new Set<Connection>();
const BUFFER_SIZE = 200;
const buffer: StoredEvent[] = [];
let eventCounter = 0;

export function getEventCounter(): number {
	return eventCounter;
}

export function addConnection(conn: Connection): void {
	connections.add(conn);
}

export function removeConnection(conn: Connection): void {
	connections.delete(conn);
}

export function broadcast(event: BroadcastEvent): void {
	const id = ++eventCounter;
	buffer.push({ id, event });
	if (buffer.length > BUFFER_SIZE) buffer.shift();

	const raw = `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
	const dead: Connection[] = [];

	for (const conn of connections) {
		try {
			conn.controller.enqueue(conn.encoder.encode(raw));
		} catch {
			dead.push(conn);
		}
	}

	for (const conn of dead) connections.delete(conn);
}

export function getEventsSince(lastEventId: number): { events: StoredEvent[]; tooOld: boolean } {
	// Counter reset on server restart means lastEventId >= eventCounter — treat as stale.
	if (buffer.length === 0 || lastEventId >= eventCounter || lastEventId < buffer[0].id) {
		return { events: [], tooOld: true };
	}
	return { events: buffer.filter((e) => e.id > lastEventId), tooOld: false };
}
