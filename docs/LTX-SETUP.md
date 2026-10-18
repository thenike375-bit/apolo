# LTX demo setup and investigation

## Selected option

- Four ten-second clips: 40 seconds total, 1280×720, 24 fps.
- `ltx-2-3-fast` via LTX's own API, using the securely stored `LTX_API_KEY`.
- Listed video rate checked on 18 October 2026: $0.03 per second, or $1.20 for this demo.
- The app reserves $1.20 against a shared $1.25 video ceiling. This is one promotional demo for the app, not $1.25 per learner.
- Storyboard writing, Apollo's live voice, camera decisions and narration still use Lovable AI credits. They are not covered by LTX credit.
- Pricing is an estimate from the published rate, not a verified account charge or permanent free tier.

## Before preparing a film

1. Open https://console.ltx.video/ and confirm that the $1.25 balance belongs to **API credits**, not LTX Studio.
2. Keep **auto top-up disabled**. The app guard cannot control charges caused by other apps or console settings.
3. The key has been saved securely; do not paste it into chat or commit it in an environment file.
4. Update the published app and sync its existing `/api/public/film-workflow` endpoint in Inngest so the new handler is registered.
5. Start one new film from the app only after accepting its $1.20 estimated video cost and separate storyboard/voice costs.
6. Return when ready and play it with Apollo. No film autoplays just because it finishes preparing.

No video was submitted during this investigation. A read-only lookup of a nonexistent LTX job returned `404 not_found_error`, not an authentication failure. This does not verify available balance, model entitlement, generation quality, or successful generation.

## Safety and preservation

- Existing preparations keep their original video provider and saved clips; legacy IDs are never sent to LTX.
- New preparations are marked LTX and reserve the entire film before storyboarding or video creates.
- The budget reservation is serialized in the database, so simultaneous learners cannot each reserve the same credit.
- Each clip records a submission intent before calling LTX. An unknown result stops instead of recreating a potentially billed clip.
- Saved provider receipts recover accepted clips; completed clips are reused on resume.
- No automatic provider fallback, failed-clip resubmission, or reservation refund is performed.
- Provider credit failures stop the job. Depleted demo credit is not automatically reset.
- Private clip storage and existing owner-scoped playback remain unchanged.

## Project analysis

Recorded usage from 5–18 October 2026 showed Gemini video output as the largest running-cost item: **64.8704 requested credits**. Twelve sampled recent successful video calls were about 4.0556 credits each. These are recorded usage figures, not a cash-payment or observed-savings comparison. LTX's estimate uses its independently published USD pricing; no realized savings have been measured.

The existing flow is: authenticated learner → preparation row → Inngest → storyboard → sequential provider jobs → private clips → Apollo playback. Migrating just the provider without tagging old jobs would break resume and could rerender paid clips; the new provider field avoids that.

Other findings:

- Four preparations were marked ready, but their combined film metadata contained only 24 shots; earlier board-only lessons are not cinematic video.
- Saved-film URLs last one hour. Automatic renewal remains a separate playback improvement.
- Playback currently saves progress frequently, and preparation lists poll while pending. No measured load reduction is claimed.
- The selected existing calculus film opened without JavaScript page errors, but its media element reported `MEDIA_ERR_SRC_NOT_SUPPORTED` (code 4). It did not visibly play in the sandbox; this issue has not been repaired or attributed to the camera.
- Camera, microphone, face tracking, Apollo voice and prepared film are separate lifecycles. No real microphone/camera call or full LTX film was exercised in this check.
- All content routes already have their own title, description and sharing metadata; no new content route was added.

## Verification

- 14 focused tests pass, including budget arithmetic, fixed generation settings, one-submit lifecycle, preserved 402 errors, no credential forwarding to video hosts and missing-key failure.
- Both budget tables have RLS enabled, service access allowed and learner read access denied.
- The app reports successful builds after changes.
- Signed-in Lessons, live film and new lesson pages opened; the new price/budget notices were visible.
- Full generation, production workflow synchronization, available API credit and actual media playback remain unverified.

## Official sources

- Pricing: https://docs.ltx.io/pricing
- Models: https://docs.ltx.io/models/ltx-2-3
- API authentication: https://docs.ltx.io/authentication
- Submit: https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-text-to-video
- Poll: https://docs.ltx.io/api-documentation/api-reference/async-video-generation/get-job-status
- Separate API/Studio billing: https://help.ltx.io/hc/en-us/articles/37064339808914-Do-I-need-to-pay-separately-for-API-access-if-I-have-a-Studio-plan
- Auto top-up: https://docs.ltx.io/auto-top-up