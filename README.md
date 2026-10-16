# FM Fury

Native Android football manager (Expo + Supabase). Package: `com.anaszrock.footballmanager2025`.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in the Supabase URL and anon key.
3. `npx expo start`

## Build
`npx eas-cli build -p android --profile production` (Expo account `anasdev90`).

## Playable match
`components/MatchGame.tsx` renders the match; the engine is `lib/footballGame.js`.
