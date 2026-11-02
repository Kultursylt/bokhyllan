// Tunt lager runt Claudes Messages API.

export const MODEL = Deno.env.get("BOKHYLLAN_MODEL") ?? "claude-sonnet-5-5";

// deno-lint-ignore no-explicit-any
type Block = any;

export interface ClaudeRequest {
  system?: string;
  messages: { role: "user" | "assistant"; content: Block }[];
  tools?: Block[];
  tool_choice?: Block;
  max_tokens?: number;
  model?: string;
}

export async function claude(req: ClaudeRequest): Promise<Block> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY saknas — lägg in den som secret i Supabase.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: req.model ?? MODEL,
      max_tokens: req.max_tokens ?? 4096,
      system: req.system,
      messages: req.messages,
      tools: req.tools,
      tool_choice: req.tool_choice,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? res.statusText;
    throw new Error(`Claude svarade ${res.status}: ${msg}`);
  }
  return data;
}

/** Hämtar indata från första anropet av ett visst verktyg i svaret. */
export function toolInput(response: Block, name: string): Block | null {
  const block = (response?.content ?? []).find(
    (b: Block) => b.type === "tool_use" && b.name === name,
  );
  return block?.input ?? null;
}

/** Bild som base64 för Messages API, kodad i bitar så stora bilder inte spräcker stacken. */
export function imageBlock(bytes: Uint8Array, mediaType = "image/jpeg"): Block {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { type: "image", source: { type: "base64", media_type: mediaType, data: btoa(bin) } };
}
