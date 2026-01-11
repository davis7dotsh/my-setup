import type { RequestHandler } from './$types';
import { createLiveStream } from '$lib/server/live';

export const GET: RequestHandler = async () => {
	const stream = createLiveStream();

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
