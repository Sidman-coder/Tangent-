// Shared parser for Anthropic structured-outputs responses (output_config.format).
// The API guarantees valid JSON matching the request's schema in the first text
// block, except when stop_reason is "refusal" — a Claude 4+ safety intervention
// that can override schema compliance. This is the one fallback path that's still
// needed once responses are schema-constrained.
type AnthropicStructuredResponse = {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  stop_details?: { type: string; reason?: string } | null;
};

export function extractStructuredJson<T>(data: AnthropicStructuredResponse): T {
  if (data.stop_reason === "refusal") {
    throw new Error(data.stop_details?.reason || "Claude declined to respond to that request.");
  }
  const text = data.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Unexpected Anthropic response structure");
  }
  return JSON.parse(text) as T;
}
