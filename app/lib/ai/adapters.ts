
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

      const response = await fetch(
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

      const response = await fetch(
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
    async execute() {
      const credentials = getHiggsfieldCredential();
      if (!credentials) return missing("higgsfield");
      return {
        provider: "higgsfield",
        executed: false,
        status: "READY",
        estimatedCost: 0,
        error: "Higgsfield credentials are configured, but real media execution remains locked until the official project adapter is verified.",
      };
    },
  }
};
