import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createAiGatewayProvider(apiKey: string) {
  const baseURL = process.env.AI_GATEWAY_URL || "https://ai.gateway.lovable.dev/v1";
  return createOpenAICompatible({
    name: "ai-gateway",
    baseURL,
    supportsStructuredOutputs: false,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Lovable-API-Key": apiKey,
    },
  });
}

// Alias for backwards compatibility
export const createLovableAiGatewayProvider = createAiGatewayProvider;
