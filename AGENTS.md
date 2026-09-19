# AGENTS — Architecture Guide for G2G-ICGMT v2.0

## Overview

This is a TanStack Start (React 19, SSR) application using file-based routing. All state is managed via React Context — there is no backend database (it's a prototype/demo with mock data).

## Key Directories

```
src/
  lib/
    data.ts        — All mock data, question bank (24 questions), org data, scoring helpers
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
    AdminPage.tsx  — Super Admin portal (restricted by role='admin')
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
- `currentUser.role`: `'assessor' | 'admin'` — controls nav visibility and Admin page access
- Multi-tenant isolation: assessors' `currentUser.orgId` scopes all score reads

## Mock Data

All data is in `src/lib/data.ts`:
- `MOCK_QUESTIONS`: 24 questions across 5 tiers, 13 domains
- `MOCK_ORGANIZATIONS`: 4 orgs (Kenya, Uganda, Tanzania, Nigeria)
- Helper functions: `computeOrgScore`, `computeTierScore`, `computeDomainScore`, `computeCompositeIndices`, `getReadinessClassification`, `getRiskColor`

## Design System

- **Palette**: Slate (neutrals), Indigo (primary), Emerald (success/low-risk), Amber (moderate), Rose (critical)
- **Score colors**: ≤1 = Rose (Critical), 2 = Amber (High), 3+ = Emerald (Low)
- **Font**: Inter (body), JetBrains Mono (Q_IDs and code)
- Tailwind CSS v4 with `@import "tailwindcss"` (no config file needed)

## Conventions

- No `'use client'` directives (not Next.js — this is TanStack Start)
- Prefer inline Tailwind over CSS files
- All chart components use `ResponsiveContainer` from Recharts
- Route files are thin wrappers: import page component, wrap in AppLayout
- TypeScript strict mode — avoid unused variables/imports
