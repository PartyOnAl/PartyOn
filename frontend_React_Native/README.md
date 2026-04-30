# PartyOn — User App

A modern React Native / Expo app for discovering and booking nightlife events.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy env file and add your Supabase credentials:
```bash
cp .env.example .env
```

Edit `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Start the app:
```bash
npx expo start
```

## Screens

- **Login / Signup** — Auth with Supabase
- **Home** — Tonight, This week, Promotions, Your venues tabs
- **Search** — Search events by name + filter by genre
- **Tickets** — View upcoming/past bookings, QR code modal
- **Profile** — Edit profile, saved events, settings
- **Event Detail** — Full event info, ticket & table booking

## Tech Stack

- Expo Router (file-based routing)
- Supabase (auth + database)
- lucide-react-native (icons)
- react-native-svg (QR code rendering)
