import { json } from '@sveltejs/kit';
import { getDb, type DailySummary, type Request, type Session } from '$lib/server/db';

export function GET() {
	const db = getDb();

	try {
		// Get all daily summaries
		const dailySummaries = db
			.prepare(
				`
			SELECT * FROM daily_summary 
			ORDER BY date DESC
		`
			)
			.all() as DailySummary[];

		// Get recent requests (last 100)
		const recentRequests = db
			.prepare(
				`
			SELECT * FROM requests 
			ORDER BY created_at DESC 
			LIMIT 100
		`
			)
			.all() as Request[];

		// Get sessions
		const sessions = db
			.prepare(
				`
			SELECT * FROM sessions 
			ORDER BY last_request_at DESC 
			LIMIT 50
		`
			)
			.all() as Session[];

		// Aggregate totals
		const totals = db
			.prepare(
				`
			SELECT 
				COUNT(*) as total_requests,
				SUM(tokens_input) as total_input,
				SUM(tokens_output) as total_output,
				SUM(tokens_reasoning) as total_reasoning,
				SUM(tokens_cache_read) as total_cache_read,
				SUM(tokens_cache_write) as total_cache_write,
				SUM(cost_usd) as total_cost
			FROM requests
		`
			)
			.get() as {
			total_requests: number;
			total_input: number;
			total_output: number;
			total_reasoning: number;
			total_cache_read: number;
			total_cache_write: number;
			total_cost: number;
		};

		// Cost by model
		const costByModel = db
			.prepare(
				`
			SELECT 
				model_id,
				provider_id,
				COUNT(*) as request_count,
				SUM(tokens_input) as tokens_input,
				SUM(tokens_output) as tokens_output,
				SUM(cost_usd) as cost_usd
			FROM requests
			GROUP BY model_id, provider_id
			ORDER BY cost_usd DESC
		`
			)
			.all() as {
			model_id: string;
			provider_id: string;
			request_count: number;
			tokens_input: number;
			tokens_output: number;
			cost_usd: number;
		}[];

		// Usage by hour of day
		const usageByHour = db
			.prepare(
				`
			SELECT 
				CAST(strftime('%H', created_at) AS INTEGER) as hour,
				COUNT(*) as request_count,
				SUM(cost_usd) as cost_usd
			FROM requests
			GROUP BY hour
			ORDER BY hour
		`
			)
			.all() as { hour: number; request_count: number; cost_usd: number }[];

		// Tokens by hour (today)
		const tokensByHourToday = db
			.prepare(
				`
			SELECT 
				CAST(strftime('%H', created_at, 'localtime') AS INTEGER) as hour,
				COALESCE(SUM(tokens_input), 0) as tokens_input,
				COALESCE(SUM(tokens_output), 0) as tokens_output
			FROM requests
			WHERE date(created_at, 'localtime') = date('now', 'localtime')
			GROUP BY hour
			ORDER BY hour
		`
			)
			.all() as { hour: number; tokens_input: number; tokens_output: number }[];

		// Tokens by day (last 365 days)
		const tokensByDay = db
			.prepare(
				`
			SELECT
				date as date,
				COALESCE(SUM(tokens_input), 0) as tokens_input,
				COALESCE(SUM(tokens_output), 0) as tokens_output
			FROM daily_summary
			WHERE date >= date('now', '-365 days')
			GROUP BY date
			ORDER BY date ASC
		`
			)
			.all() as { date: string; tokens_input: number; tokens_output: number }[];

		// Usage by day of week
		const usageByDayOfWeek = db
			.prepare(
				`
			SELECT 
				CAST(strftime('%w', created_at) AS INTEGER) as day_of_week,
				COUNT(*) as request_count,
				SUM(cost_usd) as cost_usd
			FROM requests
			GROUP BY day_of_week
			ORDER BY day_of_week
		`
			)
			.all() as { day_of_week: number; request_count: number; cost_usd: number }[];

		// Cost over time (last 30 days)
		const costOverTime = db
			.prepare(
				`
			SELECT 
				date,
				SUM(request_count) as request_count,
				SUM(tokens_input) as tokens_input,
				SUM(tokens_output) as tokens_output,
				SUM(cost_usd) as cost_usd
			FROM daily_summary
			WHERE date >= date('now', '-30 days')
			GROUP BY date
			ORDER BY date ASC
		`
			)
			.all() as {
			date: string;
			request_count: number;
			tokens_input: number;
			tokens_output: number;
			cost_usd: number;
		}[];

		// Agent breakdown
		const agentBreakdown = db
			.prepare(
				`
			SELECT 
				agent,
				COUNT(*) as request_count,
				SUM(tokens_input) as tokens_input,
				SUM(tokens_output) as tokens_output,
				SUM(cost_usd) as cost_usd
			FROM requests
			GROUP BY agent
			ORDER BY cost_usd DESC
		`
			)
			.all() as {
			agent: string;
			request_count: number;
			tokens_input: number;
			tokens_output: number;
			cost_usd: number;
		}[];

		// Average response time by model
		const avgDurationByModel = db
			.prepare(
				`
			SELECT 
				model_id,
				AVG(duration_ms) as avg_duration_ms,
				COUNT(*) as request_count
			FROM requests
			WHERE duration_ms IS NOT NULL
			GROUP BY model_id
			ORDER BY avg_duration_ms DESC
		`
			)
			.all() as { model_id: string; avg_duration_ms: number; request_count: number }[];

		db.close();

		return json({
			totals,
			dailySummaries,
			recentRequests,
			sessions,
			costByModel,
			usageByHour,
			tokensByHourToday,
			tokensByDay,
			usageByDayOfWeek,
			costOverTime,
			agentBreakdown,
			avgDurationByModel
		});
	} catch (e) {
		db.close();
		console.error('Database error:', e);
		return json({ error: 'Failed to fetch stats' }, { status: 500 });
	}
}
