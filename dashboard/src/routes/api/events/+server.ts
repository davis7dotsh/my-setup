import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { requests, sessions, dailySummary } from "$lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { env } from "$env/dynamic/private";

interface AgentEvent {
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
}

export const POST: RequestHandler = async ({ request }) => {
  // Check API key
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing or invalid authorization" }, { status: 401 });
  }

  const providedKey = authHeader.slice(7);
  if (providedKey !== env.API_KEY) {
    return json({ error: "Invalid API key" }, { status: 403 });
  }

  let event: AgentEvent;
  try {
    event = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (
    !event.messageId ||
    !event.sessionId ||
    !event.providerId ||
    !event.modelId
  ) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const now = new Date();
    const timestamp = event.createdAt ? new Date(event.createdAt) : now;
    const dateStr = timestamp.toISOString().split("T")[0];

    // Check if record exists
    const existing = await db
      .select()
      .from(requests)
      .where(eq(requests.messageId, event.messageId))
      .limit(1);

    if (existing.length > 0) {
      const existingRecord = existing[0];

      // Calculate deltas for summary updates
      const deltaInput = event.tokens.input - (existingRecord.tokensInput || 0);
      const deltaOutput =
        event.tokens.output - (existingRecord.tokensOutput || 0);
      const deltaReasoning =
        event.tokens.reasoning - (existingRecord.tokensReasoning || 0);
      const deltaCacheRead =
        event.tokens.cache.read - (existingRecord.tokensCacheRead || 0);
      const deltaCacheWrite =
        event.tokens.cache.write - (existingRecord.tokensCacheWrite || 0);
      const deltaCost = event.cost - (existingRecord.costUsd || 0);

      // Update existing request
      await db
        .update(requests)
        .set({
          tokensInput: event.tokens.input,
          tokensOutput: event.tokens.output,
          tokensReasoning: event.tokens.reasoning,
          tokensCacheRead: event.tokens.cache.read,
          tokensCacheWrite: event.tokens.cache.write,
          costUsd: event.cost,
          durationMs: event.durationMs,
          finishReason: event.finishReason,
          completedAt: event.completedAt ? new Date(event.completedAt) : null,
        })
        .where(eq(requests.messageId, event.messageId));

      if (deltaCost !== 0 || deltaInput !== 0 || deltaOutput !== 0) {
        // Update daily summary
        await db
          .update(dailySummary)
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
              eq(dailySummary.providerId, event.providerId),
              eq(dailySummary.modelId, event.modelId)
            )
          );

        // Update session
        await db
          .update(sessions)
          .set({
            totalCostUsd: sql`${sessions.totalCostUsd} + ${deltaCost}`,
            totalTokensInput: sql`${sessions.totalTokensInput} + ${deltaInput}`,
            totalTokensOutput: sql`${sessions.totalTokensOutput} + ${deltaOutput}`,
            lastRequestAt: timestamp,
          })
          .where(eq(sessions.sessionId, event.sessionId));
      }
    } else {
      // Insert new request
      await db.insert(requests).values({
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
        completedAt: event.completedAt ? new Date(event.completedAt) : null,
      });

      // Upsert session
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
          totalTokensOutput: event.tokens.output,
        })
        .onConflictDoUpdate({
          target: sessions.sessionId,
          set: {
            lastRequestAt: timestamp,
            totalRequests: sql`${sessions.totalRequests} + 1`,
            totalCostUsd: sql`${sessions.totalCostUsd} + ${event.cost}`,
            totalTokensInput: sql`${sessions.totalTokensInput} + ${event.tokens.input}`,
            totalTokensOutput: sql`${sessions.totalTokensOutput} + ${event.tokens.output}`,
          },
        });

      // Upsert daily summary
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
          costUsd: event.cost,
        })
        .onConflictDoUpdate({
          target: [
            dailySummary.date,
            dailySummary.providerId,
            dailySummary.modelId,
          ],
          set: {
            requestCount: sql`${dailySummary.requestCount} + 1`,
            tokensInput: sql`${dailySummary.tokensInput} + ${event.tokens.input}`,
            tokensOutput: sql`${dailySummary.tokensOutput} + ${event.tokens.output}`,
            tokensReasoning: sql`${dailySummary.tokensReasoning} + ${event.tokens.reasoning}`,
            tokensCacheRead: sql`${dailySummary.tokensCacheRead} + ${event.tokens.cache.read}`,
            tokensCacheWrite: sql`${dailySummary.tokensCacheWrite} + ${event.tokens.cache.write}`,
            costUsd: sql`${dailySummary.costUsd} + ${event.cost}`,
          },
        });
    }

    return json({ success: true });
  } catch (e) {
    console.error("Database error:", e);
    return json({ error: "Failed to process event" }, { status: 500 });
  }
};
