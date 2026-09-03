<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Dental Clinic Manager project guidance

## Project scope

- This is an existing multi-tenant dental clinic SaaS. Extend the current application in place; do not rebuild it, replace its architecture, or introduce a parallel data model.
- Preserve existing routes, working components, authentication, Supabase integration, responsive behavior, and stored data unless a task explicitly requires a compatible change.
- Reuse shared components and utilities before creating new ones. Keep changes focused on the requested feature and avoid unrelated redesigns or refactors.
- The main application shell is `src/components/clinic/clinic-app.tsx`. Feature pages live in `src/components/clinic/pages/`, shared UI primitives in `src/components/ui/`, and shared application types in `src/lib/types.ts`.

## Technology and conventions

- Use Next.js 16.3, React 19, TypeScript, Tailwind CSS 4, the existing shadcn-style primitives, Lucide icons, Recharts, and Supabase.
- Before using or changing a Next.js API, read the relevant local documentation under `node_modules/next/dist/docs/` as required by the generated rules above.
- Keep TypeScript strict and avoid adding `any` unless an external boundary genuinely requires it and the scope is documented.
- Use the existing path alias (`@/`) and current component patterns. Do not add a new state-management, styling, form, calendar, or data-fetching framework without a clear need.
- Keep dependencies pinned to exact versions and update `package-lock.json` whenever dependencies change.

## Supabase and tenant isolation

- Treat Supabase as the source of truth whenever it is configured. Demo data may support local preview, but must never replace or shadow persisted production data.
- All clinic-owned rows must include `clinic_id`. Cross-table relationships must preserve tenant consistency, preferably through composite `(id, clinic_id)` foreign keys.
- Enable RLS on every new table in `public`, add explicit grants, and create role-aware policies for every supported operation.
- Do not trust UI permission checks as authorization. Enforce protected actions in RLS and narrowly scoped database functions.
- Use additive, forward-only migrations in `supabase/migrations/`. Never drop or reset production data, recreate working tables, or edit an already-applied migration to change deployed behavior.
- Prefer atomic database functions for workflows that affect multiple financial or clinical records. Validate tenant membership, staff role, amounts, status transitions, conflicts, and duplicate prevention inside the transaction.
- Keep clinical session completion separate from payment status. Recording a payment must not implicitly complete clinical work.
- Purchase orders and purchase lists must not change inventory quantities. Stock changes require a distinct inventory movement.
- When adding Realtime-backed data, update both the publication migration and `src/lib/supabase/realtime.ts`.

## Localization and visual behavior

- Preserve complete English and Arabic support. English is LTR; Arabic is RTL and uses Cairo.
- Add translations for every new visible label, status, validation message, toast, tooltip, dialog, and system-generated phrase in `src/lib/clinic-preferences.tsx`.
- Do not translate patient names, clinical notes, SKUs, supplier names, identifiers, or other user-generated/database content. Mark such content with `data-no-translate` where needed.
- Use logical-direction Tailwind utilities (`start`, `end`, `ms`, `me`, `ps`, `pe`) when practical. Mirror directional icons and layout behavior in RTL.
- Preserve the existing sharp, professional medical design system. Prefer shared primitives and theme tokens over one-off styling.
- Maintain the existing desktop sidebar and mobile navigation behavior. Desktop-only hover interactions must not be forced onto touch/mobile layouts.
- Printable receipts and purchase orders must use the existing `.print-area` behavior and remain legible in both languages.

## Data and financial consistency

- Keep the relationship Patient → Treatment Plan → Treatment Item → Session → Invoice → Payment intact.
- Payment summaries must aggregate transactions once per invoice. Prevent duplicate payments and overpayment at the database layer.
- Keep treatment prices, discounts, session expected amounts, collected totals, remaining balances, patient balances, receipts, dashboard KPIs, and reports synchronized from the same persisted records.
- Preserve user-entered content exactly. Formatting and localization belong in presentation utilities, not stored data.
- Use timezone-safe conversions for appointment dates and times; do not derive a clinic-local date by slicing a UTC timestamp.

## Verification

- For normal UI or TypeScript changes, run:

  ```bash
  npm run lint
  npm run typecheck
  npm run build
  ```

- For schema, RLS, or database-function changes, also run Supabase database lint/tests against a local stack when Docker or Podman is available. If the database stack is unavailable, state that limitation explicitly.
- Exercise affected workflows in the running application. Check desktop and mobile layouts, English and Arabic switching, RTL/LTR, permission-gated controls, refresh persistence, and browser console errors as relevant.
- Do not claim database persistence, RLS, Realtime, or migration execution was verified when only the demo fallback was available.

## Project size snapshot

- Maintained code files: **58**
- Total lines of code: **11,792**
- Counted file types: `.ts`, `.tsx`, `.css`, `.sql`, `.mjs`, `.json`, and `.toml`.
- Excluded from the count: `node_modules/`, `.next/`, `package-lock.json`, `tsconfig.tsbuildinfo`, documentation, and generated/cache files.
- Snapshot date: **2026-09-03**. Recalculate these values whenever project files materially change.
