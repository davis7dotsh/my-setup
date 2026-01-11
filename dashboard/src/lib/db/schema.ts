import {
	pgTable,
	text,
	integer,
	doublePrecision,
	index,
	uniqueIndex,
	serial,
	timestamp,
	jsonb,
	boolean
} from 'drizzle-orm/pg-core';

// Main requests table - one row per LLM call
export const requests = pgTable(
	'requests',
	{
		id: serial('id').primaryKey(),

		// Identifiers
		messageId: text('message_id').notNull().unique(),
		sessionId: text('session_id').notNull(),
		providerId: text('provider_id').notNull(),
		modelId: text('model_id').notNull(),
		agent: text('agent').notNull(),

		// Token counts
		tokensInput: integer('tokens_input').notNull().default(0),
		tokensOutput: integer('tokens_output').notNull().default(0),
		tokensReasoning: integer('tokens_reasoning').notNull().default(0),
		tokensCacheRead: integer('tokens_cache_read').notNull().default(0),
		tokensCacheWrite: integer('tokens_cache_write').notNull().default(0),

		// Metrics
		costUsd: doublePrecision('cost_usd').notNull().default(0),
		durationMs: integer('duration_ms'),
		finishReason: text('finish_reason'),

		// Context
		workingDir: text('working_dir'),

		// Timestamps
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		completedAt: timestamp('completed_at', { withTimezone: true })
	},
	(table) => [
		index('idx_requests_session').on(table.sessionId),
		index('idx_requests_created').on(table.createdAt),
		index('idx_requests_provider_model').on(table.providerId, table.modelId),
		index('idx_requests_agent').on(table.agent)
	]
);

// Sessions table for denormalized lookups
export const sessions = pgTable('sessions', {
	sessionId: text('session_id').primaryKey(),
	projectDir: text('project_dir'),
	title: text('title'),
	firstRequestAt: timestamp('first_request_at', { withTimezone: true }),
	lastRequestAt: timestamp('last_request_at', { withTimezone: true }),
	totalRequests: integer('total_requests').default(0),
	totalCostUsd: doublePrecision('total_cost_usd').default(0),
	totalTokensInput: integer('total_tokens_input').default(0),
	totalTokensOutput: integer('total_tokens_output').default(0)
});

// Daily summary for fast aggregation queries
export const dailySummary = pgTable(
	'daily_summary',
	{
		id: serial('id').primaryKey(),
		date: text('date').notNull(),
		providerId: text('provider_id').notNull(),
		modelId: text('model_id').notNull(),

		requestCount: integer('request_count').default(0),
		tokensInput: integer('tokens_input').default(0),
		tokensOutput: integer('tokens_output').default(0),
		tokensReasoning: integer('tokens_reasoning').default(0),
		tokensCacheRead: integer('tokens_cache_read').default(0),
		tokensCacheWrite: integer('tokens_cache_write').default(0),
		costUsd: doublePrecision('cost_usd').default(0)
	},
	(table) => [
		index('idx_daily_date').on(table.date),
		uniqueIndex('idx_daily_unique').on(table.date, table.providerId, table.modelId)
	]
);

// Turns - one row per user prompt -> assistant response
export const turns = pgTable(
	'turns',
	{
		id: serial('id').primaryKey(),
		sessionId: text('session_id').notNull(),
		userMessageId: text('user_message_id'),
		assistantMessageId: text('assistant_message_id'),

		// Context
		agent: text('agent'),
		providerId: text('provider_id'),
		modelId: text('model_id'),

		// Content
		prompt: text('prompt').notNull(),
		assistantText: text('assistant_text'),

		// Token counts (copied from assistant request)
		tokensInput: integer('tokens_input').notNull().default(0),
		tokensOutput: integer('tokens_output').notNull().default(0),
		tokensReasoning: integer('tokens_reasoning').notNull().default(0),
		tokensCacheRead: integer('tokens_cache_read').notNull().default(0),
		tokensCacheWrite: integer('tokens_cache_write').notNull().default(0),

		// Metrics
		costUsd: doublePrecision('cost_usd').notNull().default(0),
		durationMs: integer('duration_ms'),
		finishReason: text('finish_reason'),

		// Timestamps
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		completedAt: timestamp('completed_at', { withTimezone: true })
	},
	(table) => [
		index('idx_turns_session').on(table.sessionId),
		uniqueIndex('idx_turns_user_message').on(table.userMessageId),
		uniqueIndex('idx_turns_assistant_message').on(table.assistantMessageId)
	]
);

