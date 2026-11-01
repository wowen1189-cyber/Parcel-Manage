// AI providers and models a company can connect with its own key (CLAUDE.md rule 3). Prices are rough
// per-million-token estimates used only to enforce the company's monthly limit; the provider's bill is
// the source of truth.

export type Provider = "anthropic" | "openai" | "google" | "openai_compatible";

export const PROVIDERS: Record<Provider, { label: string; models: string[]; keyHint: string; keyUrl: string }> = {
  anthropic: { label: "Anthropic (Claude)", models: ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"], keyHint: "Starts with sk-ant-", keyUrl: "console.anthropic.com → Settings → API keys" },
  openai: { label: "OpenAI", models: ["gpt-5", "gpt-5-mini"], keyHint: "Starts with sk-", keyUrl: "platform.openai.com → API keys" },
  google: { label: "Google (Gemini)", models: ["gemini-2.5-pro", "gemini-2.5-flash"], keyHint: "From Google AI Studio", keyUrl: "aistudio.google.com → Get API key" },
  openai_compatible: { label: "Other (OpenAI-compatible)", models: [], keyHint: "Your provider's API key", keyUrl: "Your provider's dashboard" },
};

const PRICE_PER_MTOK: [RegExp, number, number][] = [
  [/haiku|mini|flash/i, 1, 5],
  [/opus/i, 15, 75],
  [/.*/, 3, 15],
];

/** Estimated cost in cents for a call. */
export function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const [, inp, out] = PRICE_PER_MTOK.find(([re]) => re.test(model))!;
  return Math.ceil(((inputTokens * inp + outputTokens * out) / 1_000_000) * 100);
}
