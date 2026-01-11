import type { Plugin } from "@opencode-ai/plugin";
import { join } from "path";

interface Config {
  apiUrl: string;
  apiKey: string;
}

// Track message start times for duration calculation
const messageStartTimes = new Map<string, number>();

// Track recorded messages to avoid duplicates
const recordedMessages = new Map<string, { input: number; output: number }>();

async function loadConfig(): Promise<Config | null> {
  const configPath = join(import.meta.dir, "..", "token-tracker.json");
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    return null;
  }

  try {
    return await file.json();
  } catch {
    return null;
  }
}

async function sendEvent(config: Config, event: object): Promise<void> {
  try {
    await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(event),
    });
  } catch {
    // Silently fail - don't break opencode
  }
}

export const TokenTrackerPlugin: Plugin = async ({ directory }) => {
  const config = await loadConfig();

  if (!config) {
    // No config, plugin is disabled
    return {
      event: async () => {},
    };
  }

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

          // Calculate duration if we have start time
          const startTime = messageStartTimes.get(message.id);
          const durationMs = startTime ? Date.now() - startTime : null;
          if (startTime) {
            messageStartTimes.delete(message.id);
          }

          // Send event to API
          await sendEvent(config, {
            messageId: message.id,
            sessionId: message.sessionID,
            providerId: message.providerID,
            modelId: message.modelID,
            agent: message.mode,
            tokens: {
              input: message.tokens.input,
              output: message.tokens.output,
              reasoning: message.tokens.reasoning,
              cache: {
                read: message.tokens.cache.read,
                write: message.tokens.cache.write,
              },
            },
            cost: message.cost,
            durationMs: durationMs,
            finishReason: message.finish || null,
            workingDir: message.path?.cwd || directory,
            createdAt: timestamp,
            completedAt: message.time.completed
              ? new Date(message.time.completed).toISOString()
              : null,
          });

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
