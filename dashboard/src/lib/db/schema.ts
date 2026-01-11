import { pgTable, text, integer, doublePrecision, index, uniqueIndex, serial, timestamp } from "drizzle-orm/pg-core"

// Main requests table - one row per LLM call
export const requests = pgTable(
  "requests",
  {
    id: serial("id").primaryKey(),

    // Identifiers
    messageId: text("message_id").notNull().unique(),
    sessionId: text("session_id").notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    agent: text("agent").notNull(),

    // Token counts
    tokensInput: integer("tokens_input").notNull().default(0),
    tokensOutput: integer("tokens_output").notNull().default(0),
    tokensReasoning: integer("tokens_reasoning").notNull().default(0),
    tokensCacheRead: integer("tokens_cache_read").notNull().default(0),
    tokensCacheWrite: integer("tokens_cache_write").notNull().default(0),

    // Metrics
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    durationMs: integer("duration_ms"),
    finishReason: text("finish_reason"),

    // Context
    workingDir: text("working_dir"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_requests_session").on(table.sessionId),
    index("idx_requests_created").on(table.createdAt),
    index("idx_requests_provider_model").on(table.providerId, table.modelId),
    index("idx_requests_agent").on(table.agent),
  ]
)

// Sessions table for denormalized lookups
export const sessions = pgTable("sessions", {
  sessionId: text("session_id").primaryKey(),
  projectDir: text("project_dir"),
  title: text("title"),
  firstRequestAt: timestamp("first_request_at", { withTimezone: true }),
  lastRequestAt: timestamp("last_request_at", { withTimezone: true }),
  totalRequests: integer("total_requests").default(0),
  totalCostUsd: doublePrecision("total_cost_usd").default(0),
  totalTokensInput: integer("total_tokens_input").default(0),
  totalTokensOutput: integer("total_tokens_output").default(0),
})

// Daily summary for fast aggregation queries
export const dailySummary = pgTable(
  "daily_summary",
  {
    id: serial("id").primaryKey(),
    date: text("date").notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),

    requestCount: integer("request_count").default(0),
    tokensInput: integer("tokens_input").default(0),
    tokensOutput: integer("tokens_output").default(0),
    tokensReasoning: integer("tokens_reasoning").default(0),
    tokensCacheRead: integer("tokens_cache_read").default(0),
    tokensCacheWrite: integer("tokens_cache_write").default(0),
    costUsd: doublePrecision("cost_usd").default(0),
  },
  (table) => [
    index("idx_daily_date").on(table.date),
    uniqueIndex("idx_daily_unique").on(table.date, table.providerId, table.modelId),
  ]
)

// Type exports for querying
export type Request = typeof requests.$inferSelect
export type NewRequest = typeof requests.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type DailySummary = typeof dailySummary.$inferSelect
export type NewDailySummary = typeof dailySummary.$inferInsert
