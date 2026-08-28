# BrightSmile Dental Clinic Manager

A responsive, multi-tenant dental practice workspace built with Next.js 16, TypeScript, Tailwind CSS 4, shadcn-style UI primitives, Recharts, and Supabase.

## Included

- Operational dashboard with appointments, patients, revenue, balances, treatments, charts, pipeline, and activity
- Searchable patient directory and complete patient profile
- Interactive universal-numbering 32-tooth odontogram with eight conditions/treatments
- Medical history, allergies, notes, visit timeline, X-rays, and clinical image uploads
- Day, week, and month appointment calendar with scheduling
- Drag-and-drop scheduling with simultaneous appointments, live procedure prices, and immutable booking snapshots
- Treatment plans embedded in patient profiles with procedures, pricing, sessions, progress, and status
- Partial/full payments, balance safeguards, transaction history, and printable clinic receipts
- Central price list, invited doctor/staff accounts, enforced role permissions, inventory alerts, reporting, and clinic settings
- Supabase Auth, SSR session refresh, Realtime subscriptions, private Storage, and PostgreSQL RLS
- Tenant-consistent composite foreign keys so records cannot reference entities from another clinic

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Supabase environment variables the app runs as a fully interactive in-memory demo.

## Connect Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and add the project URL, publishable key, and server-only secret key. The secret key is required for team invitations and must never be exposed through a `NEXT_PUBLIC_` variable.
3. Link the Supabase CLI and apply the migration:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

4. Add `http://localhost:3000/auth/callback` and `http://localhost:3000/update-password` to the Auth redirect allow list while developing. Add the corresponding production URLs before deployment.
5. Open `/login` to create the first clinic owner and tenant workspace.

Configured clinics intentionally start empty: the application does not seed or display demo records once Supabase variables are present. The migrations create all clinic tables, indexes, role-aware RLS policies, explicit Data API grants, the private `clinical-files` bucket, Realtime publication entries, doctor/patient assignments, and atomic appointment/invoice/payment functions.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

For database policy tests, run the local Supabase stack with Docker and use `npx supabase test db` before deploying schema changes.
