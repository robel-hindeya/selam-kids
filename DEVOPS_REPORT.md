# Selam Kids — DevOps Readiness Report

> **Generated:** 2026-09-16
> **Commit analyzed:** `bfbbf86` (branch `main`, clean tree)
> **Live app:** https://selam-kids.vercel.app/home
> **Repo:** https://github.com/robel-hindeya/selam-kids.git
> **Scanner scope:** architecture, dependencies, security, CI/CD, testing, code quality, observability

---

## 1. Executive Summary

| Area | Assessment | Grade |
|------|-----------|-------|
| Build / Deploy | Builds clean with Vite 8; deploys to Vercel | C+ |
| Project architecture | Hybrid full-stack (React SPA + Express + Postgres + Supabase) | B- |
| Containerization / IaC | **None** — no Docker, no Terraform | D |
| CI/CD | **None** — No GitHub Actions / Jenkins / GitLab, relies on Lovable | F |
| Automatic testing | **Zero test files, no test framework** | F |
| Code quality gates | ESLint 1245 errors, tsc 3 errors, no typecheck script | D |
| Security | 2 critical, 3 high-risk findings | D |
| Observability | No logging framework, no APM, ad-hoc console only | D |
| Dependency hygiene | Dual lockfiles, beta deps, 1 dead dep, no audit gate | C- |

**Bottom line:** The app builds and runs, but it is **not DevOps-ready**. There is no automated verification of any kind, no CI, no test suite, no security hardening, and a hidden legacy backend with fully open admin endpoints. See Section 11 for the prioritized action plan.

---

## 2. Project Overview & Architecture

### 2.1 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19.2, TanStack Start 1.168.32, TanStack Router 1.170.18 (file-based routes) |
| SSR / Build | Nitro 3.0.260603-**beta**, Vite 8.1.5 (`@lovable.dev/vite-tanstack-config`) |
| Styling | Tailwind CSS 4.2.1 + shadcn/ui (new-york), ~40 Radix primitives |
| Backend API | Express 5.2.1, cors, cookie-parser, multer |
| Auth | Supabase auth + Passport Google OAuth + JWT (httpOnly cookie, 30d) |
| Primary DB | PostgreSQL via `pg` (tables auto-created at boot) |
| Secondary DB | Supabase (`profiles`, `avatars` storage bucket) |
| Legacy stores | 3 overlapping JSON file stores |
| Language | TypeScript 5.8 (frontend), JavaScript ESM (backend) |
| Node | 24.x (`.nvmrc`, `engines`) |

### 2.2 Directory Map

```
selam-kids/
├── src/                    # Frontend + TanStack Start app
│   ├── routes/             # File-based routes (home, library, story, auth, admin, superadmin…)
│   ├── components/         # kids/ (app-specific) + ui/ (~45 shadcn primitives)
│   ├── hooks/              # useAuth (tri-mode auth), use-mobile
│   ├── lib/                # supabase client, error capture, error-page, lovable telemetry
│   ├── data/               # JSON datastores (legacy) + seed data
│   ├── assets/             # local images
│   ├── api/                # Nitro/TanStack Start serverless entry
│   ├── backend/            # LEGACY JSON-file Node server (server.js + bannerStore.js)
│   ├── router.tsx / server.ts / start.ts / routeTree.gen.ts / styles.css
├── backend/                # PRIMARY Express API (PostgreSQL-backed)
│   ├── index.js / app.js
│   ├── routes/             # auth.js, user.js, admin.js, public.js
│   ├── models/ middleware/ lib/ auth/ api/handler.js
│   └── data/               # banners.json, magazines.json (seed + JSON store)
├── api/                    # Vercel serverless refs → backend/api/handler.js
├── data/                   # leftover JSON datastore (data/banners.json)
├── public/                 # static assets + uploads/ (user-uploaded images)
├── supabase_setup.sql      # manual Supabase migration (profiles, RLS, avatars)
├── vercel.json             # Vercel deploy config
└── *.lock                  # package-lock.json (npm) + bun.lock (bun) — BOTH present
```

### 2.3 Runtime Topology

```
Browser (React SPA, TanStack Router)
   │
   ├── TanStack Start / Nitro / Vite  ── SSR (src/server.ts) + src/api/* forwarders
   │        │
   │        └── Dev proxy: /api, /uploads ──► Express :4000 (DevServer :8080)
   │
   └── /api, /uploads  ─────────────────► Express 5 backend
                                              │
          routes: auth · me · upload · banners · magazines · feedback
                  admin/* · superadmin/*
                                              │
            PostgreSQL (primary, self-migrating at boot)
              ├── users, magazines, banners, feedback, activity_logs, magazine_sales
              └── SUPERVISED via SUPERADMIN_EMAIL env
            Supabase (auth, profiles, storage) ⇄ synced into Postgres
            JSON files (legacy third copy)

Deploy: Vercel serverless
   ├── api/*.js → backend/api/handler.js (Express + PG in a serverless function)
   └── npm run build → Vite output (.output) served by Nitro
```

