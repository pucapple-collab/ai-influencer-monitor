
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
      const key = process.env.GEMINI_API_KEY;

      if (!key) return missing("gemini");

      const model =
        input.model ||
        process.env.GEMINI_MODEL ||
        "gemini-3.8-flash";

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: input.prompt }],
              },
            ],
          }),
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
        output:
          data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
      };
    },
  },

  claude: {
    async execute(input) {
      const key = process.env.ANTHROPIC_API_KEY;

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
      const credentials =
        process.env.HF_CREDENTIALS ||
        process.env.HF_KEY;

      if (!credentials) return missing("higgsfield");

      return {
        provider: "higgsfield",
        executed: false,
        status: "READY",
        estimatedCost: 0,
        error:
          "Higgsfield credentials detected. Video adapter requires an explicit model selection before billing execution.",
      };
    },
  },
};
