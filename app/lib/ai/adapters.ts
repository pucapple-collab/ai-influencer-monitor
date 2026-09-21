
import { createHiggsfieldClient } from "@higgsfield/client/v2";
import { getHiggsfieldCredential, getProviderCredential } from "./providers";

export type AIProviderId = "higgsfield" | "gemini" | "claude";

export type AIExecutionInput = {
  prompt: string;
  model?: string;
};

export type AIExecutionResult = {
  provider: AIProviderId;
  executed: boolean;
  status: "READY" | "NOT_CONNECTED" | "COMPLETED" | "ERROR";
  output?: string;
  requestId?: string;
  estimatedCost: number;
  error?: string;
};

const REQUEST_TIMEOUT_MS = 45_000;

async function providerFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export interface AIAdapter {
  execute(input: AIExecutionInput): Promise<AIExecutionResult>;
}

function missing(
  provider: AIProviderId
): AIExecutionResult {
  return {
    provider,
    executed: false,
    status: "NOT_CONNECTED",
    estimatedCost: 0,
    error: `${provider} API credentials are not configured.`,
  };
}

export const adapters: Record<AIProviderId, AIAdapter> = {
  gemini: {
    async execute(input) {
      const key = getProviderCredential("gemini");

      if (!key) return missing("gemini");

      const model =
        input.model ||
        process.env.GEMINI_MODEL ||
        "gemini-3.8-flash";

      const response = await providerFetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ model, input: input.prompt }),
        }
      );

      if (!response.ok) {
        return {
          provider: "gemini",
          executed: true,
          status: "ERROR",
          estimatedCost: 0,
          error: `Gemini HTTP ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        provider: "gemini",
        executed: true,
        status: "COMPLETED",
        estimatedCost: 0,
        output: data?.output_text ?? data?.outputs?.map((item: { text?: string }) => item.text ?? "").join("\n") ?? "",
      };
    },
  },

  claude: {
    async execute(input) {
      const key = getProviderCredential("claude");

      if (!key) return missing("claude");

      const model =
        input.model ||
        process.env.ANTHROPIC_MODEL ||
        "claude-opus-5";

      const response = await providerFetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: input.prompt,
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        return {
          provider: "claude",
          executed: true,
          status: "ERROR",
          estimatedCost: 0,
          error: `Claude HTTP ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        provider: "claude",
        executed: true,
        status: "COMPLETED",
        estimatedCost: 0,
        output:
          data?.content?.find(
            (item: { type?: string }) => item.type === "text"
          )?.text ?? "",
      };
    },
  },

  higgsfield: {
    async execute(input) {
      const credentials = getHiggsfieldCredential();
      if (!credentials) return missing("higgsfield");
      const model = input.model || process.env.HIGGSFIELD_MODEL || "bytedance/seedance-2.5/text-to-video";
      try {
        const client = createHiggsfieldClient({
          credentials,
          timeout: 120_000,
          maxRetries: 3,
          retryBackoff: 1_000,
          retryMaxBackoff: 30_000,
          pollInterval: 2_000,
          maxPollTime: 300_000,
        });
        const result = await client.subscribe(model, {
          input: {
            prompt: input.prompt,
            duration: 5,
            resolution: "720p",
            aspect_ratio: "9:16",
            output_format: "mp4",
            generate_audio: true,
          },
          withPolling: true,
        });
        const job = result.jobs?.[0];
        const url = job?.results?.raw?.url;
        if (!result.isCompleted || !url) {
          return {
            provider: "higgsfield",
            executed: true,
            status: "ERROR",
            requestId: result.id,
            estimatedCost: 0,
            error: result.isNsfw ? "Higgsfield generation was blocked by safety checks." : "Higgsfield generation did not return a completed media URL.",
          };
        }
        return {
          provider: "higgsfield",
          executed: true,
          status: "COMPLETED",
          requestId: result.id,
          estimatedCost: 0,
          output: url,
        };
      } catch (error) {
        return {
          provider: "higgsfield",
          executed: true,
          status: "ERROR",
          estimatedCost: 0,
          error: error instanceof Error ? error.message : "Higgsfield generation failed.",
        };
      }
    },
  },
};
