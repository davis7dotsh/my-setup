import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { requests, sessions, dailySummary } from "$lib/db/schema";
import { desc, sql, sum, count, avg } from "drizzle-orm";

export async function GET() {
  try {
    // Get all daily summaries
    const dailySummaries = await db
      .select()
      .from(dailySummary)
      .orderBy(desc(dailySummary.date));

    // Get recent requests (last 100)
    const recentRequests = await db
      .select()
      .from(requests)
      .orderBy(desc(requests.createdAt))
      .limit(100);

    // Get sessions
    const sessionsList = await db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.lastRequestAt))
      .limit(50);

    // Aggregate totals
    const totalsResult = await db
      .select({
        total_requests: count(),
        total_input: sum(requests.tokensInput),
        total_output: sum(requests.tokensOutput),
        total_reasoning: sum(requests.tokensReasoning),
        total_cache_read: sum(requests.tokensCacheRead),
        total_cache_write: sum(requests.tokensCacheWrite),
        total_cost: sum(requests.costUsd),
      })
      .from(requests);

    const totals = {
      total_requests: Number(totalsResult[0]?.total_requests ?? 0),
      total_input: Number(totalsResult[0]?.total_input ?? 0),
      total_output: Number(totalsResult[0]?.total_output ?? 0),
      total_reasoning: Number(totalsResult[0]?.total_reasoning ?? 0),
      total_cache_read: Number(totalsResult[0]?.total_cache_read ?? 0),
      total_cache_write: Number(totalsResult[0]?.total_cache_write ?? 0),
      total_cost: Number(totalsResult[0]?.total_cost ?? 0),
    };

    // Cost by model
    const costByModel = await db
      .select({
        model_id: requests.modelId,
        provider_id: requests.providerId,
        request_count: count(),
        tokens_input: sum(requests.tokensInput),
        tokens_output: sum(requests.tokensOutput),
        cost_usd: sum(requests.costUsd),
      })
      .from(requests)
      .groupBy(requests.modelId, requests.providerId)
      .orderBy(desc(sum(requests.costUsd)));

    // Usage by hour of day
    const usageByHour = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${requests.createdAt})::int`,
        request_count: count(),
        cost_usd: sum(requests.costUsd),
      })
      .from(requests)
      .groupBy(sql`EXTRACT(HOUR FROM ${requests.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${requests.createdAt})`);

    // Tokens by hour (today)
    const tokensByHourToday = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${requests.createdAt})::int`,
        tokens_input: sql<number>`COALESCE(SUM(${requests.tokensInput}), 0)`,
        tokens_output: sql<number>`COALESCE(SUM(${requests.tokensOutput}), 0)`,
      })
      .from(requests)
      .where(sql`DATE(${requests.createdAt}) = CURRENT_DATE`)
      .groupBy(sql`EXTRACT(HOUR FROM ${requests.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${requests.createdAt})`);

    // Tokens by day (last 365 days)
    const tokensByDay = await db
      .select({
        date: dailySummary.date,
        tokens_input: sql<number>`COALESCE(SUM(${dailySummary.tokensInput}), 0)`,
        tokens_output: sql<number>`COALESCE(SUM(${dailySummary.tokensOutput}), 0)`,
      })
      .from(dailySummary)
      .where(sql`${dailySummary.date}::date >= CURRENT_DATE - INTERVAL '365 days'`)
      .groupBy(dailySummary.date)
      .orderBy(dailySummary.date);

    // Usage by day of week
    const usageByDayOfWeek = await db
      .select({
        day_of_week: sql<number>`EXTRACT(DOW FROM ${requests.createdAt})::int`,
        request_count: count(),
        cost_usd: sum(requests.costUsd),
      })
      .from(requests)
      .groupBy(sql`EXTRACT(DOW FROM ${requests.createdAt})`)
      .orderBy(sql`EXTRACT(DOW FROM ${requests.createdAt})`);

    // Cost over time (last 30 days)
    const costOverTime = await db
      .select({
        date: dailySummary.date,
        request_count: sum(dailySummary.requestCount),
        tokens_input: sum(dailySummary.tokensInput),
        tokens_output: sum(dailySummary.tokensOutput),
        cost_usd: sum(dailySummary.costUsd),
      })
      .from(dailySummary)
      .where(sql`${dailySummary.date}::date >= CURRENT_DATE - INTERVAL '30 days'`)
      .groupBy(dailySummary.date)
      .orderBy(dailySummary.date);

    // Agent breakdown
    const agentBreakdown = await db
      .select({
        agent: requests.agent,
        request_count: count(),
        tokens_input: sum(requests.tokensInput),
        tokens_output: sum(requests.tokensOutput),
        cost_usd: sum(requests.costUsd),
      })
      .from(requests)
      .groupBy(requests.agent)
      .orderBy(desc(sum(requests.costUsd)));

    // Average response time by model
    const avgDurationByModel = await db
      .select({
        model_id: requests.modelId,
        avg_duration_ms: avg(requests.durationMs),
        request_count: count(),
      })
      .from(requests)
      .where(sql`${requests.durationMs} IS NOT NULL`)
      .groupBy(requests.modelId)
      .orderBy(desc(avg(requests.durationMs)));

    return json({
      totals,
      dailySummaries,
      recentRequests,
      sessions: sessionsList,
      costByModel,
      usageByHour,
      tokensByHourToday,
      tokensByDay,
      usageByDayOfWeek,
      costOverTime,
      agentBreakdown,
      avgDurationByModel,
    });
  } catch (e) {
    console.error("Database error:", e);
    return json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
