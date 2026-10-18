# MySync

React Native (Expo) app for sync licensing, with two sides:

- **Musicians** keep a catalog of songs as cards (release / lyric draft / songwriting draft), with posters, platform links (DISCO, Spotify, Apple Music, SoundCloud), an in-app player, metadata checks, and sync-rights info. They browse open briefs and submit songs.
- **Supervisors** post briefs, see how many artists submitted, and accept / deny each submission or silently stop accepting from a musician. Submissions are anonymous (each musician shows up as e.g. `Artist 877C`). Supervisors also get the **sync agent**: describe a scene, get a ranked shortlist with clearance checks.

Light mode leans purple, dark mode is deep plum with violet + orange (Tailwind violet/orange scales, see `constants/theme.ts`). Switch in Account → Appearance.

## Setup

1. Install: `npm install`
2. In the [Supabase SQL editor](https://supabase.com/dashboard/project/agvzhsqzbgqmcyftoask/sql), run **all of** `supabase/schema.sql`. It's safe to re-run: it upgrades the v1 tables (roles, new song fields, briefs, submissions, blocks, storage buckets for posters/audio).
3. Auth → Providers → Email: turn **Confirm email** off for this prototype.
4. `.env` (anon key from Project Settings → API):

```
EXPO_PUBLIC_SUPABASE_URL=https://agvzhsqzbgqmcyftoask.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=paste-anon-key-here
```

5. `npm start`, then press `i` (iOS simulator), `a` (Android) or `w` (web), or scan the QR code with Expo Go. For the native track player, use a development build instead (see Audio playback).

## Demo accounts

On the login screen pick **For musicians** or **For supervisors**, then tap the demo button.

| Side | Email | Password |
| --- | --- | --- |
| Musician (Darzini) | `darzini@mysync.app` | `DarziniSync1!` |
| Supervisor | `supervisor@mysync.app` | `SupervisorSync1!` |

Darzini gets 3 releases + 2 drafts with preview audio (royalty-free SoundHelix examples) and links that point to search pages. Existing Darzini catalogs from v1 are upgraded in place. The supervisor gets 2 open briefs.

Logging in with the wrong side selected is refused ("This account is registered as a supervisor…"). Roles can't be changed after sign-up.

## The sync agent (supervisors only)

Describe a scene in the **Sync agent** tab. The agent searches releases musicians marked **Open to sync** (minus anyone that supervisor blocked), checks clearance on every pick, and answers with a short ranked shortlist. Under the answer you get a playable **Top 5 / Top 10** list: the agent's picks first (★), then the next-best search hits, each with a clearance verdict and a play button, plus **Play all**.

Code:

- `supabase/functions/_shared/sync-agent/` the agent loop, the four tools, the DB mapping, the shortlist builder and the model providers (one copy, shared by the app and the CLI).
- `supabase/functions/sync-agent/index.ts` the Edge Function the app calls. It rejects anyone who isn't a supervisor and runs the model server-side, so no API key ships in the app.
- `sync-agent/` CLI, eval set and tests.

### Choosing a model

The agent works with any of these. Set **one** as a Supabase secret (and in `sync-agent/.env` for the CLI):

| Provider | Secrets | Notes |
| --- | --- | --- |
| **Gemini** (default when its key is set) | `GEMINI_API_KEY` (from [Google AI Studio](https://aistudio.google.com/apikey)) | Has a free tier. Default model `gemini-3.8-flash`; override with `MODEL`. Free-tier prompts may be used by Google to improve its products, and Google's terms require the paid tier for apps serving users in the EEA/UK/Switzerland, so treat the free tier as dev-only. |
| **Any OpenAI-compatible API** (Groq, OpenRouter, Together, OpenAI…) | `LLM_API_KEY`, `LLM_BASE_URL`, `MODEL` | Use this for open-weights models, e.g. Groq: `LLM_BASE_URL=https://api.groq.com/openai/v1`, `MODEL=llama-3.3-70b-versatile`. |
| **Claude** | `ANTHROPIC_API_KEY` | Optional `MODEL`. |

`AGENT_PROVIDER=gemini|openai_compatible|anthropic` forces a choice if several keys are set. The app shows which model answered under each reply.

### Deploy

```bash
npx supabase login
npx supabase link --project-ref agvzhsqzbgqmcyftoask
npx supabase secrets set GEMINI_API_KEY=your-key
npx supabase functions deploy sync-agent
```

### CLI and tests (from the app root)

```bash
npm run agent:test        # 22 offline tests, no API key needed
cp sync-agent/.env.example sync-agent/.env   # add a key
set -a; source sync-agent/.env; set +a
npm run agent:brief -- "Tense night chase, ~90 BPM, no vocals, under 2000 EUR, one-stop"
npm run agent:eval        # writes sync-agent/results/eval-*.md
```

## Audio playback

Two engines behind one player (`context/PlayerContext.tsx`), picked automatically:

- **react-native-track-player** in development and store builds: background audio, lock-screen / headphone controls, native queue. Needs a development build (it is native code, so it is not in Expo Go): `npx expo run:ios` / `npx expo run:android`, or `eas build --profile development`.
- **expo-audio** in Expo Go and on web, so `npm start` + Expo Go keeps working while you iterate.

The custom entry `index.js` registers the track player's background service before `expo-router` starts.

## How anonymity works

- Supervisors never query `submissions` directly. They go through `brief_submissions()` / `review_submission()` (security-definer SQL functions) which return a per-supervisor alias instead of the musician's id or name.
- "Don't accept submissions from this musician again" declines their pending submissions to you and hides your briefs from them. Nobody is notified; on the musician's side it just reads "Not selected". Account → Blocked musicians → Unblock everyone undoes it.
- If a musician puts their name in the song title or note, that's on them. The submit screen reminds them.

## Project layout

- `app/(auth)` login + register with the musician/supervisor switch
- `app/(musician)` Songs, Briefs, Account tabs · `app/song/*` detail, new, edit · `app/brief/[id]` submit
- `app/(supervisor)` Briefs, Sync agent, Account tabs · `app/review/*` submissions, new brief
- `app/player.tsx` full-screen player (mini player is docked above the tab bar)
- `context/` auth, theme, player · `components/` UI kit and cards · `lib/` data access
- `index.js` app entry (registers the track-player service, then loads expo-router)
