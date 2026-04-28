import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) _client = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });
  return _client;
}

/**
 * Gera embedding 768d com gemini-embedding-001.
 * Truncamos textos > 2000 chars (limite seguro).
 */
export async function embed(text: string): Promise<number[]> {
  const t = text.slice(0, 2000);
  const res = await client().models.embedContent({
    model: env.GEMINI_EMBED_MODEL,
    contents: t,
  });
  // res.embeddings: [{ values: number[] }]
  const values = res.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("embedding_empty");
  }
  return values;
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  // Gemini embed API atual nao tem batch — chama em paralelo limitado
  const out: number[][] = [];
  const batchSize = 5;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((t) => embed(t)));
    out.push(...results);
  }
  return out;
}
