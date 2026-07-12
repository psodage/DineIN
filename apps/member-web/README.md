# DineIN Member — Web PWA

Production-ready Progressive Web App for DineIN mess members. Same API, auth, and flows as the Expo mobile app, with a premium responsive web UI.

## Stack

- React 19 + Vite 6
- React Router DOM 7
- Tailwind CSS 4
- Axios (shared API contract)
- Context API (auth + i18n)
- `vite-plugin-pwa` (manifest, service worker, offline caching)

## Folder structure

```
web/
├── public/              # Static assets, PWA icons, splash
├── src/
│   ├── components/      # UI, layout, dashboard widgets
│   ├── context/         # LanguageContext (en/mr)
│   ├── lib/             # api, auth, poll, date utils
│   ├── pages/           # Routes & tab screens
│   ├── App.jsx          # Router + providers
│   ├── config.js        # API base URL
│   └── main.jsx
├── index.html
├── vite.config.js
├── vercel.json          # SPA rewrites
└── package.json
```

## Installation

```bash
cd web
cp .env.example .env
# Edit VITE_API_BASE_URL (no trailing slash, no /api)
npm install
```

## Development

```bash
npm run dev
```

Open `http://localhost:5173`. Ensure the backend is running and `CORS_ORIGIN` allows your dev origin (or `*`).

## Production build

```bash
npm run build
npm run preview   # optional local check of dist/
```

Output: `web/dist/` (optimized chunks + generated service worker).

## Deploy to Vercel

1. Push the repo to GitHub.
2. In Vercel: **New Project** → import repo.
3. Set **Root Directory** to `web`.
4. **Framework Preset**: Vite.
5. **Build Command**: `npm run build`
6. **Output Directory**: `dist`
7. Environment variable:
   - `VITE_API_BASE_URL` = `https://your-backend.onrender.com` (or production API)
8. Deploy.

`vercel.json` rewrites all routes to `index.html` for client-side routing.

Update backend `CORS_ORIGIN` to include your Vercel URL (e.g. `https://dinein-member.vercel.app`).

## Install PWA on devices

### Android (Chrome)

1. Open the deployed HTTPS URL.
2. Menu (⋮) → **Install app** or **Add to Home screen**.
3. Confirm — app opens standalone with splash and theme color.

### iPhone (Safari)

1. Open the deployed HTTPS URL in **Safari** (required for Add to Home Screen).
2. Share button → **Add to Home Screen**.
3. Name the app **DineIN** → **Add**.

iOS does not support Web Push for third-party browsers the same way as Android; push is **ready** via service worker registration — wire `push` subscription on the backend when you add VAPID keys.

## Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend origin only, e.g. `http://localhost:5000` |

## Routes (member flows)

| Path | Screen |
|------|--------|
| `/` | Auth splash redirect |
| `/welcome` | Welcome / sign in |
| `/login`, `/login/phone` | Email & phone login |
| `/signup` | Pending registration |
| `/forgot-password`, `/reset-password` | OTP password reset |
| `/dashboard?tab=home\|snacks\|leaves\|bill\|profile` | Main app tabs |
| `/profile/edit`, `/profile/change-password` | Profile settings |
| `/bill/payments` | Payment history |
| `/leaves/history` | Leave history |
| `/snacks/history`, `/snacks/success` | Snack orders & QR |
| `/activity-calendar` | Member activity |

## Performance recommendations

1. **CDN**: Serve `dist` from Vercel edge; enable compression (automatic).
2. **API**: Keep `VITE_API_BASE_URL` on a low-latency host; use HTTP/2.
3. **Images**: Hero JPGs in `public/` are large — compress or serve WebP variants for LCP.
4. **Caching**: Workbox caches static assets; API responses stay network-first (auth-sensitive).
5. **Code splitting**: Vendor chunk is pre-configured in `vite.config.js`.
6. **Lighthouse**: Run PWA audit after deploy; fix any manifest/icon size warnings.

## Push notifications (readiness)

The PWA registers a service worker via `vite-plugin-pwa`. To enable push later:

1. Generate VAPID keys on the backend.
2. Subscribe in the client with `registration.pushManager.subscribe()`.
3. Store subscriptions server-side and send via `web-push`.

No backend changes are required until you add that endpoint.

## Relation to Expo app

The original React Native app remains in `frontend/`. This `web/` package is the browser/PWA target with identical API paths and business rules.
