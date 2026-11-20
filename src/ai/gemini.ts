const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export interface TextModel {
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
}

/** Minimal Gemini REST client (no SDK). The key is sent in a header, never in the URL. */
export class GeminiModel implements TextModel {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 400,
          // Voice needs low latency: skip "thinking" on 2.5 Flash models.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const payload = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${payload.error?.message ?? "unknown error"}`);

    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!text) throw new Error("Gemini returned no text");
    return text;
  }
}
