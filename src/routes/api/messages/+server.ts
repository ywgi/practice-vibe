import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { messages, users } from '$lib/server/db/schema';
import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { broadcast } from '$lib/server/sse';
import { nanoid } from 'nanoid';
import type { Message, MessageContent } from '$lib/types/message';

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

function rowToMessage(r: {
	id: string;
	userId: string;
	userName: string;
	content: MessageContent;
	createdAt: Date;
}): Message {
	return { ...r, createdAt: r.createdAt.toISOString() };
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });

	const before = url.searchParams.get('before');
	const limitParam = url.searchParams.get('limit');
	const limit = Math.min(Math.max(parseInt(limitParam ?? '50', 10) || 50, 1), 100);

	const where = before
		? and(isNull(messages.deletedAt), lt(messages.createdAt, new Date(before)))
		: isNull(messages.deletedAt);

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
		.where(where)
		.orderBy(desc(messages.createdAt))
		.limit(limit);

	return json({ messages: rows.map(rowToMessage) });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, 400);
	}

	if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).content)) {
		return json({ error: 'content must be an array' }, 400);
	}

	const content = (body as { content: unknown[] }).content;

	if (content.length === 0) {
		return json({ error: 'content must have at least one segment' }, 400);
	}

	let totalTextLen = 0;

	for (const seg of content) {
		if (!seg || typeof seg !== 'object') return json({ error: 'invalid segment' }, 400);

		const s = seg as Record<string, unknown>;
		if (s.type !== 'text') {
			return json({ error: 'only text segments are supported in Phase 3' }, 400);
		}
		if (typeof s.value !== 'string' || s.value.trim() === '') {
			return json({ error: 'text segment value must be non-empty' }, 400);
		}
		totalTextLen += s.value.length;
	}

	if (totalTextLen > 4000) {
		return json({ error: 'Message too long (max 4000 chars)' }, 400);
	}

	const id = nanoid();
	await db.insert(messages).values({
		id,
		userId: locals.user.id,
		content: content as MessageContent
	});

	const [row] = await db
		.select({
			id: messages.id,
			userId: messages.userId,
			userName: users.name,
			content: messages.content,
			createdAt: messages.createdAt
		})
		.from(messages)
		.innerJoin(users, eq(messages.userId, users.id))
		.where(eq(messages.id, id));

	const message = rowToMessage(row);
	broadcast({ type: 'message_new', data: message });

	return json({ message }, 201);
};
