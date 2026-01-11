import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	requests,
	sessions,
	dailySummary,
	turns,
	toolCalls,
	assistantTextParts,
	fileEdits,
	promptOutcomes
} from '$lib/db/schema';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { publishLiveEvent } from '$lib/server/live';
import { env } from '$env/dynamic/private';

type RequestEvent = {
	type?: 'request';
	messageId: string;
	sessionId: string;
	providerId: string;
	modelId: string;
	agent: string;
	tokens: {
		input: number;
		output: number;
		reasoning: number;
		cache: {
			read: number;
			write: number;
		};
	};
	cost: number;
	durationMs: number | null;
	finishReason: string | null;
	workingDir: string | null;
	createdAt: string;
	completedAt: string | null;
};

type PromptEvent = {
	type: 'prompt';
	sessionId: string;
	messageId: string;
	prompt: string;
	agent?: string;
	providerId?: string;
	modelId?: string;
	createdAt?: string;
};

type ToolBeforeEvent = {
	type: 'tool.before';
	sessionId: string;
	callId: string;
	tool: string;
	args: unknown;
	createdAt?: string;
};

type ToolAfterEvent = {
	type: 'tool.after';
	sessionId: string;
	callId: string;
	tool: string;
	title: string;
	output: string;
	metadata: unknown;
	durationMs?: number | null;
	success?: boolean;
	errorMessage?: string | null;
	createdAt?: string;
};

type FileEditEvent = {
	type: 'file.edit';
	sessionId: string;
	toolCallId: string;
	filePath: string;
	fileExtension: string | null;
	operation: string;
	linesAdded: number;
	linesRemoved: number;
	createdAt?: string;
};

type AssistantTextEvent = {
	type: 'assistant.text';
	sessionId: string;
	messageId: string;
	partId: string;
	text: string;
	createdAt?: string;
};

type TelemetryEvent =
	| RequestEvent
	| PromptEvent
	| ToolBeforeEvent
	| ToolAfterEvent
	| AssistantTextEvent
	| FileEditEvent;

function coerceDate(input?: string): Date {
	if (!input) return new Date();
	const d = new Date(input);
	return Number.isNaN(d.valueOf()) ? new Date() : d;
}

