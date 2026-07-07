# Chef G-Mini — AI Cooking Assistant

Chef G-Mini is a voice- and vision-powered cooking assistant. Point your camera at the pan, talk to it like a sous‑chef, and let it read your recipe, watch the food, run timers, and guide you step by step.

Built with React + Vite + TypeScript + Tailwind + shadcn/ui on top of Lovable Cloud (Supabase) and Lovable AI.

## Features

- **Live voice conversation** with Google Gemini Live (native audio) via ephemeral tokens.
- **Vision analysis** every ~3s using Lovable AI (`google/gemini-3.1-flash-lite`) — describes the scene and can auto-suggest timers when it sees pasta hit water, meat hit a pan, etc.
- **Recipe library** — save recipes from text, URL, or file (image / PDF), stored per‑user with Row Level Security.
- **AI recipe parsing** into `title / ingredients / instructions` using Lovable AI (`google/gemini-3-flash-preview`).
- **Optional ElevenLabs TTS** for a custom voice on top of Gemini text responses.
- **Smart timers** that notify the AI when they finish, so it can proactively tell you what to do next.
- **Diagnostics panel** showing model, API version, live activity, and token counts.

## Tech Stack

- Frontend: React 18, Vite 5, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Lovable Cloud (Supabase) — Postgres, Auth, Storage, Edge Functions
- AI:
  - Lovable AI Gateway — `google/gemini-3-flash-preview`, `google/gemini-3.1-flash-lite`
  - Google Gemini Live API — real-time audio/video
  - ElevenLabs — optional custom voice

## Edge Functions

- `get-gemini-token` — mints an ephemeral Gemini Live token (auth‑protected).
- `parse-recipe` — extracts structured recipe data from text/URL/image content.
- `analyze-vision` — every ~3s vision snapshot + timer suggestions.
- `elevenlabs-tts` — streams PCM audio for a chosen ElevenLabs voice.

All edge functions require an authenticated Lovable Cloud user (`verify_jwt = true`).

## Data model

`public.recipes`
- `id`, `title`, `content`, `source_url`, `file_path`
- `ingredients text[]`, `instructions text[]`
- `user_id uuid` (owner)
- RLS: users can only read/write their own recipes.

Storage bucket `recipe-files` is private; files are stored under `<user_id>/<timestamp>-<name>` and accessed via signed URLs.

## Getting started (local)

Requirements: Node.js 18+ and npm.

```sh
git clone <your-repo-url>
cd chef-g-mini
npm install
npm run dev
```

The app expects Lovable Cloud env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) which Lovable auto‑provisions.

## Working with this repo

This project is developed on [Lovable](https://lovable.dev) with two-way GitHub sync. You can edit either in Lovable or locally — changes flow both ways.

Project URL: https://lovable.dev/projects/096b31c4-6fdc-459e-9918-c29601587755

## Deployment

Open the project in Lovable and click **Share → Publish**. You can also connect a custom domain from Project → Settings → Domains.