### 2.4 Architecture Observations

- **Dual backends:** a modern Express/Postgres backend (`backend/`) and a **legacy raw-Node/JSON backend** (`src/backend/server.js`, 1,508 lines) that is still wired through `src/api/index.js`.
- **Tri-storage data layer:** Postgres (primary), Supabase (auth + profiles), and JSON files (banners/magazines seed + legacy stores) overlap for the same entities.
- **React Query is installed and provided** (QueryClient + QueryClientProvider) but **never used** — all data fetching is raw `fetch()` + `useEffect`.
- **API has no client abstraction** — duplicated fetch URLs and inline error handling across route components.
- Git history shows healthy evolution (`backend → ng → new → … → postgresql up → auth → superadmin → role`) but also a past MongoDB phase whose remove is incomplete (root `data/banners.json` leftover).

---

## 3. Dependencies & Package Management

### 3.1 Inventory

- **64 runtime dependencies**, **16 dev dependencies**.
- Key: React 19.2.8, Express 5.2.1, `pg` 8.23.0, `@supabase/supabase-js` 2.116.0, JWT 9.0.3, multer 2.3.0, passport 0.7.0, zod 3.24.2, Tailwind 4.2.1.
- Lockfiles: **both `package-lock.json` (npm) and `bun.lock` (bun)** are committed.

### 3.2 Findings

| # | Finding | Risk | Detail |
|---|---------|------|--------|
| 1 | Dual package-manager lockfiles | Medium | Mixed installs produce different trees → drift in production vs CI. Pick one manager. |
| 2 | `nitro` is a beta release in the dependency tree | Medium | `3.0.260603-beta` — beta software in a production build. |
| 3 | `@tanstack/router-plugin` in `dependencies` instead of `devDependencies` | Low | Build-time tool shipped as runtime dep. |
| 4 | `express-session` (1.19.0) declared but **never imported** | Low | Dead dependency, prune. |
| 5 | `bunfig.toml` has a 24h `minimumReleaseAge` supply-chain guard | Good | Mitigates malicious early releases (excludes 4 `@lovable.dev` pkgs). |
| 6 | No `npm audit` / Snyk / Dependabot + no CI | High | No automated vulnerability scanning anywhere. |

---

## 4. Security Scan

### 4.1 Critical / High Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| C1 | **Critical** | Legacy backend admin routes have **NO authentication** — full content CRUD + feedback read/delete by anyone | `src/backend/server.js:224-280` (`/api/admin/magazines`, `/api/admin/banners`, `/api/admin/feedback`) |
| C2 | **Critical** | **Hardcoded JWT secret fallback** `"local-development-secret"` → token forgery → any account incl. superadmin if env unset | `src/backend/server.js:107,140` |
| H1 | High | **No rate limiting** on login/register/session/feedback — brute-force and credential-stuffing exposed | `backend/routes/auth.js` |
| H2 | High | **Unsanitized file upload** in legacy server — any extension written to `public/uploads` (stored XSS via `.html`/`.svg`) | `src/backend/server.js` `saveUpload()` |
| H3 | High | **CORS over-permissive:** `origin: true` (reflects any origin) + credentials; legacy sets `allow-origin: *` + `allow-credentials: true` | `backend/app.js:21`, `src/backend/server.js:34` |

### 4.2 Medium Findings

| # | Finding | Location |
|---|---------|----------|
| M1 | No `helmet` / security headers (no CSP, HSTS, X-Frame-Options, etc.) | `backend/app.js` |
| M2 | No CSRF protection on cookie-authenticated Express routes (TanStack CSRF only guards `serverFn`) | `src/start.ts` |
| M3 | `userId` accepted from request body on `POST /api/feedback` → spoofable | `backend/routes/public.js:35` |
| M4 | PostgreSQL SSL `rejectUnauthorized: false` | `backend/lib/postgres.js:17` |
| M5 | SVG uploads allowed on admin route (`mimetype.startsWith("image/")`) — SVG can carry scripts | `backend/routes/admin.js` |
| M6 | `dangerouslySetInnerHTML` injecting color values into `<style>` without validation | `src/components/ui/chart.tsx` |

### 4.3 What Is Done Right

