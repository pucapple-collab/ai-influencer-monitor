export type AIProviderId = "higgsfield" | "gemini" | "claude";

export type AIProvider = {
  id: AIProviderId;
  name: string;
  role: "video" | "llm";
  status: "CONFIGURED" | "NOT_CONNECTED";
  keyConfigured: boolean;
};

const definitions: Array<{
  id: AIProviderId;
  name: string;
  role: AIProvider["role"];
  env: string;
}> = [
  {
    id: "higgsfield",
    name: "Higgsfield",
    role: "video",
    env: "HIGGSFIELD_API_KEY",
  },
  {
    id: "gemini",
    name: "Gemini",
    role: "llm",
    env: "GEMINI_API_KEY",
  },
  {
    id: "claude",
    name: "Claude",
    role: "llm",
    env: "ANTHROPIC_API_KEY",
  },
];

export function getAIProviders(): AIProvider[] {
  return definitions.map((item) => {
    const configured = Boolean(process.env[item.env]);

    return {
      id: item.id,
      name: item.name,
      role: item.role,
      status: configured ? "CONFIGURED" : "NOT_CONNECTED",
      keyConfigured: configured,
    };
  });
}

export function getAIProvider(id: string) {
  return getAIProviders().find((provider) => provider.id === id);
}

export function canExecuteAI(id: string) {
  return getAIProvider(id)?.status === "CONFIGURED";
}
