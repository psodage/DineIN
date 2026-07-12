# DineIN — Local Development Setup

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 10 (`npm install -g pnpm`)
- **PostgreSQL** (or Neon connection string)

## 1. Clone & Install

```bash
git clone <repo-url> dinein
cd dinein
pnpm install
```

## 2. Environment Variables

Copy `.env.example` files and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret for signing JWT tokens
- `REFRESH_TOKEN_SECRET` — Secret for refresh tokens

## 3. Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database (dev only, no migration history)
pnpm db:push

# Or create a migration
pnpm db:migrate

# Seed initial data
pnpm db:seed

# Open Prisma Studio (visual DB browser)
pnpm db:studio
```

## 4. Start Development

```bash
# Start all apps
pnpm dev

# Start individual apps
pnpm dev:backend       # API server on :5000
pnpm dev:admin         # Admin web on :5173
pnpm dev:member-web    # Member PWA on :5174
```

## 5. Project Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps for production |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm format` | Format code with Prettier |
| `pnpm clean` | Remove all node_modules and build artifacts |

## Troubleshooting

### Port already in use
Kill the process on the port:
```bash
npx kill-port 5000
```

### Prisma client out of sync
Regenerate after schema changes:
```bash
pnpm db:generate
```
