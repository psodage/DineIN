# DineIN

A mess management platform bringing administration, member self-service, and mobile access into one codebase.

**React · React Native / Expo · Express · Prisma · PostgreSQL · pnpm · Turborepo**

## Product focus

DineIN organizes recurring mess operations: meal management, member billing, payments, leave tracking, and reporting. Its monorepo separates the applications by audience while keeping shared code and a unified backend together.

## Applications and architecture

`Admin web / Member PWA / Member mobile → Shared API client → Express API → Prisma → PostgreSQL`

| Workspace | Responsibility |
| --- | --- |
| `apps/admin-web` | React and Vite admin dashboard |
| `apps/member-web` | React and Vite member PWA |
| `apps/member-mobile` | Expo / React Native member application |
| `backend` | Unified Express API |
| `database` | Prisma schema, migrations, and seed data |
| `packages/api` | Shared API client and functions |
| `packages/hooks` | Shared React hooks |
| `packages/ui` | Shared UI components |
| `packages/utils` | Shared utilities |
| `packages/constants` | Shared roles, routes, and constants |
| `docs` | Supporting project documentation |
| `.github/workflows` | Automation configuration |

## Local development

### Prerequisites

- Node.js compatible with the application dependencies.
- pnpm **10.12.1**, as declared in the root manifest.
- A PostgreSQL database; the documented stack uses Neon for hosted PostgreSQL.
- Expo tooling and an appropriate device or simulator for mobile development.

### Install and configure

1. Clone this repository and install dependencies:

~~~sh
git clone https://github.com/psodage/DineIN.git
cd DineIN
pnpm install
~~~

2. Use [backend/.env.example](backend/.env.example) as the starting point for backend configuration. Configure database access and the values required by the applications you intend to run. Check each workspace for its own configuration requirements.
3. Generate the database client and apply migrations to your development database:

~~~sh
pnpm db:generate
pnpm db:migrate
~~~

4. Optionally populate development data with `pnpm db:seed` after reviewing the seed contents.
5. Start the development workspaces:

~~~sh
pnpm dev
~~~

Use the URLs printed by each application. Database commands operate on the database selected by your environment configuration.

## Available commands

Run these from the repository root.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run workspace development tasks through Turborepo |
| `pnpm dev:backend` | Start the API |
| `pnpm dev:admin` | Start the admin web application |
| `pnpm dev:member-web` | Start the member web application |
| `pnpm dev:mobile` | Start the mobile workspace |
| `pnpm build` | Run workspace build tasks |
| `pnpm lint` | Run workspace lint tasks |
| `pnpm format:check` | Check formatting |
| `pnpm format` | Apply formatting |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm db:migrate` | Run the database workspace migration task |
| `pnpm db:seed` | Run the database seed task |
| `pnpm db:studio` | Open Prisma Studio |

## Engineering highlights

- Separate admin, member web, and mobile applications within a pnpm workspace.
- Shared packages for common interfaces and client-side behavior.
- A unified API and Prisma-managed relational data layer.
- Turborepo tasks for development and builds across workspaces.

## Verification

Use `pnpm format:check`, `pnpm lint`, and `pnpm build` to run the corresponding configured tasks. Task availability and coverage depend on each workspace; these commands alone do not establish end-to-end correctness.

For a functional review, run the API and a client against a development database, then exercise the relevant member, meal, billing, payment-record, and leave workflows. Check the mobile app independently from the web applications.

## Project scope

This repository documents the platform and its development setup. A successful build, a deployment entry, or a listed feature does not establish production adoption or payment-provider readiness. Deployment requires the backend, database, and each client to be configured for its target environment.
