# AGENTS — Architecture Guide for G2G-ICGMT v2.0

## Overview

This is a TanStack Start (React 19, SSR) application using file-based routing.
React Context provides legacy UI state; Netlify functions persist tenant data to
Postgres through Drizzle and evidence/report binaries to Netlify Blobs. The newer
`/app/*` workspace platform uses membership-based organization authorization.
Stabilize Netlify first and retain existing routes/data during consolidation.

## Key Directories

```
src/
  lib/
    data.ts        — Canonical question bank (450-question base), demo data, scoring helpers
    context.tsx    — AppProvider: auth state, scores (mutable), CIP statuses
    utils.ts       — cn() Tailwind utility
  components/
    ui.tsx         — Shared UI primitives (Card, Badge, Button, Input, Select, Table, Accordion, ProgressBar)
    AppLayout.tsx  — Sidebar nav layout, role switcher, mobile drawer
  pages/
    AuthPage.tsx   — Login/Register screen (standalone, no AppLayout)
    DashboardPage.tsx — Executive dashboard with Recharts visualizations
    AssessmentPage.tsx — 5-tier wizard with sliders, dropzone, real-time risk badges
    CIPPage.tsx    — Capacity Development Plan table, status tracking
    AdminPage.tsx  — Super Admin portal (restricted by role='super_admin')
  routes/
    __root.tsx     — Root document shell, wraps with AppProvider
    index.tsx      — Redirect based on auth state
    auth.tsx       — /auth route
    dashboard.tsx  — /dashboard route
    assessment.tsx — /assessment route
    cip.tsx        — /cip route
    admin.tsx      — /admin route
```

## State Architecture

- `AppProvider` (context.tsx) wraps the entire app at the root level
- `scores`: `Record<orgId, Record<qId, number>>` — mutable per-org assessment scores
- `updateScore(orgId, qId, value)` → triggers re-render of Dashboard charts in real-time
- Legacy view levels control navigation; server authorization must independently
  enforce tenant, role, expiry, and read/write access.
- `/app/*` roles are owner/admin/assessor/viewer, scoped through membership.
- Legacy string tenant IDs and workspace integer organization IDs are distinct.

## Mock Data

All data is in `src/lib/data.ts`:
- `MOCK_QUESTIONS`: canonical base bank across 5 tiers and 20 domains; climate adds four domain labels
- `MOCK_ORGANIZATIONS`: 4 orgs (Kenya, Uganda, Tanzania, Nigeria)
- Helper functions: `computeOrgScore`, `computeTierScore`, `computeDomainScore`, `computeCompositeIndices`, `getReadinessClassification`, `getRiskColor`

## Design System

- **Palette**: Slate (neutrals), Emerald (primary/success), Indigo (AI), Amber (high-risk), Rose (critical)
- **Score colors**: ≤1 = Rose (Critical), 2 = Amber (High), 3 = Yellow (Moderate), 4+ = Emerald (Low)
- **Font**: Inter (body), JetBrains Mono (Q_IDs and code)
- Tailwind CSS v4 with `@import "tailwindcss"` (no config file needed)

## Conventions

- No `'use client'` directives (not Next.js — this is TanStack Start)
- Prefer inline Tailwind over CSS files
- All chart components use `ResponsiveContainer` from Recharts
- Route files are thin wrappers: import page component, wrap in AppLayout
- TypeScript strict mode — avoid unused variables/imports
