import { query } from '$app/server';
import { db } from '$lib/server/db';
import { requests, dailySummary } from '$lib/db/schema';
import { desc, sql, sum, count, avg } from 'drizzle-orm';

// Totals query - aggregate stats
export const getTotals = query(async () => {
	const totalsResult = await db
		.select({
			total_requests: count(),
			total_input: sum(requests.tokensInput),
			total_output: sum(requests.tokensOutput),
			total_reasoning: sum(requests.tokensReasoning),
			total_cache_read: sum(requests.tokensCacheRead),
			total_cache_write: sum(requests.tokensCacheWrite),
			total_cost: sum(requests.costUsd)
		})
		.from(requests);

	return {
		total_requests: Number(totalsResult[0]?.total_requests ?? 0),
		total_input: Number(totalsResult[0]?.total_input ?? 0),
		total_output: Number(totalsResult[0]?.total_output ?? 0),
		total_reasoning: Number(totalsResult[0]?.total_reasoning ?? 0),
		total_cache_read: Number(totalsResult[0]?.total_cache_read ?? 0),
		total_cache_write: Number(totalsResult[0]?.total_cache_write ?? 0),
		total_cost: Number(totalsResult[0]?.total_cost ?? 0)
	};
});

// Cost by model query
export const getCostByModel = query(async () => {
	const result = await db
		.select({
			model_id: requests.modelId,
			provider_id: requests.providerId,
			request_count: count(),
			tokens_input: sum(requests.tokensInput),
			tokens_output: sum(requests.tokensOutput),
			cost_usd: sum(requests.costUsd)
		})
		.from(requests)
		.groupBy(requests.modelId, requests.providerId)
		.orderBy(desc(sum(requests.costUsd)));

	return result.map((r) => ({
		model_id: r.model_id,
		provider_id: r.provider_id,
		request_count: Number(r.request_count),
		tokens_input: Number(r.tokens_input ?? 0),
		tokens_output: Number(r.tokens_output ?? 0),
		cost_usd: Number(r.cost_usd ?? 0)
	}));
});

// Cost over time (last 30 days)
export const getCostOverTime = query(async () => {
	const result = await db
		.select({
			date: dailySummary.date,
			request_count: sum(dailySummary.requestCount),
			tokens_input: sum(dailySummary.tokensInput),
			tokens_output: sum(dailySummary.tokensOutput),
			cost_usd: sum(dailySummary.costUsd)
		})
		.from(dailySummary)
		.where(sql`${dailySummary.date}::date >= CURRENT_DATE - INTERVAL '30 days'`)
		.groupBy(dailySummary.date)
		.orderBy(dailySummary.date);

	return result.map((r) => ({
		date: r.date,
		request_count: Number(r.request_count ?? 0),
		tokens_input: Number(r.tokens_input ?? 0),
		tokens_output: Number(r.tokens_output ?? 0),
		cost_usd: Number(r.cost_usd ?? 0)
	}));
});

// Tokens by hour today and tokens by day (for zoom chart)
export const getTokensData = query(async () => {
	const tokensByHourToday = await db
		.select({
			hour: sql<number>`EXTRACT(HOUR FROM ${requests.createdAt})::int`,
			tokens_input: sql<number>`COALESCE(SUM(${requests.tokensInput}), 0)`,
			tokens_output: sql<number>`COALESCE(SUM(${requests.tokensOutput}), 0)`
		})
		.from(requests)
		.where(sql`DATE(${requests.createdAt}) = CURRENT_DATE`)
		.groupBy(sql`EXTRACT(HOUR FROM ${requests.createdAt})`)
		.orderBy(sql`EXTRACT(HOUR FROM ${requests.createdAt})`);

	const tokensByDay = await db
		.select({
			date: dailySummary.date,
			tokens_input: sql<number>`COALESCE(SUM(${dailySummary.tokensInput}), 0)`,
			tokens_output: sql<number>`COALESCE(SUM(${dailySummary.tokensOutput}), 0)`
		})
		.from(dailySummary)
		.where(sql`${dailySummary.date}::date >= CURRENT_DATE - INTERVAL '365 days'`)
		.groupBy(dailySummary.date)
		.orderBy(dailySummary.date);

	return {
		hourly: tokensByHourToday.map((r) => ({
			hour: Number(r.hour),
			tokens_input: Number(r.tokens_input),
			tokens_output: Number(r.tokens_output)
		})),
		daily: tokensByDay.map((r) => ({
			date: r.date,
			tokens_input: Number(r.tokens_input),
			tokens_output: Number(r.tokens_output)
		}))
	};
});

// Agent breakdown
export const getAgentBreakdown = query(async () => {
	const result = await db
		.select({
			agent: requests.agent,
			request_count: count(),
			tokens_input: sum(requests.tokensInput),
			tokens_output: sum(requests.tokensOutput),
			cost_usd: sum(requests.costUsd)
		})
		.from(requests)
		.groupBy(requests.agent)
		.orderBy(desc(sum(requests.costUsd)));

	return result.map((r) => ({
		agent: r.agent,
		request_count: Number(r.request_count),
		tokens_input: Number(r.tokens_input ?? 0),
		tokens_output: Number(r.tokens_output ?? 0),
		cost_usd: Number(r.cost_usd ?? 0)
	}));
});

// Model performance (avg duration)
export const getModelPerformance = query(async () => {
	const result = await db
		.select({
			model_id: requests.modelId,
			avg_duration_ms: avg(requests.durationMs),
			request_count: count()
		})
		.from(requests)
		.where(sql`${requests.durationMs} IS NOT NULL`)
		.groupBy(requests.modelId)
		.orderBy(desc(avg(requests.durationMs)));

	return result.map((r) => ({
		model_id: r.model_id,
		avg_duration_ms: Number(r.avg_duration_ms ?? 0),
		request_count: Number(r.request_count)
	}));
});

// Recent requests
export const getRecentRequests = query(async () => {
	const result = await db
		.select({
			id: requests.id,
			model_id: requests.modelId,
			tokens_input: requests.tokensInput,
			tokens_output: requests.tokensOutput,
			cost_usd: requests.costUsd,
			created_at: requests.createdAt
		})
		.from(requests)
		.orderBy(desc(requests.createdAt))
		.limit(100);

	return result.map((r) => ({
		id: r.id,
		model_id: r.model_id,
		tokens_input: Number(r.tokens_input ?? 0),
		tokens_output: Number(r.tokens_output ?? 0),
		cost_usd: Number(r.cost_usd ?? 0),
		created_at: r.created_at?.toISOString() ?? new Date().toISOString()
	}));
});