// Tool calls captured during a turn
export const toolCalls = pgTable(
	'tool_calls',
	{
		id: serial('id').primaryKey(),
		sessionId: text('session_id').notNull(),
		turnId: integer('turn_id').references(() => turns.id, { onDelete: 'set null' }),
		callId: text('call_id').notNull(),
		tool: text('tool').notNull(),

		args: jsonb('args'),
		title: text('title'),
		output: text('output'),
		metadata: jsonb('metadata'),

		// Execution metrics
		durationMs: integer('duration_ms'),
		success: boolean('success'),
		errorMessage: text('error_message'),

		startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
		completedAt: timestamp('completed_at', { withTimezone: true })
	},
	(table) => [
		index('idx_tool_calls_session').on(table.sessionId),
		index('idx_tool_calls_turn').on(table.turnId),
		index('idx_tool_calls_tool').on(table.tool),
		uniqueIndex('idx_tool_calls_call_id').on(table.callId)
	]
);

// Assistant text parts (final text output per message/part)
export const assistantTextParts = pgTable(
	'assistant_text_parts',
	{
		id: serial('id').primaryKey(),
		sessionId: text('session_id').notNull(),
		messageId: text('message_id').notNull(),
		partId: text('part_id').notNull(),
		text: text('text').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull()
	},
	(table) => [
		index('idx_assistant_text_parts_session').on(table.sessionId),
		index('idx_assistant_text_parts_message').on(table.messageId),
		uniqueIndex('idx_assistant_text_parts_unique').on(table.messageId, table.partId)
	]
);

// File edits - track file operations for language/file type stats
export const fileEdits = pgTable(
	'file_edits',
	{
		id: serial('id').primaryKey(),
		sessionId: text('session_id').notNull(),
		turnId: integer('turn_id').references(() => turns.id, { onDelete: 'set null' }),
		toolCallId: integer('tool_call_id').references(() => toolCalls.id, { onDelete: 'set null' }),

		// File info
		filePath: text('file_path').notNull(),
		fileExtension: text('file_extension'),
		operation: text('operation').notNull(), // 'edit', 'write', 'read'

		// Change metrics (for edit/write operations)
		linesAdded: integer('lines_added'),
		linesRemoved: integer('lines_removed'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull()
	},
	(table) => [
		index('idx_file_edits_session').on(table.sessionId),
		index('idx_file_edits_extension').on(table.fileExtension),
		index('idx_file_edits_operation').on(table.operation),
		index('idx_file_edits_created').on(table.createdAt)
	]
);

// Prompt outcomes - track which prompts led to success
export const promptOutcomes = pgTable(
	'prompt_outcomes',
	{
		id: serial('id').primaryKey(),
		sessionId: text('session_id').notNull(),
		turnId: integer('turn_id').references(() => turns.id, { onDelete: 'cascade' }),

		// Prompt info
		promptHash: text('prompt_hash').notNull(), // Hash for similarity grouping
		promptLength: integer('prompt_length').notNull(),
		promptPreview: text('prompt_preview').notNull(), // First 500 chars

		// Outcome metrics
		toolCallCount: integer('tool_call_count').default(0),
		successfulToolCalls: integer('successful_tool_calls').default(0),
		failedToolCalls: integer('failed_tool_calls').default(0),
		filesEdited: integer('files_edited').default(0),
		tokensUsed: integer('tokens_used').default(0),
		costUsd: doublePrecision('cost_usd').default(0),

		// User feedback (can be updated later)
		userRating: integer('user_rating'), // 1-5 scale, null if not rated
		markedSuccessful: boolean('marked_successful'), // Explicit success/fail flag

		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		completedAt: timestamp('completed_at', { withTimezone: true })
	},
	(table) => [
		index('idx_prompt_outcomes_session').on(table.sessionId),
		index('idx_prompt_outcomes_hash').on(table.promptHash),
		index('idx_prompt_outcomes_created').on(table.createdAt)
	]
);

// Type exports for querying
export type Request = typeof requests.$inferSelect;
export type NewRequest = typeof requests.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type DailySummary = typeof dailySummary.$inferSelect;
export type NewDailySummary = typeof dailySummary.$inferInsert;
export type Turn = typeof turns.$inferSelect;
export type NewTurn = typeof turns.$inferInsert;
export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;
export type AssistantTextPart = typeof assistantTextParts.$inferSelect;
export type NewAssistantTextPart = typeof assistantTextParts.$inferInsert;
export type FileEdit = typeof fileEdits.$inferSelect;
export type NewFileEdit = typeof fileEdits.$inferInsert;
export type PromptOutcome = typeof promptOutcomes.$inferSelect;
export type NewPromptOutcome = typeof promptOutcomes.$inferInsert;
