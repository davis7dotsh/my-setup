import { query } from '$app/server';
import { db } from '$lib/server/db';
import { resolveCostUsd } from '$lib/server/model-pricing';
import { sessions, turns, toolCalls } from '$lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';

function toIso(d?: Date | null): string | null {
	return d ? d.toISOString() : null;
}

export const getConversations = query(async () => {
	const result = await db
		.select({
			session_id: sessions.sessionId,
			title: sessions.title,
			project_dir: sessions.projectDir,
			first_request_at: sessions.firstRequestAt,
			last_request_at: sessions.lastRequestAt,
			total_requests: sessions.totalRequests,
			total_cost_usd: sessions.totalCostUsd,
			total_tokens_input: sessions.totalTokensInput,
			total_tokens_output: sessions.totalTokensOutput
		})
		.from(sessions)
		.orderBy(desc(sessions.lastRequestAt))
		.limit(200);

	return result.map((s) => ({
		session_id: s.session_id,
		title: s.title ?? null,
		project_dir: s.project_dir ?? null,
		first_request_at: toIso(s.first_request_at),
		last_request_at: toIso(s.last_request_at),
		total_requests: Number(s.total_requests ?? 0),
		total_cost_usd: Number(s.total_cost_usd ?? 0),
		total_tokens_input: Number(s.total_tokens_input ?? 0),
		total_tokens_output: Number(s.total_tokens_output ?? 0)
	}));
});

export const getConversation = query('unchecked', async ({ sessionId }: { sessionId: string }) => {
	const sessionResult = await db
		.select({
			session_id: sessions.sessionId,
			title: sessions.title,
			project_dir: sessions.projectDir,
			first_request_at: sessions.firstRequestAt,
			last_request_at: sessions.lastRequestAt,
			total_requests: sessions.totalRequests,
			total_cost_usd: sessions.totalCostUsd,
			total_tokens_input: sessions.totalTokensInput,
			total_tokens_output: sessions.totalTokensOutput
		})
		.from(sessions)
		.where(eq(sessions.sessionId, sessionId))
		.limit(1);

	const session = sessionResult[0]
		? {
				session_id: sessionResult[0].session_id,
				title: sessionResult[0].title ?? null,
				project_dir: sessionResult[0].project_dir ?? null,
				first_request_at: toIso(sessionResult[0].first_request_at),
				last_request_at: toIso(sessionResult[0].last_request_at),
				total_requests: Number(sessionResult[0].total_requests ?? 0),
				total_cost_usd: Number(sessionResult[0].total_cost_usd ?? 0),
				total_tokens_input: Number(sessionResult[0].total_tokens_input ?? 0),
				total_tokens_output: Number(sessionResult[0].total_tokens_output ?? 0)
			}
		: null;

	const turnRows = await db
		.select({
			id: turns.id,
			session_id: turns.sessionId,
			user_message_id: turns.userMessageId,
			assistant_message_id: turns.assistantMessageId,
			prompt: turns.prompt,
			assistant_text: turns.assistantText,
			agent: turns.agent,
			provider_id: turns.providerId,
			model_id: turns.modelId,
			tokens_input: turns.tokensInput,
			tokens_output: turns.tokensOutput,
			tokens_reasoning: turns.tokensReasoning,
			tokens_cache_read: turns.tokensCacheRead,
			tokens_cache_write: turns.tokensCacheWrite,
			cost_usd: turns.costUsd,
			duration_ms: turns.durationMs,
			finish_reason: turns.finishReason,
			created_at: turns.createdAt,
			completed_at: turns.completedAt
		})
		.from(turns)
		.where(eq(turns.sessionId, sessionId))
		.orderBy(desc(turns.createdAt))
		.limit(500);

	const turnIds = turnRows.map((t) => t.id);
	const callRows = turnIds.length
		? await db
				.select({
					id: toolCalls.id,
					turn_id: toolCalls.turnId,
					call_id: toolCalls.callId,
					tool: toolCalls.tool,
					args: toolCalls.args,
					title: toolCalls.title,
					output: toolCalls.output,
					metadata: toolCalls.metadata,
					started_at: toolCalls.startedAt,
					completed_at: toolCalls.completedAt
				})
				.from(toolCalls)
				.where(inArray(toolCalls.turnId, turnIds))
				.orderBy(toolCalls.startedAt)
		: [];

	const callsByTurn = new Map<number, typeof callRows>();
	for (const call of callRows) {
		if (!call.turn_id) continue;
		const list = callsByTurn.get(call.turn_id) ?? [];
		list.push(call);
		callsByTurn.set(call.turn_id, list);
	}

	const resolvedTurnCostTotal = turnRows.reduce((sum, t) => {
		const costUsd = Number(t.cost_usd ?? 0);
		const resolvedCost = resolveCostUsd({
			costUsd,
			providerId: t.provider_id,
			modelId: t.model_id,
			tokensInput: Number(t.tokens_input ?? 0),
			tokensOutput: Number(t.tokens_output ?? 0),
			tokensReasoning: Number(t.tokens_reasoning ?? 0),
			tokensCacheRead: Number(t.tokens_cache_read ?? 0),
			tokensCacheWrite: Number(t.tokens_cache_write ?? 0)
		});
		return sum + resolvedCost;
	}, 0);

	return {
		session: session
			? {
					...session,
					total_cost_usd:
						session.total_cost_usd > 0 ? session.total_cost_usd : resolvedTurnCostTotal
				}
			: null,
		turns: turnRows.map((t) => ({
			id: t.id,
			session_id: t.session_id,
			user_message_id: t.user_message_id ?? null,
			assistant_message_id: t.assistant_message_id ?? null,
			prompt: t.prompt,
			assistant_text: t.assistant_text ?? null,
			agent: t.agent ?? null,
			provider_id: t.provider_id ?? null,
			model_id: t.model_id ?? null,
			tokens_input: Number(t.tokens_input ?? 0),
			tokens_output: Number(t.tokens_output ?? 0),
			tokens_reasoning: Number(t.tokens_reasoning ?? 0),
			tokens_cache_read: Number(t.tokens_cache_read ?? 0),
			tokens_cache_write: Number(t.tokens_cache_write ?? 0),
			cost_usd: resolveCostUsd({
				costUsd: Number(t.cost_usd ?? 0),
				providerId: t.provider_id,
				modelId: t.model_id,
				tokensInput: Number(t.tokens_input ?? 0),
				tokensOutput: Number(t.tokens_output ?? 0),
				tokensReasoning: Number(t.tokens_reasoning ?? 0),
				tokensCacheRead: Number(t.tokens_cache_read ?? 0),
				tokensCacheWrite: Number(t.tokens_cache_write ?? 0)
			}),
			duration_ms: t.duration_ms ?? null,
			finish_reason: t.finish_reason ?? null,
			created_at: toIso(t.created_at),
			completed_at: toIso(t.completed_at),
			tool_calls:
				callsByTurn.get(t.id)?.map((c) => ({
					id: c.id,
					call_id: c.call_id,
					tool: c.tool,
					args: c.args ?? null,
					title: c.title ?? null,
					output: c.output ?? null,
					metadata: c.metadata ?? null,
					started_at: toIso(c.started_at),
					completed_at: toIso(c.completed_at)
				})) ?? []
		}))
	};
});

