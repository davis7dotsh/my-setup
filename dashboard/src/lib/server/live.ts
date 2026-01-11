type LiveEvent = Record<string, unknown>;

type Subscriber = {
	controller: ReadableStreamDefaultController<Uint8Array>;
	keepAlive: ReturnType<typeof setInterval>;
};

const encoder = new TextEncoder();
const subscribers = new Set<Subscriber>();

function send(controller: ReadableStreamDefaultController<Uint8Array>, payload: string) {
	controller.enqueue(encoder.encode(payload));
}

export function publishLiveEvent(event: LiveEvent) {
	const payload = `data: ${JSON.stringify(event)}\n\n`;
	for (const sub of subscribers) {
		try {
			send(sub.controller, payload);
		} catch {
			// Ignore errors — stream will be cleaned up on cancel
		}
	}
}

export function createLiveStream(): ReadableStream<Uint8Array> {
	let subscriber: Subscriber | undefined;

	return new ReadableStream<Uint8Array>({
		start(controller) {
			// Initial comment line so proxies open the stream
			send(controller, ': connected\n\n');

			const keepAlive = setInterval(() => {
				try {
					send(controller, ': ping\n\n');
				} catch {
					// ignore
				}
			}, 15_000);

			subscriber = { controller, keepAlive };
			subscribers.add(subscriber);
		},
		cancel() {
			if (!subscriber) return;
			clearInterval(subscriber.keepAlive);
			subscribers.delete(subscriber);
			subscriber = undefined;
		}
	});
}
