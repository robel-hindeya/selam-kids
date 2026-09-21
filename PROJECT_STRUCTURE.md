<!-- # NOTE: PROJECT_STRUCTURE.md
     Role: Project Architecture Specification & Directory Map
     Standard: International Enterprise Clean Monorepo Architecture
-->

# Selam Kids — Enterprise Architecture & Project Structure

This document outlines the international enterprise directory architecture, architectural boundaries, and modular structure of the **Selam Kids** platform.

```
selam-kids/
├── api/                        # Vercel Serverless Function Gateway (mandated by Vercel)
│   ├── [...path].js            # Wildcard forwarder to Express API handler
│   └── index.js                # Root /api endpoint forwarder to backend handler
│
├── backend/                    # Core Backend Service (Node.js, Express, PostgreSQL)
│   ├── api/                    # Serverless Cloud Adapter (Vercel / Cloud Functions)
│   │   └── handler.js          # Serverless entry point wrapping Express app with DB pooling
│   ├── auth/                   # Identity & OAuth Authentication Providers
│   │   └── google.js           # Google OAuth 2.0 Passport strategy configuration
│   ├── data/                   # System Seed Stores & Fallback JSON Persistence
│   │   ├── banners.json        # Initial banner promotional items seed
│   │   └── magazines.json      # Initial magazine and story content seed
│   ├── lib/                    # Domain Services, Integration Clients & Infrastructure
│   │   ├── activity.js         # Audit logging and admin activity recorder
│   │   ├── bannerStore.js      # Dynamic banner storage and retrieval helpers
│   │   ├── postgres.js         # PostgreSQL connection pool, migrations, and seed runner
│   │   ├── supabaseSync.js     # User synchronization adapter between Supabase & PostgreSQL
│   │   └── chapa/              # Chapa Payment Gateway Domain Engine
│   │       ├── client.js       # Chapa API HTTP client (v2 API, HMAC validation)
│   │       ├── logger.js       # Structured audit logger for payment lifecycle events
│   │       ├── orders.js       # Order creation, calculation, and status persistence
│   │       ├── payments.js     # Payment records and transaction status tracking
│   │       ├── rate-limit.js   # Sliding-window rate limiter for checkout initialization
│   │       ├── service.js      # Payment orchestration service (verify, fulfill, webhook)
│   │       ├── status.js       # Normalized payment & order status state machine
│   │       └── validation.js   # Input validation schemas and integrity assertions
│   ├── middleware/             # HTTP Pipeline Interceptors
│   │   ├── auth.js             # JWT authentication, session verification & role enforcement
│   │   └── isAdmin.js          # Role-Based Access Control (RBAC) administrator guard
│   ├── models/                 # Persistence Layer Entities & Database Schemas
│   │   ├── Content.js          # Content management data access queries
│   │   ├── postgres.js         # PostgreSQL user and system account model methods
│   │   └── User.js             # Legacy user data abstraction layer
│   ├── routes/                 # RESTful API Presentation Controllers
│   │   ├── admin.js            # Admin dashboard, content moderation, analytics & user management
│   │   ├── auth.js             # Local credentials, registration, session & OAuth exchange
│   │   ├── payments.js         # Payment checkout initialization and verification endpoints
│   │   ├── public.js           # Public content (magazines, banners, feedback, health check)
│   │   ├── user.js             # User profile retrieval and account update endpoints
│   │   └── webhooks.js         # Third-party webhook listeners (Chapa payment webhooks)
│   ├── app.js                  # Express application composition, CORS, JSON parsers, routes
│   └── index.js                # Server entrypoint, HTTP listener & database connection trigger
│
├── docs/                       # Technical Documentation & Operational Runbooks
│   └── payments/
│       └── chapa.md            # Chapa payment integration guide and troubleshooting runbook
│
├── public/                     # Public Static Assets & Media Distribution
│   ├── robots.txt              # Search engine crawler directives
│   └── uploads/                # User and admin uploaded media assets (images, covers)
│
├── src/                        # Presentation Layer (React 19, TanStack Start & Router, Vite)
│   ├── assets/                 # Curated static illustrations, covers, and brand icons
│   ├── components/             # Component Architecture (Atomic & Domain-Driven)
│   │   ├── kids/               # Feature Components (Kid-friendly reading UI)
│   │   │   ├── EditProfileModal.tsx # Profile personalization dialog
│   │   │   ├── LoginModal.tsx       # Authentication & login dialog
│   │   │   ├── PayWithChapa.tsx     # Chapa payment checkout button and flow
│   │   │   ├── Sidebar.tsx          # Navigation drawer, top bar, and quick actions
│   │   │   └── StoryCard.tsx        # Magazine issue preview and interactive card
│   │   └── ui/                 # Atomic Design System Primitives (Radix UI + Tailwind)
│   │       ├── accordion.tsx   # Collapsible accordion item
│   │       ├── alert.tsx       # Status alert banner
│   │       ├── button.tsx      # Configurable interactive button
│   │       ├── dialog.tsx      # Accessible modal dialog
│   │       └── ...             # Complete Radix/Tailwind design component suite
│   ├── hooks/                  # Reusable Custom React Application Hooks
│   │   ├── use-mobile.tsx      # Responsive viewport and mobile breakpoint listener
│   │   └── useAuth.tsx         # Comprehensive auth context (Postgres + Supabase hybrid)
│   ├── lib/                    # Client Infrastructure & Core Utilities
│   │   ├── error-capture.ts    # Global error interceptor for SSR and client rendering
│   │   ├── error-page.ts       # Fallback disaster recovery error page template
│   │   ├── lovable-error-reporting.ts # Lovable error monitoring bridge
│   │   ├── payments.ts         # Frontend Chapa payment checkout client library
│   │   ├── supabase.ts         # Supabase client singleton instance
│   │   └── utils.ts            # Styling helper (clsx + tailwind-merge)
│   ├── routes/                 # File-based Type-Safe Routes (TanStack Router)
│   │   ├── __root.tsx          # Root layout with QueryClient and navigation shell
│   │   ├── admin.tsx           # Content manager and administrative control center
│   │   ├── auth.tsx            # Login, registration, and credential recovery portal
│   │   ├── home.tsx            # Kid reader homepage, featured banners and stories
│   │   ├── index.tsx           # Landing page with splash introduction
│   │   ├── library.tsx         # Browsable catalog and magazine archive
│   │   ├── messages.tsx        # User notifications and feedback inbox
│   │   ├── profile.tsx         # Kid reader profile, reading progress, and settings
│   │   ├── story.$slug.tsx     # Interactive digital storybook reader
│   │   ├── superadmin.tsx      # Super administrator system governance and user roles
│   │   └── payment/
│   │       └── status.$txRef.tsx # Post-payment verification and success screen
│   ├── router.tsx              # TanStack Router instance configuration
│   ├── routeTree.gen.ts        # Auto-generated route tree definitions
│   ├── server.ts               # SSR Nitro server wrapper with error normalization
│   ├── start.ts                # TanStack Start client bootstrapping entrypoint
│   └── styles.css              # Global styles, typography tokens, and Tailwind v4 theme
│
├── tests/                      # Automated Quality Assurance & Test Suites
│   └── backend/                # Server Unit & Integration Tests (Vitest)
│       ├── chapa/              # Payment service, webhook validation, and client tests
│       ├── middleware/         # Auth and RBAC middleware security verification tests
│       └── routes/             # Payments and webhooks API endpoint integration tests
│
├── AGENTS.md                   # AI Assistant Guardrails and Lovable Synchronization Rules
├── bunfig.toml                 # Bun runtime and package configuration
├── bun.lock                    # Bun lockfile
├── components.json             # shadcn/ui configuration metadata
├── DEVOPS_REPORT.md            # DevOps security and deployment audit report
├── eslint.config.js            # ESLint static analysis configuration
├── package.json                # Project dependencies, scripts, and runtime engines
├── package-lock.json           # Deterministic npm dependency lockfile
├── README.md                   # Project overview, developer onboarding, and run commands
├── supabase_setup.sql          # Supabase SQL schema migrations and initial tables
├── tsconfig.json               # TypeScript compiler configuration and path aliases
├── vercel.json                 # Vercel cloud deployment serverless function configuration
├── vite.config.ts              # Vite bundler, proxy rules, and TanStack Start plugins
└── vitest.config.ts            # Vitest unit test runner configuration
```

---

## Architectural Principles

1. **Separation of Concerns (SoC)**:
   - `src/` contains **strictly presentation code** (React components, routing, client hooks, and client utilities). No raw server implementations or database credentials reside here.
   - `backend/` contains **all server business logic, routes, database drivers, auth middleware, payment integration, and serverless handlers (`backend/api/handler.js`)**.

2. **Single Source of Truth for Data**:
   - Seed datasets and persistent data files are consolidated under `backend/data/`.
   - Production persistence is powered by **PostgreSQL** via connection pooling in `backend/lib/postgres.js`.

3. **Domain-Driven Payment Engine**:
   - The Chapa payment system is encapsulated in `backend/lib/chapa/` featuring strict input validation, HMAC-SHA256 webhook signature verification, replay protection, and transactional order fulfillment.

4. **Security & Role-Based Access Control (RBAC)**:
   - All administrative actions (`/api/admin/*`, `/api/superadmin/*`) require verified JWT authentication and role validation.
   - Credentials and secrets are exclusively loaded from environment variables (`.env`).