export const getRecentTurns = query(async () => {
	const result = await db
		.select({
			id: turns.id,
			session_id: turns.sessionId,
			prompt: turns.prompt,
			assistant_text: turns.assistantText,
			agent: turns.agent,
			provider_id: turns.providerId,
			model_id: turns.modelId,
			tokens_input: turns.tokensInput,
			tokens_output: turns.tokensOutput,
			tokens_reasoning: turns.tokensReasoning,
			tokens_cache_read: turns.tokensCacheRead,
			tokens_cache_write: turns.tokensCacheWrite,
			cost_usd: turns.costUsd,
			created_at: turns.createdAt,
			completed_at: turns.completedAt
		})
		.from(turns)
		.orderBy(desc(turns.createdAt))
		.limit(50);

	return result.map((t) => ({
		id: t.id,
		session_id: t.session_id,
		prompt: t.prompt,
		assistant_text: t.assistant_text ?? null,
		agent: t.agent ?? null,
		provider_id: t.provider_id ?? null,
		model_id: t.model_id ?? null,
		tokens_input: Number(t.tokens_input ?? 0),
		tokens_output: Number(t.tokens_output ?? 0),
		cost_usd: resolveCostUsd({
			costUsd: Number(t.cost_usd ?? 0),
			providerId: t.provider_id,
			modelId: t.model_id,
			tokensInput: Number(t.tokens_input ?? 0),
			tokensOutput: Number(t.tokens_output ?? 0),
			tokensReasoning: Number(t.tokens_reasoning ?? 0),
			tokensCacheRead: Number(t.tokens_cache_read ?? 0),
			tokensCacheWrite: Number(t.tokens_cache_write ?? 0)
		}),
		created_at: toIso(t.created_at),
		completed_at: toIso(t.completed_at)
	}));
});
