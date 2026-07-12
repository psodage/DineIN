# DineIN — System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Clients                            │
├──────────────┬──────────────┬───────────────────────────┤
│  Admin Web   │  Member Web  │    Member Mobile (Expo)   │
│  (React+Vite)│  (PWA, Vite) │    (React Native)         │
└──────┬───────┴──────┬───────┴───────────┬───────────────┘
       │              │                   │
       └──────────────┼───────────────────┘
                      │  HTTPS / REST
                      ▼
       ┌──────────────────────────────┐
       │   Unified Express.js API     │
       │   (Module-based architecture)│
       ├──────────────────────────────┤
       │  auth │ members │ menu │ ... │
       └──────────────┬───────────────┘
                      │
                      ▼
       ┌──────────────────────────────┐
       │   PostgreSQL (Neon)          │
       │   via Prisma ORM            │
       └──────────────────────────────┘
```

## Backend Module Architecture

Each feature is a self-contained module:

```
module/
├── controller.js   ← HTTP request/response handling
├── service.js      ← Business logic & orchestration
├── repository.js   ← Database queries (Prisma)
├── routes.js       ← Express Router with middleware
├── validation.js   ← Zod schemas
└── index.js        ← Barrel export
```

**Data flow**: `Route → Validation → Controller → Service → Repository → Prisma → DB`

## Shared Packages

| Package | Purpose | Used By |
|---|---|---|
| `@dinein/utils` | Date formatting, currency, validators | All frontends |
| `@dinein/constants` | Roles, statuses, route paths | All apps |
| `@dinein/api` | Axios client, API functions | Web + Mobile |
| `@dinein/hooks` | useAuth, useFetch | Web apps |
| `@dinein/ui` | Shared React components | Web apps |

## Authentication Flow

1. User logs in → receives `accessToken` + `refreshToken`
2. `accessToken` stored in memory, `refreshToken` in storage
3. Single-session enforced via `activeSessionToken` on User record
4. Token refresh via `/api/auth/refresh` endpoint

## Database

- **Provider**: Neon (serverless PostgreSQL)
- **ORM**: Prisma 7.x
- **Schema location**: `database/prisma/schema.prisma`
- **Models**: 30+ tables covering users, students, meals, attendance, leave, billing, snacks, polls, notifications, and more
