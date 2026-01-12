import { query } from '$app/server';
import { db } from '$lib/server/db';
import { requests, dailySummary, toolCalls, fileEdits } from '$lib/db/schema';
import { desc, sql, sum, count, avg, eq, isNotNull } from 'drizzle-orm';
import * as v from 'valibot';

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
// Accepts timezone offset in minutes (e.g., -480 for PST = UTC-8)
export const getTokensData = query(v.number(), async (tzOffsetMinutes: number) => {
	// Convert offset to interval string (e.g., -480 -> '-8 hours')
	const offsetHours = -tzOffsetMinutes / 60;
	const intervalStr = `${offsetHours} hours`;

	// Get hourly data for today in user's local timezone
	const tokensByHourToday = await db
		.select({
			hour: sql<number>`EXTRACT(HOUR FROM ${requests.createdAt} + INTERVAL '${sql.raw(intervalStr)}')::int`,
			tokens_input: sql<number>`COALESCE(SUM(${requests.tokensInput}), 0)`,
			tokens_output: sql<number>`COALESCE(SUM(${requests.tokensOutput}), 0)`
		})
		.from(requests)
		.where(
			sql`DATE(${requests.createdAt} + INTERVAL '${sql.raw(intervalStr)}') = DATE(NOW() + INTERVAL '${sql.raw(intervalStr)}')`
		)
		.groupBy(sql`EXTRACT(HOUR FROM ${requests.createdAt} + INTERVAL '${sql.raw(intervalStr)}')`)
		.orderBy(sql`EXTRACT(HOUR FROM ${requests.createdAt} + INTERVAL '${sql.raw(intervalStr)}')`);

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
			tokens_cache_read: requests.tokensCacheRead,
			tokens_cache_write: requests.tokensCacheWrite,
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
		tokens_cache_read: Number(r.tokens_cache_read ?? 0),
		tokens_cache_write: Number(r.tokens_cache_write ?? 0),
		cost_usd: Number(r.cost_usd ?? 0),
		created_at: r.created_at?.toISOString() ?? new Date().toISOString()
	}));
});

// Tool usage stats
export const getToolStats = query(async () => {
	const result = await db
		.select({
			tool: toolCalls.tool,
			call_count: count(),
			success_count: sql<number>`COUNT(*) FILTER (WHERE ${toolCalls.success} = true)`,
			failure_count: sql<number>`COUNT(*) FILTER (WHERE ${toolCalls.success} = false)`,
			avg_duration_ms: avg(toolCalls.durationMs),
			total_duration_ms: sum(toolCalls.durationMs)
		})
		.from(toolCalls)
		.where(isNotNull(toolCalls.completedAt))
		.groupBy(toolCalls.tool)
		.orderBy(desc(count()));

	return result.map((r) => ({
		tool: r.tool,
		call_count: Number(r.call_count),
		success_count: Number(r.success_count ?? 0),
		failure_count: Number(r.failure_count ?? 0),
		success_rate:
			Number(r.call_count) > 0
				? Number(r.success_count ?? 0) / Number(r.call_count)
				: 0,
		avg_duration_ms: Number(r.avg_duration_ms ?? 0),
		total_duration_ms: Number(r.total_duration_ms ?? 0)
	}));
});

// Tool stats over time (last 30 days)
export const getToolStatsOverTime = query(async () => {
	const result = await db
		.select({
			date: sql<string>`DATE(${toolCalls.startedAt})::text`,
			tool: toolCalls.tool,
			call_count: count(),
			success_count: sql<number>`COUNT(*) FILTER (WHERE ${toolCalls.success} = true)`,
			failure_count: sql<number>`COUNT(*) FILTER (WHERE ${toolCalls.success} = false)`,
			avg_duration_ms: avg(toolCalls.durationMs)
		})
		.from(toolCalls)
		.where(sql`${toolCalls.startedAt} >= CURRENT_DATE - INTERVAL '30 days'`)
		.groupBy(sql`DATE(${toolCalls.startedAt})`, toolCalls.tool)
		.orderBy(sql`DATE(${toolCalls.startedAt})`);

	return result.map((r) => ({
		date: r.date,
		tool: r.tool,
		call_count: Number(r.call_count),
		success_count: Number(r.success_count ?? 0),
		failure_count: Number(r.failure_count ?? 0),
		avg_duration_ms: Number(r.avg_duration_ms ?? 0)
	}));
});

// File type stats (language breakdown)
export const getFileTypeStats = query(async () => {
	const result = await db
		.select({
			file_extension: fileEdits.fileExtension,
			operation: fileEdits.operation,
			file_count: count(),
			lines_added: sum(fileEdits.linesAdded),
			lines_removed: sum(fileEdits.linesRemoved)
		})
		.from(fileEdits)
		.where(isNotNull(fileEdits.fileExtension))
		.groupBy(fileEdits.fileExtension, fileEdits.operation)
		.orderBy(desc(count()));

	return result.map((r) => ({
		file_extension: r.file_extension,
		operation: r.operation,
		file_count: Number(r.file_count),
		lines_added: Number(r.lines_added ?? 0),
		lines_removed: Number(r.lines_removed ?? 0),
		net_lines: Number(r.lines_added ?? 0) - Number(r.lines_removed ?? 0)
	}));
});

// File type summary (aggregated by extension)
export const getFileTypeSummary = query(async () => {
	const result = await db
		.select({
			file_extension: fileEdits.fileExtension,
			total_operations: count(),
			edit_count: sql<number>`COUNT(*) FILTER (WHERE ${fileEdits.operation} = 'edit')`,
			write_count: sql<number>`COUNT(*) FILTER (WHERE ${fileEdits.operation} = 'write')`,
			read_count: sql<number>`COUNT(*) FILTER (WHERE ${fileEdits.operation} = 'read')`,
			total_lines_added: sum(fileEdits.linesAdded),
			total_lines_removed: sum(fileEdits.linesRemoved)
		})
		.from(fileEdits)
		.where(isNotNull(fileEdits.fileExtension))
		.groupBy(fileEdits.fileExtension)
		.orderBy(desc(count()));

	return result.map((r) => ({
		file_extension: r.file_extension,
		total_operations: Number(r.total_operations),
		edit_count: Number(r.edit_count ?? 0),
		write_count: Number(r.write_count ?? 0),
		read_count: Number(r.read_count ?? 0),
		total_lines_added: Number(r.total_lines_added ?? 0),
		total_lines_removed: Number(r.total_lines_removed ?? 0),
		net_lines: Number(r.total_lines_added ?? 0) - Number(r.total_lines_removed ?? 0)
	}));
});

// File type stats over time
export const getFileTypeStatsOverTime = query(async () => {
	const result = await db
		.select({
			date: sql<string>`DATE(${fileEdits.createdAt})::text`,
			file_extension: fileEdits.fileExtension,
			file_count: count(),
			lines_added: sum(fileEdits.linesAdded),
			lines_removed: sum(fileEdits.linesRemoved)
		})
		.from(fileEdits)
		.where(
			sql`${fileEdits.createdAt} >= CURRENT_DATE - INTERVAL '30 days' AND ${fileEdits.fileExtension} IS NOT NULL`
		)
		.groupBy(sql`DATE(${fileEdits.createdAt})`, fileEdits.fileExtension)
		.orderBy(sql`DATE(${fileEdits.createdAt})`);

	return result.map((r) => ({
		date: r.date,
		file_extension: r.file_extension,
		file_count: Number(r.file_count),
		lines_added: Number(r.lines_added ?? 0),
		lines_removed: Number(r.lines_removed ?? 0)
	}));
});
