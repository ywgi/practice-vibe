import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date): void {
	event.cookies.set('session', token, {
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		secure: env.SESSION_COOKIE_SECURE === 'true',
		expires: expiresAt
	});
}

export function deleteSessionTokenCookie(event: RequestEvent): void {
	event.cookies.delete('session', { path: '/' });
}