- All SQL is **parameterized** (`$1…`) — no SQL injection found.
- Passwords hashed with **scrypt + 16-byte salt + timing-safe compare**.
- JWT cookies are **HttpOnly + SameSite=Lax + Secure-in-prod**, 30-day expiry.
- Role enforcement (`requireAuth`/`requireAdmin`/`requireSuperAdmin`) + disabled-account checks in the modern backend.
- `.gitignore` covers `.env*`, and `git ls-files` confirms **no secrets are tracked**.

### 4.4 Secret Exposures

- **No** `.env` files in repo (good).
- **No** committed API keys, `sk_`/`pk_` tokens, or OAuth secrets.
- **Missing `.env.example`** — 11 env variables are undocumented (see Section 8).

---

## 5. CI/CD Assessment

### 5.1 Current State

| Capability | Status |
|-----------|--------|
| GitHub Actions | ❌ Not present |
| GitLab CI / Jenkins / CircleCI / Travis | ❌ Not present |
| Vercel config | ✅ `vercel.json` (build `npm run build`, `api/**/*.js` 30s max) |
| Lovable pipeline | ✅ Managed editor-side (commits on connected branch trigger it) |
| Docker / containers | ❌ None |
| Terraform / IaC | ❌ None |
| Deployment scripts | ❌ None (no Makefile, no shell scripts) |

**Consequence:** Zero automated verification before the connected branch is deployed. Lint failures, type errors, and missing tests all ship silently to production via Lovable → Vercel.

### 5.2 Recommended Pipeline (GitHub Actions)

```
PR / push to main
├── 1. install        npm ci
├── 2. lint           npm run lint
├── 3. typecheck      npx tsc --noEmit          (add script)
├── 4. test           npx vitest run            (add framework)
├── 5. build          npm run build
├── 6. audit          npm audit --audit-level=high
└── 7. deploy         (Vercel / Lovable continues as today)
```

---

## 6. Testing Status

| Area | Status |
|------|--------|
| Unit / component tests | ❌ 0 test files in repo |
| E2E tests | ❌ None |
| Coexistence w/ Vite | ✅ Would fit Vitest (same toolchain) |
| Framework config | ❌ None requested |
| Coverage | ❌ None |
| Accessibility | ❌ None (`axe`/`@axe-core/playwright` absent) |
| Performance | ❌ None (no Lighthouse, no `web-vitals` budget) |

**Recommended stack:** Vitest (unit/component, shares Vite config) + Playwright (E2E on `/home`, `/library`, `/auth`, `/story/:slug`) + `@testing-library/react` + `supertest` for the Express API. Add `test` / `coverage` scripts.

---

## 7. Code Quality Gates

### 7.1 Verified Current State (ran 2026-09-16)

| Gate | Command | Result |
|------|---------|--------|
| Lint | `npm run lint` | ❌ **1252 problems (1245 errors, 7 warnings)** — 1235 auto-fixable (Prettier drift) |
| Typecheck | `npx tsc --noEmit` | ❌ **3 errors** (admin.tsx:138,153 undefined-object; superadmin.tsx:277 index-signature access) |
| Build | `npm run build` | ✅ Passes (1.17s); Nitro emits `.output/` + `wrangler.json` |
| Format | `npm run format` | Available (Prettier, would fix most of the 1235) |

### 7.2 Config Notes

- ESLint 9 flat config with TS + react-hooks + react-refresh + prettier. **`no-unused-vars` disabled** in both ESLint and `tsconfig` (`noUnusedLocals/Parameters: false`) — dead code passes silently.
- `tsconfig.json` is deliberately strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …) but **has no `typecheck` script**, so strictness is never enforced in a documented command.
- **No husky / lint-staged / pre-commit hooks** — `.git/hooks` contains only samples.
- `build_output.txt` (committed) records a historic failed build from another machine (`/home/robel/Downloads/…`) due to a missing asset — the current build passes. The referenced file `selamkids-logo.png` is still missing from `public/`; `LoginModal.tsx:3` uses `/selamkids-logo.png` (runtime 404 on that image only, not a build blocker).

---

## 8. Configuration & Environment

### 8.1 Required Environment Variables (undocumented)

| Variable | Purpose | Status |
|----------|---------|--------|
| `DATABASE_URL` / `POSTGRES_URL` | Postgres connection (dev fallback: localhost) | Required |
| `JWT_SECRET` | JWT signing secret | Required (throw if missing in modern backend) |
| `SUPERADMIN_EMAIL` | Comma-separated auto-promotion | Required |
| `VITE_SUPABASE_URL` | Supabase project URL | Required |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Required |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google OAuth | Required |
| `FRONTEND_URL` | CORS allowed origin | Required for prod |
| `PORT` | Express port (default 4000) | Optional |
| `SESSION_SECRET` | Referenced but unused | Dead |

