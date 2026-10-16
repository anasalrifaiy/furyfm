# FM Fury

Native Android football manager (Expo + Firebase). Package: `com.anaszrock.footballmanager2025`.

It uses the same Firebase project (`fury-fm`) and accounts as the FuryFM web app, so the same login and squad work in both.

## Setup
1. `npm install`
2. `npx expo start`

## Build and release
`npx eas-cli build -p android --profile production --auto-submit` (Expo account `anasdev90`) builds and submits to Play closed testing.

## Structure
- `app/(auth)`: login and signup
- `app/(tabs)`: Home, Squad, Match, Profile
- `lib/firebase.ts`, `lib/auth.ts`: Firebase setup, auth and manager profile
- `components/MatchGame.tsx`, `lib/footballGame.js`: playable match
