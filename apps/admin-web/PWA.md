# DineIN Admin — Web PWA

Restaurant admin dashboard as an installable Progressive Web App (React + Vite + Tailwind).

## Prerequisites

- Node.js 18+
- Backend API running (default `http://localhost:5000`)

## Installation

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env — set VITE_API_BASE_URL to your backend URL in production
```

## Development

```bash
npm run dev
```

Open http://localhost:5173

In development, if `VITE_API_BASE_URL` is empty, API requests use the Vite proxy (`/api` → `http://localhost:5000`).

## Production build

```bash
npm run build
npm run preview
```

Output: `frontend/dist/`

## Deploy to Vercel

1. Push the repo to GitHub.
2. In [Vercel](https://vercel.com), **Add New Project** → import the repo.
3. Set **Root Directory** to `frontend`.
4. Framework preset: **Vite** (or use `vercel.json` in this folder).
5. Environment variables:
   - `VITE_API_BASE_URL` = your production API URL (e.g. `https://api.yourdomain.com`)
6. Deploy.

`vercel.json` includes SPA rewrites so client-side routing works.

## Install as PWA

### Android (Chrome)

1. Open the deployed HTTPS URL.
2. Menu (⋮) → **Install app** or **Add to Home screen**.
3. Confirm — the app opens standalone with the DineIN icon.

### iPhone / iPad (Safari)

1. Open the deployed **HTTPS** URL in **Safari** (required for Add to Home Screen).
2. Tap **Share** → **Add to Home Screen**.
3. Name it **DineIN Admin** → **Add**.
4. Launch from the home screen — runs full-screen like a native app.

**Note:** iOS requires HTTPS. Local dev over `http://localhost` can be added to the home screen on some iOS versions but production must use HTTPS.

### Splash screen & icons

- Icons: `public/icons/` (192, 512, apple-touch-icon)
- Splash: configured via PWA manifest `background_color` / `theme_color` and `public/splash/`
- Service worker: auto-registered by `vite-plugin-pwa` on build

## Legacy Expo mobile app

The previous Expo/React Native entry (`app/`, `expo-router`) remains in the repo for reference. The primary web app entry is:

- `index.html` → `src/main.jsx`

Expo scripts were removed from `package.json`; restore from git history if you need mobile builds again.

## Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend base URL (no `/api` suffix) |
| `VITE_FIRST_SELECTABLE_YEAR` | First year for month pickers (default 2025) |
| `VITE_RESTORE_CONFIRM_PHRASE` | Backup restore confirmation phrase |

Maps from former `EXPO_PUBLIC_*` names.
