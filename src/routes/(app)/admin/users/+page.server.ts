import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { hashPassword } from '$lib/server/auth/password';
import { invalidateAllUserSessions } from '$lib/server/auth/session';
import { nanoid } from 'nanoid';

export const load: PageServerLoad = async () => {
	const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
	return { users: allUsers };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').toLowerCase().trim();
		const name = String(formData.get('name') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		const role = String(formData.get('role') ?? 'employee') as 'admin' | 'employee';

		if (!email || !name || !password) {
			return fail(400, { createError: 'All fields are required' });
		}

		const passwordHash = await hashPassword(password);

		try {
			await db.insert(users).values({ id: nanoid(), email, name, passwordHash, role });
		} catch (err: unknown) {
			// Postgres unique constraint violation
			if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
				return fail(400, { createError: 'A user with that email already exists' });
			}
			throw err;
		}

		return { createSuccess: true };
	},

	archive: async ({ request, locals }) => {
		const formData = await request.formData();
		const userId = String(formData.get('userId') ?? '');

		if (!locals.user) return fail(403, { archiveError: 'Unauthorized' });
		if (userId === locals.user.id) return fail(400, { archiveError: 'You cannot archive yourself' });

		await db.update(users).set({ archivedAt: new Date() }).where(eq(users.id, userId));
		await invalidateAllUserSessions(userId);

		return { archiveSuccess: true };
	}
};
