import type { Plugin } from "@opencode-ai/plugin";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { eq, and, sql } from "drizzle-orm";
import { join } from "path";
import { requests, sessions, dailySummary } from "../db/schema";

const DB_PATH = join(
  process.env.HOME || "~",
  ".config",
  "opencode",
  "token-usage.db"
);

// Track message start times for duration calculation
const messageStartTimes = new Map<string, number>();

// Track recorded messages to avoid duplicates
const recordedMessages = new Map<string, { input: number; output: number }>();

export const TokenTrackerPlugin: Plugin = async ({ directory }) => {
  const sqlite = new Database(DB_PATH, { strict: true });
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA synchronous = NORMAL");

  const db = drizzle(sqlite);

  return {
    event: async ({ event }) => {
      try {
        // Track when assistant messages start (for duration calculation)
        if (event.type === "message.part.updated") {
          const part = event.properties.part;
          if (part.type === "step-start") {
            messageStartTimes.set(part.messageID, Date.now());
          }
        }

        // Record token usage when assistant messages complete
        if (event.type === "message.updated") {
          const message = event.properties.info;

          // Only track assistant messages
          if (message.role !== "assistant") return;
          if (!message.tokens) return;

          // Skip if no tokens used yet
          if (message.tokens.input === 0 && message.tokens.output === 0) return;

          // Check if we've already recorded this exact state
          const recorded = recordedMessages.get(message.id);
          if (
            recorded &&
            recorded.input === message.tokens.input &&
            recorded.output === message.tokens.output
          ) {
            return;
          }

          const now = new Date();
          const timestamp = now.toISOString();
          const dateStr = timestamp.split("T")[0];

          // Calculate duration if we have start time
          const startTime = messageStartTimes.get(message.id);
          const durationMs = startTime ? Date.now() - startTime : null;
          if (startTime) {
            messageStartTimes.delete(message.id);
          }

          // Check if record exists
          const existing = db
            .select()
            .from(requests)
            .where(eq(requests.messageId, message.id))
            .get();

          if (existing) {
            // Calculate deltas for summary updates
            const deltaInput =
              message.tokens.input - (existing.tokensInput || 0);
            const deltaOutput =
              message.tokens.output - (existing.tokensOutput || 0);
            const deltaReasoning =
              message.tokens.reasoning - (existing.tokensReasoning || 0);
            const deltaCacheRead =
              message.tokens.cache.read - (existing.tokensCacheRead || 0);
            const deltaCacheWrite =
              message.tokens.cache.write - (existing.tokensCacheWrite || 0);
            const deltaCost = message.cost - (existing.costUsd || 0);

            // Update existing request
            db.update(requests)
              .set({
                tokensInput: message.tokens.input,
                tokensOutput: message.tokens.output,
                tokensReasoning: message.tokens.reasoning,
                tokensCacheRead: message.tokens.cache.read,
                tokensCacheWrite: message.tokens.cache.write,
                costUsd: message.cost,
                durationMs: durationMs,
                finishReason: message.finish || null,
                completedAt: message.time.completed
                  ? new Date(message.time.completed).toISOString()
                  : null,
              })
              .where(eq(requests.messageId, message.id))
              .run();

            if (deltaCost !== 0 || deltaInput !== 0 || deltaOutput !== 0) {
              // Update daily summary
              db.update(dailySummary)
                .set({
                  tokensInput: sql`${dailySummary.tokensInput} + ${deltaInput}`,
                  tokensOutput: sql`${dailySummary.tokensOutput} + ${deltaOutput}`,
                  tokensReasoning: sql`${dailySummary.tokensReasoning} + ${deltaReasoning}`,
                  tokensCacheRead: sql`${dailySummary.tokensCacheRead} + ${deltaCacheRead}`,
                  tokensCacheWrite: sql`${dailySummary.tokensCacheWrite} + ${deltaCacheWrite}`,
                  costUsd: sql`${dailySummary.costUsd} + ${deltaCost}`,
                })
                .where(
                  and(
                    eq(dailySummary.date, dateStr),
                    eq(dailySummary.providerId, message.providerID),
                    eq(dailySummary.modelId, message.modelID)
                  )
                )
                .run();

              // Update session
              db.update(sessions)
                .set({
                  totalCostUsd: sql`${sessions.totalCostUsd} + ${deltaCost}`,
                  totalTokensInput: sql`${sessions.totalTokensInput} + ${deltaInput}`,
                  totalTokensOutput: sql`${sessions.totalTokensOutput} + ${deltaOutput}`,
                  lastRequestAt: timestamp,
                })
                .where(eq(sessions.sessionId, message.sessionID))
                .run();
            }
          } else {
            // Insert new request
            db.insert(requests)
              .values({
                messageId: message.id,
                sessionId: message.sessionID,
                providerId: message.providerID,
                modelId: message.modelID,
                agent: message.mode,
                tokensInput: message.tokens.input,
                tokensOutput: message.tokens.output,
                tokensReasoning: message.tokens.reasoning,
                tokensCacheRead: message.tokens.cache.read,
                tokensCacheWrite: message.tokens.cache.write,
                costUsd: message.cost,
                durationMs: durationMs,
                finishReason: message.finish || null,
                workingDir: message.path?.cwd || directory,
                createdAt: timestamp,
                completedAt: message.time.completed
                  ? new Date(message.time.completed).toISOString()
                  : null,
              })
              .run();

            // Upsert session
            db.insert(sessions)
              .values({
                sessionId: message.sessionID,
                projectDir: message.path?.cwd || directory,
                firstRequestAt: timestamp,
                lastRequestAt: timestamp,
                totalRequests: 1,
                totalCostUsd: message.cost,
                totalTokensInput: message.tokens.input,
                totalTokensOutput: message.tokens.output,
              })
              .onConflictDoUpdate({
                target: sessions.sessionId,
                set: {
                  lastRequestAt: timestamp,
                  totalRequests: sql`${sessions.totalRequests} + 1`,
                  totalCostUsd: sql`${sessions.totalCostUsd} + ${message.cost}`,
                  totalTokensInput: sql`${sessions.totalTokensInput} + ${message.tokens.input}`,
                  totalTokensOutput: sql`${sessions.totalTokensOutput} + ${message.tokens.output}`,
                },
              })
              .run();

            // Upsert daily summary
            db.insert(dailySummary)
              .values({
                date: dateStr,
                providerId: message.providerID,
                modelId: message.modelID,
                requestCount: 1,
                tokensInput: message.tokens.input,
                tokensOutput: message.tokens.output,
                tokensReasoning: message.tokens.reasoning,
                tokensCacheRead: message.tokens.cache.read,
                tokensCacheWrite: message.tokens.cache.write,
                costUsd: message.cost,
              })
              .onConflictDoUpdate({
                target: [
                  dailySummary.date,
                  dailySummary.providerId,
                  dailySummary.modelId,
                ],
                set: {
                  requestCount: sql`${dailySummary.requestCount} + 1`,
                  tokensInput: sql`${dailySummary.tokensInput} + ${message.tokens.input}`,
                  tokensOutput: sql`${dailySummary.tokensOutput} + ${message.tokens.output}`,
                  tokensReasoning: sql`${dailySummary.tokensReasoning} + ${message.tokens.reasoning}`,
                  tokensCacheRead: sql`${dailySummary.tokensCacheRead} + ${message.tokens.cache.read}`,
                  tokensCacheWrite: sql`${dailySummary.tokensCacheWrite} + ${message.tokens.cache.write}`,
                  costUsd: sql`${dailySummary.costUsd} + ${message.cost}`,
                },
              })
              .run();
          }

          // Mark as recorded
          recordedMessages.set(message.id, {
            input: message.tokens.input,
            output: message.tokens.output,
          });
        }
      } catch (_err) {
        // Silently fail - don't break opencode
      }
    },
  };
};
