import type { Plugin } from "@opencode-ai/plugin";
import { join } from "path";

interface Config {
  apiUrl: string;
  apiKey: string;
}

const MAX_TOOL_OUTPUT_CHARS = 20_000;

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

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n… (truncated, ${text.length} chars total)`;
}

function extractPrompt(parts: any[]): string {
  const textParts = parts
    .filter((p) => p && p.type === "text" && !p.ignored)
    .map((p) => String(p.text ?? ""))
    .filter(Boolean);

  return textParts.join("\n").trim();
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
    // Raw event stream
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

          const timestamp = new Date().toISOString();

          // Calculate duration if we have start time
          const startTime = messageStartTimes.get(message.id);
          const durationMs = startTime ? Date.now() - startTime : null;
          if (startTime) {
            messageStartTimes.delete(message.id);
          }

          // Send event to API
          await sendEvent(config, {
            type: "request",
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
      } catch {
        // Silently fail - don't break opencode
      }
    },

    // User prompt capture
    "chat.message": async (input, output) => {
      try {
        const prompt = extractPrompt(output.parts);
        if (!prompt) return;

        await sendEvent(config, {
          type: "prompt",
          sessionId: input.sessionID,
          messageId: output.message.id,
          prompt,
          agent: output.message.agent,
          providerId: output.message.model.providerID,
          modelId: output.message.model.modelID,
          createdAt: new Date(output.message.time.created).toISOString(),
        });
      } catch {
        // ignore
      }
    },

    // Tool call capture
    "tool.execute.before": async (input, output) => {
      try {
        await sendEvent(config, {
          type: "tool.before",
          sessionId: input.sessionID,
          callId: input.callID,
          tool: input.tool,
          args: output.args,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    },

    "tool.execute.after": async (input, output) => {
      try {
        await sendEvent(config, {
          type: "tool.after",
          sessionId: input.sessionID,
          callId: input.callID,
          tool: input.tool,
          title: output.title,
          output: truncate(String(output.output ?? ""), MAX_TOOL_OUTPUT_CHARS),
          metadata: output.metadata,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    },

    // Final assistant text output
    "experimental.text.complete": async (input, output) => {
      try {
        await sendEvent(config, {
          type: "assistant.text",
          sessionId: input.sessionID,
          messageId: input.messageID,
          partId: input.partID,
          text: output.text,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    },
  };
};
