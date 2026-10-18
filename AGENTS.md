<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# PostFactum — agent rules

- AI calls run server-side only: streaming chat in `src/routes/api/chat.ts`, voice in `api/transcribe.ts` / `api/speech.ts`, one-shot structured work in `src/lib/learning.functions.ts`; why: keeps the gateway key off the client.
- Server routes authenticate via the bearer token with `authFromRequest` (RLS-scoped client); why: API routes don't get server-fn middleware.
- Teacher memory is one shared `memories` table injected into every chat's instructions and written by the `remember` tool and quiz results; why: many threads, one learner model.
- UI copy goes through `src/lib/i18n.tsx` (single English dictionary); why: keeps copy in one place.
- Missing lazy route chunks recover through a guarded document reload, with a manual refresh fallback; why: router invalidation cannot replace a stale deployment asset manifest and unbounded reloads can loop.
- Live lessons use the persistent authenticated Live relay and its lifecycle hook; why: two-way speech needs interruption handling and reliable paid-session cleanup.
- Camera cues run locally (MediaPipe, `face-cues.ts`); during connected live calls a 320px snapshot every few seconds goes to the authenticated OpenAI vision decision fn (`decisions.functions.ts`), which returns pacing decisions; a puzzled-looking face triggers Apollo asking what is unclear; why: user chose OpenAI decisions and wants confusion check-ins.
- The only teacher is Apollo, drawn as a code SVG rig in `apollo-puppet.tsx` (jointed arms, blinking, voice-driven mouth) and walked around animated film scenes (`board-scene.tsx`) by `board-apollo.tsx`; why: real limb animation instead of swapping pictures.
- MediaPipe runtime binaries use asset pointers; why: large model runtime files cannot be committed to the app repository.
- Live teacher audio is compressed and boosted via Web Audio in `use-live-voice.ts`; why: speaker playback without headphones was too quiet.
- Cinematic films use Inngest durable steps and provider-dispatched video jobs with saved IDs and private Cloud clip storage; legacy rows retain Gateway jobs, new rows use LTX; why: changing providers must never reinterpret saved IDs or regenerate completed footage.
- LTX creation reserves the whole film in a service-only, advisory-locked budget ledger and records each submission intent before calling the provider; unresolved intents fail closed and reservations are never automatically released; why: concurrent requests and ambiguous responses must not duplicate paid generation or exceed the app-local cap. The ledger is not an LTX account balance.
- Live film playback owns the scene/time cursor and sends validated context to Apollo; why: questions pause real media and resume without regenerating footage.
- Apollo remains a part-based SVG presenter; legacy illustrated scene code is not cinematic film footage and must not be offered as its substitute.
- Inngest must sync the public film-workflow endpoint after deployment before preparation is operational; why: private preview blocks external workflow callbacks and localhost cannot be registered for production.
- Prepared lesson reads use explicit column grants and preparationColumns, excluding callback_token; every new readable column needs a grant because claim secrets must remain server-only.
- Preparation input never accepts ownership; authenticated middleware supplies userId and RLS enforces it, while preparation controls wait for session hydration.
- Film preparation has no time cap and runs until complete; why: user wants every film finished.
- Live board teaching uses chalk cards and a chalk-holding rig, separate from prepared cinematic footage; why: board explanations must not masquerade as generated films.
- Regular lesson boards use a page-owned streamed speech player, advance on audio completion, retain full narration separately from short bullets and reuse completed audio in memory; why: synchronize Apollo to real speech without rebilling page-session replays.
