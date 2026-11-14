# Cakwei's TODO

An offline-first, cross-platform desktop todo application built with **Tauri v2**, **TanStack Start / Router / Query**, **Hono**, and **Prisma**.

## Features

- **3-Column Split-Pane Workspace**: Slim `IconRail` navigation, center task stream with circular progress ring & inline quick-add, and a persistent right-hand `TodoInspector`.
- **Offline-First SQLite Vault**: Tasks, projects, and tags are cached locally via `@tauri-apps/plugin-sql` (`sqlite:offline.db`) with an automatic background mutation outbox and Last-Write-Wins sync.
- **Projects, Tags, Subtasks & Attachments**: Organize tasks with color-coded projects, smart tags, nested subtasks with progress tracking, file/URL attachments, recurrence, and activity logs.
- **Desktop Integrations**:
  - OS Keychain-secured auth token storage (`keyring`)
  - Native due-date & reminder notifications (`@tauri-apps/plugin-notification`)
  - System tray & global quick-capture shortcut (`⌘⇧N` / `Ctrl+Shift+N`)
- **Light & Dark Themes**: Nordic Paper & Forest Sage (light) and Nordic Pine (dark) with a single `Manrope` typeface.

## Tech Stack

- **Desktop Shell**: Tauri v2 (Rust)
- **Frontend**: React 19, TanStack Start, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui
- **Backend**: Hono, Better Auth, Prisma ORM (PostgreSQL)
- **Testing**: Vitest (`npx vitest run`)

## Getting Started

### 1. Install Dependencies

```bash
npm install
cd src-backend && npm install
```

### 2. Environment Variables

Configure `.env` in the root and `src-backend/.env` with your database URL, Better Auth secret, and `VITE_API_URL`.

### 3. Run in Development

```bash
# Start backend API
cd src-backend && npm run dev

# Start Tauri desktop app
npm run tauri dev
```

### 4. Typecheck & Test

```bash
npx tsc --noEmit
npx vitest run
```

## License

MIT — see [LICENSE.md](./LICENSE.md).