### 8.2 Issues

- ❌ No `.env.example` — `.gitignore` even re-ignores it on line 38. New environments must be reverse-engineered.
- ✅ `.nvmrc` / `engines` pin Node 24.
- ✅ `.gitignore` covers `node_modules`, `.output`, `.vinxi`, `.tanstack`, `.nitro`, `.wrangler`, `.dev.vars`.

---

## 9. Observability & Logging

- ❌ No structured logger (no pino/winston/morgan) — raw `console.log/error` (~30 sites).
- ❌ No APM / error tracker / analytics in production (Sentry, Datadog, etc. absent).
- 🟡 Lovable telemetry exists but only fires inside the Lovable editor preview (`window.__lovableEvents`), not production.
- 🟡 SSR error resilience layer exists: `error-capture.ts` (console.error monkey-patch + cause-chain expansion), `error-page.ts` (canned HTML 500 page), `server.ts` (recovers h3-swallowed errors).
- 🟡 DB-backed activity/audit logging (`activity_logs` table) for admin actions.
- ✅ Health endpoint `GET /api/health` returns `{ ok, service }` in both server modes.

---

## 10. Database & Data Management

- **No migration tool** (Prisma/Drizzle/Knex absent). Schema evolves via `CREATE TABLE IF NOT EXISTS` + `ALTER … ADD COLUMN IF NOT EXISTS` at boot (`backend/lib/postgres.js`, 187 lines).
- Tables: `users`, `magazines`, `banners`, `feedback`, `activity_logs`, `magazine_sales`; seeded from JSON when empty.
- Supabase schema handled by committed-but-manual `supabase_setup.sql` (profiles, RLS, avatars bucket) — applies only if run by hand in the Supabase SQL editor.
- **Risk:** no versioned/controlled migrations → schema changes are implicit, unreviewed, and not reproducible in CI.

---

## 11. Prioritized Action Plan

### Critical (do these first)

1. **C1 — Secure or remove the legacy backend.** Either delete `src/backend/server.js` + `src/api/index.js` or add the same auth middleware used by `backend/`. Currently anyone can delete feedback and edit all content through that path.
2. **C2 — Remove the hardcoded JWT fallback.** Make `JWT_SECRET` required everywhere and fail fast when missing (as `backend/` already does).

### High

3. **Add rate limiting** to auth + public write endpoints (`express-rate-limit`).
4. **Restrict file uploads** on the legacy path; block SVG/HTML in admin uploads; verify stored files are served with `X-Content-Type-Options: nosniff`.
5. **Tighten CORS:** set `FRONTEND_URL` as a bounded allowlist; never reflect origin with credentials.
6. **Add `.env.example`** documenting all 11 variables.
7. **Enable Helmet + security headers** in both servers.
8. **Enforce CSRF** on Express cookie-authenticated mutation routes (or require auth via header/anti-CSRF token).

### Medium

9. **Add CI (GitHub Actions):** install → lint → typecheck → test → build → audit, before deploy.
10. **Introduce Vitest + Playwright + supertest** with a baseline smoke test suite; add `typecheck` and `test` scripts.
11. **Fix the 3 tsc errors + run `prettier --write`** to clear the 1,235 auto-fixable lint errors; then re-enable unused-vars rules.
12. **Enforce a single package manager** (drop `bun.lock` or `package-lock.json`) and pin/review `nitro` beta.
13. **Stop taking `userId` from feedback request bodies** — resolve from the session cookie.
14. **Evaluate PG auth:** set `sslmode=require` and a real CA chain instead of `rejectUnauthorized: false`.

### Low / hygiene

15. Pick one dependency lockfile; prune `express-session`; move `@tanstack/router-plugin` to devDependencies.
16. Add npm audit / Dependabot into the CI loop.
17. Add pre-commit hooks (`husky` + `lint-staged`).
18. Restore the missing `public/selamkids-logo.png` (or bind `LoginModal` to `@/assets/logo.jpg` like `Sidebar.tsx`).
19. Add `npm-run-all`-style licenses audit and a `SECURITY.md` template.

---

## 12. Scorecard

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Build reliability | 6/10 | Builds green, but untested / unguarded |
| CI/CD automation | 1/10 | None |
| Test coverage | 0/10 | No tests |
| Security posture | 3/10 | 2 critical + 3 high findings |
| Dependency health | 5/10 | Dual lockfiles, beta, no audit |
| Code quality gates | 3/10 | Lint/tsc failing, no hooks |
| Observability | 2/10 | Console-only logging |
| Config management | 4/10 | No `.env.example`, no migrations |

**Overall DevOps readiness: 3/10 — "runs, but fragile."**