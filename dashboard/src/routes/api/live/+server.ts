import type { RequestHandler } from './$types';
import { createLiveStream } from '$lib/server/live';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const AUTH_COOKIE_NAME = 'dashboard_auth';

export const GET: RequestHandler = async ({ cookies }) => {
	const expectedPassword = env.DASHBOARD_PASSWORD;

	// If password is configured, validate auth
	if (expectedPassword) {
		const authCookie = cookies.get(AUTH_COOKIE_NAME);
		let authenticated = false;

		if (authCookie) {
			try {
				const decoded = Buffer.from(authCookie, 'base64').toString();
				const [storedPassword] = decoded.split(':');
				authenticated = storedPassword === expectedPassword;
			} catch {
				// Invalid token
			}
		}

		if (!authenticated) {
			throw error(401, 'Unauthorized');
		}
	}

	const stream = createLiveStream();

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
