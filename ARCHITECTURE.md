# Project Reference — `todo-tauri` (Cakwei's Personal Todo Project)

> **Purpose:** Living technical reference for the `todo-tauri` monorepo, covering architecture, directory layout, database schema, backend API, frontend routing/state, Tauri desktop shell, and build/CI workflows.

---

## 1. Architecture Overview

`todo-tauri` is a cross-platform desktop Todo application built with **Tauri v2**, a **React 19 + TanStack Start (SPA mode)** frontend, and a **Fastify 5 + Prisma (MySQL/MariaDB) + Better Auth + Redis** backend.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Tauri v2 Desktop Shell                   │
│  Rust (src-tauri)                                           │
│  ├─ tauri-plugin-store  (app-settings.json: token, onboard) │
│  ├─ tauri-plugin-http   (reqwest HTTP client)               │
│  ├─ tauri-plugin-log    (debug logging)                     │
│  └─ Command: is_online  (connectivity check)                │
├─────────────────────────────────────────────────────────────┤
│               Frontend (src/ — Vite + React 19)             │
│  ├─ TanStack Start (SPA mode, SSR disabled)                 │
│  ├─ TanStack Router (file-based routes under src/routes/)   │
│  ├─ TanStack Query (data fetching, optimistic updates)      │
│  ├─ Better Auth Client (bearer token via Tauri Store)       │
│  └─ Tailwind CSS v4 + Radix UI / shadcn-style components    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / Bearer Auth (VITE_API_URL)
┌──────────────────────────▼──────────────────────────────────┐
│               Backend (src-backend/ — Fastify 5)            │
│  ├─ Better Auth (/api/auth/*, bearer + email/password)      │
│  ├─ REST APIs (/api/todos, /api/projects, /api/tags,        │
│  │             /api/health)                                 │
│  ├─ Rate Limiting (@fastify/rate-limit + ioredis)           │
│  └─ Prisma 7 (@prisma/adapter-mariadb -> MySQL)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Desktop Shell** | Tauri `2.11.x` (Rust 2021, `tauri-plugin-store`, `tauri-plugin-http`, `tauri-plugin-log`, `tokio`) |
| **Frontend** | React `19.2`, TypeScript `6.0`, Vite `8.0`, Tailwind CSS `v4`, Radix UI, Lucide Icons, `@hello-pangea/dnd` |
| **Routing & State** | `@tanstack/react-start` (SPA mode), `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-pacer` |
| **HTTP & Validation** | `axios`, `zod` v4, `better-auth` client |
| **Backend** | Node.js ESM, `fastify` `5.12`, `zod` v4, `pino`, `tsup`, `tsx` |
| **Database & Cache** | MySQL / MariaDB via `prisma` `7.10` (`@prisma/adapter-mariadb`), `ioredis` `6.0`, `@fastify/rate-limit` |
| **Auth** | `better-auth` (`1.7.2` backend, `1.5.3` frontend) with `bearer()` plugin |
| **Tooling & CI** | Biome `2.4.5`, GitHub Actions (`tauri-apps/tauri-action@v1` for macOS arm64/x64, Ubuntu, Windows) |

---

## 3. Directory Structure

```text
todo-tauri/
├── .github/workflows/main.yml       # CI/CD release build for macOS, Linux, Windows
├── package.json                     # Frontend & workspace scripts (dev, build, lint, check)
├── vite.config.ts                   # Vite + TanStack Start (SPA) + Tailwind + Nitro + Devtools
├── tsconfig.json                    # Root TypeScript config (#/* and @/* -> ./src/*)
├── biome.json                       # Biome formatter/linter config
├── src/
│   ├── start.ts                     # TanStack Start config (defaultSsr: false)
│   ├── router.tsx                   # TanStack Router + SSR Query integration
│   ├── routeTree.gen.ts             # Auto-generated route tree
│   ├── styles.css                   # Global CSS variables & Tailwind v4 imports
│   ├── components/ui/               # Reusable UI primitives (Button, Card, Dialog, etc.)
│   ├── integrations/
│   │   ├── better-auth/             # HeaderUser component
│   │   └── tanstack-query/          # QueryClient provider & devtools
│   ├── lib/
│   │   ├── auth-client.ts           # Better Auth React client (VITE_API_URL)
│   │   ├── auth.ts                  # Unused/template Better Auth server config
│   │   └── utils.ts                 # cn() helper + Axios instance with Bearer interceptor
│   └── routes/
│       ├── __root.tsx               # Root shell, fonts, dark class, TanStack Devtools
│       ├── __routes.tsx             # Loads Tauri Store, validates session & onboarding state
│       └── __routes/
│           ├── index.tsx            # Onboarding / LaunchScreen carousel
│           ├── __auth.tsx           # Redirects authenticated users to /dashboard
│           ├── __auth/login/index.tsx # Email/password & GitHub login page
│           ├── __protected.tsx      # Auth guard redirecting unauthenticated users to /login
│           └── __protected/dashboard.tsx # Main todo dashboard, DnD, modals, sidebar
├── src-backend/
│   ├── package.json                 # Backend scripts (dev, build, start)
│   ├── tsconfig.json                # Backend TypeScript config
│   ├── prisma/
│   │   ├── schema.prisma            # MySQL schema (Auth + Todo ecosystem)
│   │   └── seed.ts                  # Database seeder (users, projects, tags, todos, etc.)
│   └── src/
│       ├── index.ts                 # Fastify bootstrap, CORS, rate-limit, route registration (port 3001)
│       ├── db.ts                    # PrismaClient with PrismaMariaDb adapter
│       ├── lib/
│       │   ├── auth.ts              # Better Auth server instance (Prisma + bearer plugin)
│       │   ├── const.ts             # Pino logger, CORSList, MESSAGE constants
│       │   ├── redis.ts             # ioredis client (REDIS_URL)
│       │   └── utils.ts             # requireAuth Fastify preHandler hook
│       └── api/
│           ├── auth/auth.ts         # /api/auth/* bridge to Better Auth handler
│           ├── health/index.ts      # GET /api/health
│           ├── projects/index.ts    # GET /api/projects
│           ├── tags/index.ts        # GET /api/tags
│           └── todos/index.ts       # CRUD + reorder + stats for /api/todos
└── src-tauri/
    ├── Cargo.toml                   # Rust dependencies
    ├── tauri.conf.json              # Window config, bundle targets, build commands
    ├── capabilities/default.json    # Tauri permissions (core, store, http allowlist)
    └── src/
        ├── main.rs                  # Binary entrypoint
        ├── lib.rs                   # Tauri Builder, plugins, command registration
        └── command.rs               # #[tauri::command] is_online
```

---

## 4. Database Schema (`src-backend/prisma/schema.prisma`)

Provider: **MySQL** (generated client output: `src-backend/src/generated/prisma`).

### Auth Models (Better Auth)
- **`User`** (`user`): `id`, `name`, `email` (unique), `emailVerified`, `image`, timestamps.
- **`Session`** (`session`): `id`, `expiresAt`, `token` (unique), `ipAddress`, `userAgent`, `userId` (cascades).
- **`Account`** (`account`): `id`, `issuer`, `accountId`, `providerId`, `userId`, OAuth tokens, `password`.
- **`Verification`** (`verification`): `id`, `identifier`, `value`, `expiresAt`.

### Core Todo Models
- **`Project`** (`project`): `id` (cuid), `name`, `description`, `color`, `isArchived`, `userId`.
- **`Tag`** (`tag`): `id` (cuid), `name`, `color`, `userId`. Unique on `[userId, name]`.
- **`Todo`** (`todo`):
  - Core: `id` (cuid), `title` (255), `description`, `status` (`IN_PROGRESS | LATE | COMPLETED`), `priority` (`LOW | MEDIUM | HIGH | URGENT`), `reorderIndex` (Float).
  - Scheduling & Time: `dueDate`, `reminderAt`, `completedAt`, `recurrence` (iCal RRULE), `estimatedMinutes`, `actualMinutes`.
  - Flags: `isPinned`, `isArchived`, `deletedAt` (soft delete).
  - Relations: `userId` (required), `projectId` (optional, `SetNull`), `parentId` (self-referencing subtasks, `Cascade`), `tags` (`TodoTag`), `attachments` (`Attachment`), `activity` (`ActivityLog`).
- **`TodoTag`** (`todo_tag`): Composite PK `[todoId, tagId]`.
- **`Attachment`** (`attachment`): `id`, `name`, `url`, `fileType`, `fileSize`, `todoId`.
- **`ActivityLog`** (`activity_log`): `id`, `action`, `details`, `todoId`, `userId`.

---

## 5. Backend API Reference (`src-backend`)

Base URL: `http://localhost:3001` (or `VITE_API_URL`).
Global rate limit: `30 requests / 1 minute` backed by Redis (`skipOnError: true`).

| Method & Path | Auth | Rate Limit | Description |
| :--- | :--- | :--- | :--- |
| `GET/POST /api/auth/*` | Public | Global | Delegates to `auth.handler(req)` (Better Auth). |
| `GET /api/health` | Public | Global | Returns `{ success: "True", data: {}, message: "Server up" }`. |
| `GET /api/projects` | `requireAuth` | 30/min (`userId:ip`) | Lists active (`isArchived: false`) projects for current user. |
| `GET /api/tags` | `requireAuth` | 30/min (`userId:ip`) | Lists tags for current user ordered by `name` asc. |
| `GET /api/todos` | `requireAuth` | 30/min (`userId:ip`) | Paginated (`page`, `limit`), searchable (`search`), filterable (`status`, `projectId`) todos. Automatically marks overdue `IN_PROGRESS` items as `LATE`. |
| `GET /api/todos/stats` | `requireAuth` | 30/min (`userId:ip`) | Returns `total`, `completed`, `completionRate`, `remainingMinutes`. |
| `GET /api/todos/:id` | `requireAuth` | 30/min (`userId:ip`) | Fetches single non-deleted todo owned by user. |
| `POST /api/todos` | `requireAuth` | 20/min (`userId:ip`) | Creates a todo; validates `projectId` and `parentId` ownership. |
| `PATCH /api/todos/:id` | `requireAuth` | 30/min (`userId:ip`) | Partial update for title, description, status, priority, dates, pin, reorderIndex. |
| `POST /api/todos/reorder` | `requireAuth` | 30/min (`userId:ip`) | Transactional update of `reorderIndex` for `orderedIds` (max 500). |
| `DELETE /api/todos/:id` | `requireAuth` | 20/min (`userId:ip`) | Soft-deletes todo by setting `deletedAt`. |

---

## 6. Frontend Routing & Auth Flow

1. **Tauri Store (`app-settings.json`)**:
   - `better-auth.session_token`: Bearer token saved on login (`src/routes/__routes/__auth/login/index.tsx`) and attached to every `axios` request via interceptor (`src/lib/utils.ts`).
   - `isFirstTime`: Boolean controlling whether `/` onboarding carousel (`src/routes/__routes/index.tsx`) is shown.
2. **Route Guards**:
   - `/__routes` (`src/routes/__routes.tsx`): Loads store, fetches session via `authClient.getSession`, redirects first-time unauthenticated users to `/` and returning authenticated users to `/dashboard`.
   - `/__routes/__auth` (`src/routes/__routes/__auth.tsx`): Redirects authenticated users away from `/login` to `/dashboard`.
   - `/__routes/__protected` (`src/routes/__routes/__protected.tsx`): Redirects unauthenticated users to `/login`.
3. **Dashboard (`src/routes/__routes/__protected/dashboard.tsx`)**:
   - Search params validated via Zod (`page`, `limit`, `search`, `tab`, `projectId`).
   - Uses TanStack Query for `todos`, `projects`, `tags`, `todo-stats`, and `connection` (`invoke("is_online")`).
   - Supports drag-and-drop reordering (`@hello-pangea/dnd`), inline title/description/dueDate editing, priority/status dropdowns, and a modal editor.

---

## 7. Environment Variables & Commands

### Environment Variables
- **Frontend (`.env`)**:
  - `VITE_API_URL`: Backend base URL (e.g., `http://localhost:3001` or `https://todo-api.cakwei.dev`).
- **Backend (`src-backend/.env`)**:
  - `DATABASE_URL`: MySQL/MariaDB connection string for Prisma.
  - `REDIS_URL`: Redis connection string for rate limiting.
  - `BETTER_AUTH_URL`: Base URL for Better Auth & CORS allowlist.
  - `BETTER_AUTH_SECRET`: Secret key used by Better Auth.

### Development & Build Commands
```bash
# Root (Frontend + Backend concurrently)
npm run dev                  # Starts backend (port 3001) and frontend (port 3000)
npm run build                # Vite production build
npm run check                # Biome lint + format check

# Backend (src-backend/)
npm run dev                  # tsx watch src/index.ts
npm run build                # prisma generate && tsup --format esm --platform node
npm run start                # node dist/index.js

# Tauri Desktop
npx tauri dev                # Launches Tauri window with dev server
npx tauri build              # Builds native installer (.dmg, .msi, .deb, .rpm, .appimage)
```
