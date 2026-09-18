export type AIProviderId = "higgsfield" | "gemini" | "claude";

export type AIProvider = {
  id: AIProviderId;
  name: string;
  role: "video" | "llm";
  status: "CONFIGURED" | "NOT_CONNECTED";
  keyConfigured: boolean;
  envNames: string[];
  defaultModel?: string;
};

const definitions: Array<{
  id: AIProviderId;
  name: string;
  role: AIProvider["role"];
  envNames: string[];
  defaultModel?: string;
}> = [
  {
    id: "higgsfield",
    name: "Higgsfield",
    role: "video",
    envNames: ["HF_CREDENTIALS", "HF_KEY", "HIGGSFIELD_API_KEY"],
  },
  {
    id: "gemini",
    name: "Gemini",
    role: "llm",
    envNames: ["GEMINI_API_KEY"],
    defaultModel: "gemini-3.8-flash",
  },
  {
    id: "claude",
    name: "Claude",
    role: "llm",
    envNames: ["ANTHROPIC_API_KEY"],
    defaultModel: "claude-opus-5",
  },
];

export function getProviderCredential(id: AIProviderId) {
  const definition = definitions.find((item) => item.id === id);
  if (!definition) return undefined;
  for (const name of definition.envNames) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export function getAIProviders(): AIProvider[] {
  return definitions.map((item) => {
    const configured = Boolean(getProviderCredential(item.id));
    return {
      id: item.id,
      name: item.name,
      role: item.role,
      status: configured ? "CONFIGURED" : "NOT_CONNECTED",
      keyConfigured: configured,
      envNames: item.envNames,
      defaultModel: item.defaultModel,
    };
  });
}

export function isAIProviderId(value: string): value is AIProviderId {
  return definitions.some((provider) => provider.id === value);
}

export function getAIProvider(id: string) {
  return getAIProviders().find((provider) => provider.id === id);
}

export function canExecuteAI(id: string) {
  return getAIProvider(id)?.status === "CONFIGURED";
}
