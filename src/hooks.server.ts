import type { Handle } from '@sveltejs/kit';
import { validateSessionToken } from '$lib/server/auth/session';
import { setSessionTokenCookie, deleteSessionTokenCookie } from '$lib/server/auth/cookies';

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('session');

	if (!token) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await validateSessionToken(token);

	if (!session) {
		deleteSessionTokenCookie(event);
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	// Always refresh cookie to keep expiry in sync with DB
	setSessionTokenCookie(event, token, session.expiresAt);

	event.locals.session = session;
	event.locals.user = {
		id: user.id,
		email: user.email,
		name: user.name,
		role: user.role
	};

	return resolve(event);
};
