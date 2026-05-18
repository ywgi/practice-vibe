import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyPassword } from '$lib/server/auth/password';
import { generateSessionToken, createSession } from '$lib/server/auth/session';
import { setSessionTokenCookie } from '$lib/server/auth/cookies';

// Simple in-memory rate limiter. Resets on server restart.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(email: string): boolean {
	const now = Date.now();
	const entry = attempts.get(email);
	if (!entry || now > entry.resetAt) return false;
	return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(email: string): void {
	const now = Date.now();
	const entry = attempts.get(email);
	if (!entry || now > entry.resetAt) {
		attempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
	} else {
		entry.count++;
	}
}

function resetAttempts(email: string): void {
	attempts.delete(email);
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, '/chat');
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = String(formData.get('email') ?? '').toLowerCase().trim();
		const password = String(formData.get('password') ?? '');

		if (isRateLimited(email)) {
			return fail(429, { error: 'Too many attempts, try again later' });
		}

		const [user] = await db
			.select()
			.from(users)
			.where(and(eq(users.email, email), isNull(users.archivedAt)))
			.limit(1);

		if (!user || !(await verifyPassword(password, user.passwordHash))) {
			recordFailure(email);
			return fail(400, { error: 'Invalid email or password' });
		}

		resetAttempts(email);

		const token = generateSessionToken();
		const session = await createSession(token, user.id);
		setSessionTokenCookie(event, token, session.expiresAt);

		redirect(302, '/chat');
	}
};
