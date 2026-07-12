# DineIN — Folder Structure

```
dinein/
│
├── apps/                          # Frontend applications
│   ├── admin-web/                 # Admin dashboard (React + Vite)
│   │   └── README.md              # Migration pending from DineIN-Admin/web
│   ├── member-web/                # Member PWA (React + Vite)
│   │   └── README.md              # Migration pending from DineIN-Member/web
│   ├── member-mobile/             # Mobile app (Expo)
│   │   └── README.md              # Migration pending from DineIN-Member/frontend
│   └── admin-mobile/              # Admin mobile app (Expo)
│       └── README.md              # Migration pending from DineIN-Admin/frontend
│
├── backend/                       # Unified Express.js API
│   ├── src/
│   │   ├── common/                # Shared backend infrastructure
│   │   │   ├── config/            # Environment & app config
│   │   │   ├── database/          # Prisma client singleton
│   │   │   └── middleware/        # Auth, error handler, validation, async wrapper
│   │   ├── modules/               # Feature modules
│   │   │   ├── auth/              # Login, register, tokens, password
│   │   │   ├── members/           # Student/member CRUD & profile
│   │   │   ├── menu/              # Food menu management
│   │   │   ├── leave/             # Leave requests & stats
│   │   │   ├── bills/             # Monthly bill generation
│   │   │   ├── payments/          # Payment recording & history
│   │   │   ├── snacks/            # Snack products & orders
│   │   │   ├── polls/             # Daily meal polls & voting
│   │   │   ├── attendance/        # QR attendance tracking
│   │   │   ├── expenses/          # Mess expense tracking
│   │   │   ├── notifications/     # Push notifications (FCM)
│   │   │   └── dashboard/         # Aggregated stats & summaries
│   │   ├── app.js                 # Express app assembly
│   │   └── server.js              # Bootstrap & listen
│   ├── package.json
│   └── .env.example
│
├── database/                      # Database layer
│   ├── prisma/
│   │   ├── schema.prisma          # Unified Prisma schema (30+ models)
│   │   └── seed.js                # Dev seed script
│   └── package.json
│
├── packages/                      # Shared libraries
│   ├── api/                       # Axios client & API functions
│   │   └── src/
│   │       ├── client.js          # createApiClient factory
│   │       └── index.js
│   ├── constants/                 # Roles, statuses, storage keys
│   │   └── src/
│   │       └── index.js
│   ├── hooks/                     # Shared React hooks
│   │   └── src/
│   │       └── index.js
│   ├── ui/                        # Shared UI components
│   │   └── src/
│   │       └── index.js
│   └── utils/                     # formatDate, formatCurrency, etc.
│       └── src/
│           └── index.js
│
├── docs/                          # Documentation
│   ├── Architecture.md
│   ├── Setup.md
│   ├── FolderStructure.md
│   ├── CodingStandards.md
│   └── README.md
│
├── scripts/                       # Build & dev utility scripts
│
├── .github/
│   └── workflows/
│       └── ci.yml                 # Lint + Build CI pipeline
│
├── .editorconfig
├── .gitignore
├── .prettierrc
├── package.json                   # Root workspace (Turborepo)
├── pnpm-workspace.yaml            # pnpm workspace declarations
├── turbo.json                     # Turbo pipeline config
└── README.md
```

## Module Structure

Every backend module follows this pattern:

```
module/
├── controller.js    # Express request handlers (thin, delegates to service)
├── service.js       # Business logic & orchestration
├── repository.js    # Database queries via Prisma
├── routes.js        # Express Router with auth & validation middleware
├── validation.js    # Zod schemas for request validation
└── index.js         # Barrel export
```
