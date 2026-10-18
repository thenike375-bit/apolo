import { z } from "zod";
import { ltxRequestBody } from "./ltx-budget";

export class LtxError extends Error {
  constructor(public status: number, message: string, public kind = "") { super(message); }
}
const createdSchema = z.object({ id: z.string().min(1) });
const statusSchema = z.object({
  id: z.string(), status: z.enum(["pending", "processing", "completed", "failed"]),
  result: z.object({ video_url: z.string().url() }).optional(),
  error: z.object({ message: z.string(), type: z.string() }).optional(),
});
export function requireLtxKey() {
  const key = process.env["LTX_API_KEY"];
  if (!key) throw new LtxError(401, "Connect an LTX API key before preparing a demo. No paid fallback will be used.");
  return key;
}
async function ltxRequest(path: string, body?: unknown) {
  const response = await fetch(`https://api.ltx.io/v2/text-to-video${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${requireLtxKey()}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const value = await response.json().catch(() => null) as { error?: { message?: string; type?: string } } | null;
    throw new LtxError(response.status, value?.error?.message ?? `LTX request failed (${response.status})`, value?.error?.type ?? "");
  }
  return response;
}
export async function createLtxClip(prompt: string) {
  const response = await ltxRequest("", ltxRequestBody(prompt));
  return createdSchema.parse(await response.json());
}
export async function pollLtxClip(id: string) {
  return statusSchema.parse(await (await ltxRequest(`/${encodeURIComponent(id)}`)).json());
}
export async function downloadLtxClip(url: string) {
  const target = new URL(url);
  if (target.protocol !== "https:") throw new Error("LTX returned an unsafe video URL");
  // Signed provider output URL: never forward the API credential to the file host.
  const response = await fetch(target);
  if (!response.ok) throw new LtxError(response.status, `LTX footage download failed (${response.status}); the clip will not be regenerated.`);
  return response;
}