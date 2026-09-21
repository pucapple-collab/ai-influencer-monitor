export type AIProviderId = "higgsfield" | "gemini" | "claude";

export type AIProvider = {
  id: AIProviderId;
  name: string;
  role: "video" | "llm";
  status: "CONFIGURED" | "NOT_CONNECTED";
  keyConfigured: boolean;
  envNames: string[];
  defaultModel?: string;
  executionImplemented: boolean;
};

const definitions: Array<{
  id: AIProviderId;
  name: string;
  role: AIProvider["role"];
  envNames: string[];
  defaultModel?: string;
  executionImplemented: boolean;
}> = [
  {
    id: "higgsfield",
    name: "Higgsfield",
    role: "video",
    envNames: ["HF_CREDENTIALS", "HF_API_KEY_ID"],
    // Credentials alone do not make Higgsfield executable.
    // Keep this false until the project owns a verified async submit/poll adapter.
    executionImplemented: false,
  },
  {
    id: "gemini",
    name: "Gemini",
    role: "llm",
    envNames: ["GEMINI_API_KEY"],
    defaultModel: "gemini-3.8-flash",
    executionImplemented: true,
  },
  {
    id: "claude",
    name: "Claude",
    role: "llm",
    envNames: ["ANTHROPIC_API_KEY"],
    defaultModel: "claude-opus-5",
    executionImplemented: true,
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
      executionImplemented: item.executionImplemented,
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
  const provider = getAIProvider(id);
  return provider?.status === "CONFIGURED" && provider.executionImplemented;
}

export function getHiggsfieldCredential() {
  if (process.env.HF_CREDENTIALS) return process.env.HF_CREDENTIALS;
  const id = process.env.HF_API_KEY_ID;
  const secret = process.env.HF_API_KEY_SECRET;
  return id && secret ? `${id}:${secret}` : undefined;
}
