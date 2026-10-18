import { afterEach, describe, expect, it, vi } from "vitest";
import { createLtxClip, downloadLtxClip, pollLtxClip } from "./ltx-video.server";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("LTX video adapter", () => {
  it("submits once and reads the same saved provider job", async () => {
    vi.stubEnv("LTX_API_KEY", "test-only-credential");
    const request = vi.fn().mockResolvedValueOnce(Response.json({ id: "job-1" }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ id: "job-1", status: "completed", result: { video_url: "https://example.test/clip.mp4" } }));
    vi.stubGlobal("fetch", request);
    expect(await createLtxClip("DNA replication")).toEqual({ id: "job-1" });
    expect((await pollLtxClip("job-1")).status).toBe("completed");
    expect(request.mock.calls[0]?.[0]).toBe("https://api.ltx.io/v2/text-to-video");
    expect(request.mock.calls[1]?.[0]).toBe("https://api.ltx.io/v2/text-to-video/job-1");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("preserves insufficient credit errors without retries or fallback", async () => {
    vi.stubEnv("LTX_API_KEY", "test-only-credential");
    const request = vi.fn().mockResolvedValue(Response.json({ error: { message: "Insufficient credits", type: "insufficient_funds_error" } }, { status: 402 }));
    vi.stubGlobal("fetch", request);
    await expect(createLtxClip("DNA replication")).rejects.toMatchObject({ status: 402, message: "Insufficient credits" });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not send the API key to the signed video host", async () => {
    const request = vi.fn().mockResolvedValue(new Response("video"));
    vi.stubGlobal("fetch", request);
    await downloadLtxClip("https://example.test/clip.mp4");
    expect(request.mock.calls[0]?.length).toBe(1);
  });
  it("fails closed when no LTX key is configured", async () => {
    vi.stubEnv("LTX_API_KEY", "");
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    await expect(createLtxClip("DNA")).rejects.toMatchObject({ status: 401 });
    expect(request).not.toHaveBeenCalled();
  });
});