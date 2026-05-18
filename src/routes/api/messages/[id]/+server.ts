import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { messages } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { broadcast } from '$lib/server/sse';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });

	const { id } = params;

	const [message] = await db
		.select()
		.from(messages)
		.where(eq(messages.id, id))
		.limit(1);

	if (!message || message.deletedAt !== null) {
		return new Response('Not found', { status: 404 });
	}

	if (locals.user.role !== 'admin' && message.userId !== locals.user.id) {
		return new Response('Forbidden', { status: 403 });
	}

	await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, id));
	broadcast({ type: 'message_deleted', data: { id } });

	return new Response(null, { status: 204 });
};
