# Splitly

Splitly is a Splitwise-style full-stack expense sharing app built with:

- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn-style UI primitives
- Backend: Node.js + Express + TypeScript + Zod validation + JWT auth
- Database: SQLite (dev default, no Docker needed) + Prisma ORM
- Testing: Vitest unit tests for split/balance logic and integration-style API tests

## Features

- Authentication
	- Sign up / log in with email and password
	- Bcrypt password hashing
	- JWT-based protected APIs
	- User profile (name, email, username, avatar URL, default currency)
- Friends
	- Send requests by email or username
	- Accept / decline requests
	- View per-friend net balance
- Groups
	- Create groups
	- Add/remove members (by userId or email/username identifier)
	- Group summary (members, expenses, total spent)
- Expenses
	- Add expenses with description, amount in cents, currency, payer, participants, date
	- Split types: `EQUAL`, `EXACT`, `PERCENTAGE`, `SHARES`
	- Optional note, category, and receipt upload
	- Edit expense details
- Balances and settle up
	- Simplified debt graph to minimize transactions
	- Record settlements/payments
- Activity feed
	- Expense creation/update, settlements, group events, friend request events
- Dashboard
	- Overall net balance
	- Recent activity
	- Quick add expense

## Monorepo Structure

```
splitly/
	apps/
		api/
			prisma/
			src/
		web/
			src/
	docker-compose.yml
	.env.example
	README.md
```

## Prerequisites

- Node.js 20+
- npm 10+
- Docker is optional (only if you want a PostgreSQL container)

## Environment Setup

1. Copy env files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

2. Install dependencies:

```bash
npm install
```

## Database Setup

Run local database setup (no Docker):

```bash
npm run db:setup
```

This uses `apps/api/dev.db` via `DATABASE_URL=file:./dev.db`.

Optional PostgreSQL via Docker:

```bash
npm run db:up
```

## Run in Development

Run both API and frontend:

```bash
npm run dev
```

- API: `http://localhost:4000`
- Web: `http://localhost:5173` (or next available port)

## Build and Test

```bash
npm run lint
npm run test
npm run build
```

## Seed Credentials

The seed script creates:

- `alice@example.com` / `password123`
- `bob@example.com` / `password123`
- `charlie@example.com` / `password123`

## API Summary

- Auth
	- `POST /api/auth/signup`
	- `POST /api/auth/login`
	- `GET /api/me`
- Friends
	- `GET /api/friends`
	- `GET /api/friends/requests`
	- `POST /api/friends/requests`
	- `POST /api/friends/requests/:id`
- Groups
	- `GET /api/groups`
	- `POST /api/groups`
	- `POST /api/groups/:id/members`
	- `DELETE /api/groups/:id/members/:userId`
- Expenses
	- `GET /api/expenses`
	- `POST /api/expenses`
	- `PATCH /api/expenses/:id`
- Balances/Settlements
	- `GET /api/balances`
	- `POST /api/settlements`
- Activity and dashboard
	- `GET /api/activity`
	- `GET /api/dashboard`

## Notes

- Money is stored as integer minor units (`amountCents`, `owedCents`) to avoid floating-point rounding issues.
- The default development profile is Docker-free SQLite for quick local setup.