export const POST: RequestHandler = async ({ request }) => {
	// Check API key
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return json({ error: 'Missing or invalid authorization' }, { status: 401 });
	}

	const providedKey = authHeader.slice(7);
	if (providedKey !== env.API_KEY) {
		return json({ error: 'Invalid API key' }, { status: 403 });
	}

	let event: TelemetryEvent;
	try {
		event = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	// Backwards compatible: existing plugin posts token events without `type`
	if (!('type' in event) || !event.type) {
		if ('tokens' in event && 'messageId' in event) {
			(event as RequestEvent).type = 'request';
		} else {
			return json({ error: 'Missing event type' }, { status: 400 });
		}
	}

	try {
		switch (event.type) {
			case 'prompt': {
				if (!event.sessionId || !event.messageId || !event.prompt) {
					return json({ error: 'Missing required fields' }, { status: 400 });
				}

				const timestamp = coerceDate(event.createdAt);
				const title = event.prompt.trim().slice(0, 120) || null;

				await db
					.insert(sessions)
					.values({
						sessionId: event.sessionId,
						title: title ?? undefined,
						firstRequestAt: timestamp,
						lastRequestAt: timestamp
					})
					.onConflictDoUpdate({
						target: sessions.sessionId,
						set: {
							lastRequestAt: sql`GREATEST(${sessions.lastRequestAt}, ${timestamp})`,
							firstRequestAt: sql`COALESCE(${sessions.firstRequestAt}, ${timestamp})`,
							title: sql`COALESCE(${sessions.title}, ${title})`
						}
					});

				await db
					.insert(turns)
					.values({
						sessionId: event.sessionId,
						userMessageId: event.messageId,
						prompt: event.prompt,
						agent: event.agent,
						providerId: event.providerId,
						modelId: event.modelId,
						createdAt: timestamp
					})
					.onConflictDoUpdate({
						target: turns.userMessageId,
						set: {
							prompt: event.prompt,
							createdAt: timestamp
						}
					});

				publishLiveEvent({
					type: 'prompt',
					sessionId: event.sessionId,
					messageId: event.messageId,
					prompt: event.prompt,
					createdAt: timestamp.toISOString()
				});

				return json({ success: true });
			}

			case 'tool.before': {
				if (!event.sessionId || !event.callId || !event.tool) {
					return json({ error: 'Missing required fields' }, { status: 400 });
				}

				const timestamp = coerceDate(event.createdAt);
				const openTurn = await db
					.select({ id: turns.id })
					.from(turns)
					.where(and(eq(turns.sessionId, event.sessionId), isNull(turns.assistantMessageId)))
					.orderBy(desc(turns.createdAt))
					.limit(1);

				await db
					.insert(toolCalls)
					.values({
						sessionId: event.sessionId,
						turnId: openTurn[0]?.id,
						callId: event.callId,
						tool: event.tool,
						args: event.args,
						startedAt: timestamp
					})
					.onConflictDoUpdate({
						target: toolCalls.callId,
						set: {
							sessionId: event.sessionId,
							turnId: openTurn[0]?.id,
							tool: event.tool,
							args: event.args,
							startedAt: timestamp
						}
					});

				publishLiveEvent({
					type: 'tool.before',
					sessionId: event.sessionId,
					callId: event.callId,
					tool: event.tool,
					createdAt: timestamp.toISOString()
				});

				return json({ success: true });
			}

			case 'tool.after': {
				if (!event.sessionId || !event.callId || !event.tool) {
					return json({ error: 'Missing required fields' }, { status: 400 });
				}

				const timestamp = coerceDate(event.createdAt);
				await db
					.insert(toolCalls)
					.values({
						sessionId: event.sessionId,
						callId: event.callId,
						tool: event.tool,
						title: event.title,
						output: event.output,
						metadata: event.metadata,
						durationMs: event.durationMs ?? null,
						success: event.success ?? null,
						errorMessage: event.errorMessage ?? null,
						startedAt: timestamp,
						completedAt: timestamp
					})
					.onConflictDoUpdate({
						target: toolCalls.callId,
						set: {
							title: event.title,
							output: event.output,
							metadata: event.metadata,
							durationMs: event.durationMs ?? null,
							success: event.success ?? null,
							errorMessage: event.errorMessage ?? null,
							completedAt: timestamp
						}
					});

				publishLiveEvent({
					type: 'tool.after',
					sessionId: event.sessionId,
					callId: event.callId,
					tool: event.tool,
					title: event.title,
					success: event.success,
					durationMs: event.durationMs,
					createdAt: timestamp.toISOString()
				});

				return json({ success: true });
			}

			case 'file.edit': {
				if (!event.sessionId || !event.filePath || !event.operation) {
					return json({ error: 'Missing required fields' }, { status: 400 });
				}

				const timestamp = coerceDate(event.createdAt);

				// Find the tool call ID if we have it
				let toolCallId: number | null = null;
				if (event.toolCallId) {
					const toolCall = await db
						.select({ id: toolCalls.id })
						.from(toolCalls)
						.where(eq(toolCalls.callId, event.toolCallId))
						.limit(1);
					toolCallId = toolCall[0]?.id ?? null;
				}

				// Find the open turn for this session
				const openTurn = await db
					.select({ id: turns.id })
					.from(turns)
					.where(and(eq(turns.sessionId, event.sessionId), isNull(turns.assistantMessageId)))
					.orderBy(desc(turns.createdAt))
					.limit(1);

				await db.insert(fileEdits).values({
					sessionId: event.sessionId,
					turnId: openTurn[0]?.id ?? null,
					toolCallId,
					filePath: event.filePath,
					fileExtension: event.fileExtension,
					operation: event.operation,
					linesAdded: event.linesAdded ?? 0,
					linesRemoved: event.linesRemoved ?? 0,
					createdAt: timestamp
				});

				publishLiveEvent({
					type: 'file.edit',
					sessionId: event.sessionId,
					filePath: event.filePath,
					fileExtension: event.fileExtension,
					operation: event.operation,
					linesAdded: event.linesAdded,
					linesRemoved: event.linesRemoved,
					createdAt: timestamp.toISOString()
				});

				return json({ success: true });
			}

			case 'assistant.text': {
				if (!event.sessionId || !event.messageId || !event.partId || !event.text) {
					return json({ error: 'Missing required fields' }, { status: 400 });
				}

				const timestamp = coerceDate(event.createdAt);
				await db
					.insert(assistantTextParts)
					.values({
						sessionId: event.sessionId,
						messageId: event.messageId,
						partId: event.partId,
						text: event.text,
						createdAt: timestamp
					})
					.onConflictDoNothing();

				const parts = await db
					.select({ text: assistantTextParts.text })
					.from(assistantTextParts)
					.where(eq(assistantTextParts.messageId, event.messageId))
					.orderBy(assistantTextParts.createdAt);

				const fullText = parts.map((p) => p.text).join('\n');
				await db
					.update(turns)
					.set({ assistantText: fullText })
					.where(eq(turns.assistantMessageId, event.messageId));

				publishLiveEvent({
					type: 'assistant.text',
					sessionId: event.sessionId,
					messageId: event.messageId,
					text: event.text,
					createdAt: timestamp.toISOString()
				});

				return json({ success: true });
			}

			case 'request': {
				if (!event.messageId || !event.sessionId || !event.providerId || !event.modelId) {
					return json({ error: 'Missing required fields' }, { status: 400 });
				}

				const now = new Date();
				const timestamp = event.createdAt ? new Date(event.createdAt) : now;
				const dateStr = timestamp.toISOString().split('T')[0];

				// Fetch existing record first (if any)
				const existing = await db
					.select()
					.from(requests)
					.where(eq(requests.messageId, event.messageId))
					.limit(1);

				const existingRecord = existing[0] ?? null;

				// Upsert request - handles race conditions atomically
				await db
					.insert(requests)
					.values({
						messageId: event.messageId,
						sessionId: event.sessionId,
						providerId: event.providerId,
						modelId: event.modelId,
						agent: event.agent,
						tokensInput: event.tokens.input,
						tokensOutput: event.tokens.output,
						tokensReasoning: event.tokens.reasoning,
						tokensCacheRead: event.tokens.cache.read,
						tokensCacheWrite: event.tokens.cache.write,
						costUsd: event.cost,
						durationMs: event.durationMs,
						finishReason: event.finishReason,
						workingDir: event.workingDir,
						createdAt: timestamp,
						completedAt: event.completedAt ? new Date(event.completedAt) : null
					})
					.onConflictDoUpdate({
						target: requests.messageId,
						set: {
							tokensInput: event.tokens.input,
							tokensOutput: event.tokens.output,
							tokensReasoning: event.tokens.reasoning,
							tokensCacheRead: event.tokens.cache.read,
							tokensCacheWrite: event.tokens.cache.write,
							costUsd: event.cost,
							durationMs: event.durationMs,
							finishReason: event.finishReason,
							completedAt: event.completedAt ? new Date(event.completedAt) : null
						}
					});

				if (!existingRecord) {
					// New record - add full values to summaries
					await db
						.insert(sessions)
						.values({
							sessionId: event.sessionId,
							projectDir: event.workingDir,
							firstRequestAt: timestamp,
							lastRequestAt: timestamp,
							totalRequests: 1,
							totalCostUsd: event.cost,
							totalTokensInput: event.tokens.input,
							totalTokensOutput: event.tokens.output
						})
						.onConflictDoUpdate({
							target: sessions.sessionId,
							set: {
								lastRequestAt: timestamp,
								totalRequests: sql`${sessions.totalRequests} + 1`,
								totalCostUsd: sql`${sessions.totalCostUsd} + ${event.cost}`,
								totalTokensInput: sql`${sessions.totalTokensInput} + ${event.tokens.input}`,
								totalTokensOutput: sql`${sessions.totalTokensOutput} + ${event.tokens.output}`
							}
						});

					await db
						.insert(dailySummary)
						.values({
							date: dateStr,
							providerId: event.providerId,
							modelId: event.modelId,
							requestCount: 1,
							tokensInput: event.tokens.input,
							tokensOutput: event.tokens.output,
							tokensReasoning: event.tokens.reasoning,
							tokensCacheRead: event.tokens.cache.read,
							tokensCacheWrite: event.tokens.cache.write,
							costUsd: event.cost
						})
						.onConflictDoUpdate({
							target: [dailySummary.date, dailySummary.providerId, dailySummary.modelId],
							set: {
								requestCount: sql`${dailySummary.requestCount} + 1`,
								tokensInput: sql`${dailySummary.tokensInput} + ${event.tokens.input}`,
								tokensOutput: sql`${dailySummary.tokensOutput} + ${event.tokens.output}`,
								tokensReasoning: sql`${dailySummary.tokensReasoning} + ${event.tokens.reasoning}`,
								tokensCacheRead: sql`${dailySummary.tokensCacheRead} + ${event.tokens.cache.read}`,
								tokensCacheWrite: sql`${dailySummary.tokensCacheWrite} + ${event.tokens.cache.write}`,
								costUsd: sql`${dailySummary.costUsd} + ${event.cost}`
							}
						});
				} else {
					// Updated record - apply deltas to summaries
					const deltaInput = event.tokens.input - (existingRecord.tokensInput || 0);
					const deltaOutput = event.tokens.output - (existingRecord.tokensOutput || 0);
					const deltaReasoning = event.tokens.reasoning - (existingRecord.tokensReasoning || 0);
					const deltaCacheRead = event.tokens.cache.read - (existingRecord.tokensCacheRead || 0);
					const deltaCacheWrite = event.tokens.cache.write - (existingRecord.tokensCacheWrite || 0);
					const deltaCost = event.cost - (existingRecord.costUsd || 0);

					if (deltaCost !== 0 || deltaInput !== 0 || deltaOutput !== 0) {
						await db
							.update(dailySummary)
							.set({
								tokensInput: sql`${dailySummary.tokensInput} + ${deltaInput}`,
								tokensOutput: sql`${dailySummary.tokensOutput} + ${deltaOutput}`,
								tokensReasoning: sql`${dailySummary.tokensReasoning} + ${deltaReasoning}`,
								tokensCacheRead: sql`${dailySummary.tokensCacheRead} + ${deltaCacheRead}`,
								tokensCacheWrite: sql`${dailySummary.tokensCacheWrite} + ${deltaCacheWrite}`,
								costUsd: sql`${dailySummary.costUsd} + ${deltaCost}`
							})
							.where(
								and(
									eq(dailySummary.date, dateStr),
									eq(dailySummary.providerId, event.providerId),
									eq(dailySummary.modelId, event.modelId)
								)
							);

						await db
							.update(sessions)
							.set({
								totalCostUsd: sql`${sessions.totalCostUsd} + ${deltaCost}`,
								totalTokensInput: sql`${sessions.totalTokensInput} + ${deltaInput}`,
								totalTokensOutput: sql`${sessions.totalTokensOutput} + ${deltaOutput}`,
								lastRequestAt: timestamp
							})
							.where(eq(sessions.sessionId, event.sessionId));
					}
				}

				// Attach request metadata to the most recent open turn
				const openTurn = await db
					.select({ id: turns.id })
					.from(turns)
					.where(and(eq(turns.sessionId, event.sessionId), isNull(turns.assistantMessageId)))
					.orderBy(desc(turns.createdAt))
					.limit(1);

				if (openTurn[0]) {
					await db
						.update(turns)
						.set({
							assistantMessageId: event.messageId,
							agent: event.agent,
							providerId: event.providerId,
							modelId: event.modelId,
							tokensInput: event.tokens.input,
							tokensOutput: event.tokens.output,
							tokensReasoning: event.tokens.reasoning,
							tokensCacheRead: event.tokens.cache.read,
							tokensCacheWrite: event.tokens.cache.write,
							costUsd: event.cost,
							durationMs: event.durationMs,
							finishReason: event.finishReason,
							completedAt: event.completedAt ? new Date(event.completedAt) : null
						})
						.where(eq(turns.id, openTurn[0].id));
				}

				publishLiveEvent({
					type: 'request',
					sessionId: event.sessionId,
					messageId: event.messageId,
					providerId: event.providerId,
					modelId: event.modelId,
					agent: event.agent,
					tokens: event.tokens,
					cost: event.cost,
					createdAt: timestamp.toISOString(),
					completedAt: event.completedAt
				});

				return json({ success: true });
			}

			default:
				return json({ error: 'Unknown event type' }, { status: 400 });
		}
	} catch (e) {
		console.error('Database error:', e);
		return json({ error: 'Failed to process event' }, { status: 500 });
	}
};
