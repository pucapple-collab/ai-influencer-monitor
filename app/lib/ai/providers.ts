export type AIProviderStatus =
  | "READY"
  | "NOT_CONNECTED"
  | "CONFIGURED"
  | "ERROR";

export type AIProvider = {
  id: string;
  name: string;
  role: "image" | "video" | "llm" | "automation";
  status: AIProviderStatus;
  keyConfigured: boolean;
};

export function getAIProviders(): AIProvider[] {
  return [
    {
      id: "higgsfield",
      name: "Higgsfield",
      role: "video",
      status: process.env.HIGGSFIELD_API_KEY
        ? "CONFIGURED"
        : "NOT_CONNECTED",
      keyConfigured: Boolean(process.env.HIGGSFIELD_API_KEY),
    },
    {
      id: "gemini",
      name: "Gemini",
      role: "llm",
      status: process.env.GEMINI_API_KEY
        ? "CONFIGURED"
        : "NOT_CONNECTED",
      keyConfigured: Boolean(process.env.GEMINI_API_KEY),
    },
    {
      id: "claude",
      name: "Claude",
      role: "llm",
      status: process.env.ANTHROPIC_API_KEY
        ? "CONFIGURED"
        : "NOT_CONNECTED",
      keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    {
      id: "automation",
      name: "Automation",
      role: "automation",
      status: process.env.N8N_WEBHOOK_URL
        ? "CONFIGURED"
        : "NOT_CONNECTED",
      keyConfigured: Boolean(process.env.N8N_WEBHOOK_URL),
    },
  ];
}
