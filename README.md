# aurora-player

A small React + Vite audio player / visualizer that can stream Jamendo tracks.

## Running locally

1. Install deps:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open the app in your browser (usually http://localhost:5173)

## Jamendo API

This project uses the Jamendo public API via a client ID.

- By default it falls back to a shared client ID (`b6747d04`).
- If you hit rate limits, set your own Jamendo client ID:

```bash
export VITE_JAMENDO_CLIENT_ID=YOUR_CLIENT_ID
npm run dev
```

(Windows PowerShell example)

```powershell
$env:VITE_JAMENDO_CLIENT_ID='YOUR_CLIENT_ID'
npm run dev
```

## Quick Jamendo test

There is a small script you can run to test the Jamendo API connection:

```bash
node scripts/test-jamendo.js
```
