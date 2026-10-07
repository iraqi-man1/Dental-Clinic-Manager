# Nargis Dental Clinic — Windows desktop app

A native Windows application (WPF, .NET 10) that connects to the same Supabase project as the web app.
Row-level security in PostgreSQL decides what each signed-in user can read and write, so the desktop app
never holds a service key and never bypasses those rules.

## Layout

| Project | Purpose | Runs on |
| --- | --- | --- |
| `src/NargisClinic.Core` | Auth, PostgREST client, clinic roles, patients, phone rules, time and money formatting | Any OS (.NET 10) |
| `src/NargisClinic.Desktop` | WPF shell, login, patients screen, English/Arabic UI, DPAPI session storage | Windows |
| `tests/NargisClinic.Core.Tests` | Unit tests for Core (run in CI on Linux) | Any OS |

Keeping the logic in `Core` means most behaviour is tested without a Windows machine.

## What works today

- Sign in with the clinic account email and password (Supabase Auth).
- Session restored on launch. Tokens are refreshed automatically and stored with Windows DPAPI, so only the
  same Windows user on the same PC can read them.
- Only accounts with an **active** clinic membership get in. Other accounts are signed out immediately.
- Navigation follows the role. Unknown roles see no screens (fails closed).
- Patients list: search by name, phone or patient number; paged 25 at a time; balance, age and last visit.
- English and Arabic, with right-to-left layout. The language choice is saved on this PC only and does not
  change screens for other staff.

Screens marked "Coming soon" (appointments, payments, staff, inventory, reports, settings) are on the roadmap.

## Configure the Supabase project

Use the **publishable** key only. Never put the service-role or secret key in this app.

Either edit `src/NargisClinic.Desktop/supabase.settings.json`:

```json
{
  "supabaseUrl": "https://YOUR-PROJECT.supabase.co",
  "supabasePublishableKey": "sb_publishable_..."
}
```

or set environment variables on the PC (preferred for shared or managed machines):

- `NARGIS_SUPABASE_URL`
- `NARGIS_SUPABASE_PUBLISHABLE_KEY`

Plain `http://` is rejected except for `localhost` / loopback addresses used in local development.

## Build and run (Windows)

Requirements: Windows 10/11 x64 and the [.NET 10 SDK](https://dotnet.microsoft.com/download).

```powershell
dotnet test desktop/tests/NargisClinic.Core.Tests          # Core unit tests
dotnet run --project desktop/src/NargisClinic.Desktop       # run the app
```

Single-file build (self-contained, no .NET install needed on clinic PCs, about 140 MB):

```powershell
dotnet publish desktop/src/NargisClinic.Desktop -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o desktop/publish
```

CI (`.github/workflows/desktop-windows.yml`) runs the Core tests on Linux, builds on `windows-latest`, runs a
smoke test that creates every window in both languages, and uploads `NargisClinic-win-x64` as an artifact.

## Security notes

- Access tokens and refresh tokens are encrypted with DPAPI (`CurrentUser` scope), not stored in plain text.
- Every request carries the user's own access token. Clinic scoping is enforced by RLS, and the client also
  filters by `clinic_id` for clarity.
- The UI hides screens a role cannot use, but that is cosmetic. RLS is the real control.
- Sign-out clears the local session first, so a failed network call cannot keep a user signed in.

## Known gaps

- Clinic timezone: `clinics.timezone` defaults to `America/Los_Angeles` in the database. The app honours the stored
  value and falls back to `Asia/Baghdad` only when the value is missing. Set the timezone for each clinic.
- Fonts: the UI uses Segoe UI, which includes Arabic glyphs on Windows. Bundling Cairo is a later step.
- Offline mode is not supported yet. A launch without network shows the login screen with a connection message and
  keeps the stored session.
