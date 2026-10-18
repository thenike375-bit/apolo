import type { BoardCard } from "./learning.server";

export type NarratedCard = BoardCard & { narration?: string };

/** Keep the complete explanation, rather than reading shortened display bullets. */
export function narrationForCard(card: NarratedCard) {
  return card.narration ?? [card.title, ...card.points, card.formula, card.analogy].filter(Boolean).join(". ");
}

export function narrationChunks(text: string, limit = 2300): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let chunk = "";
  for (const word of words) {
    if (chunk && chunk.length + word.length + 1 > limit) {
      chunks.push(chunk);
      chunk = "";
    }
    // A single unusually long token must not be silently truncated either.
    if (word.length > limit) {
      if (chunk) { chunks.push(chunk); chunk = ""; }
      for (let i = 0; i < word.length; i += limit) chunks.push(word.slice(i, i + limit));
    } else chunk = chunk ? `${chunk} ${word}` : word;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}