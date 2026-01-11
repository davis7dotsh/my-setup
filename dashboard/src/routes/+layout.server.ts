import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';

const AUTH_COOKIE_NAME = 'dashboard_auth';

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const expectedPassword = env.DASHBOARD_PASSWORD;

	// If no password is configured, allow access (dev mode convenience)
	if (!expectedPassword) {
		return { authenticated: true };
	}

	// Allow login page without auth
	if (url.pathname.startsWith('/login')) {
		return { authenticated: false };
	}

	// Check authentication
	const authCookie = cookies.get(AUTH_COOKIE_NAME);
	if (authCookie) {
		try {
			const decoded = Buffer.from(authCookie, 'base64').toString();
			const [storedPassword] = decoded.split(':');
			if (storedPassword === expectedPassword) {
				return { authenticated: true };
			}
		} catch {
			// Invalid token format
		}
	}

	// Redirect to login
	throw redirect(303, '/login');
};
