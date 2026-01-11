import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const AUTH_COOKIE_NAME = 'dashboard_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { password } = await request.json();
	const expectedPassword = env.DASHBOARD_PASSWORD;

	if (!expectedPassword) {
		return json({ error: 'Server not configured for authentication' }, { status: 500 });
	}

	if (password === expectedPassword) {
		// Create a simple token (hash of password + timestamp for uniqueness)
		const token = Buffer.from(`${expectedPassword}:${Date.now()}`).toString('base64');

		cookies.set(AUTH_COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: COOKIE_MAX_AGE
		});

		return json({ success: true });
	}

	return json({ error: 'Invalid password' }, { status: 401 });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
	return json({ success: true });
};
