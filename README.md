# Pathshala: school management MVP

A clickable demo for a K–10 school (Play → Class 10, sections A/B, Morning/Day shifts). It uses sample data stored in the browser, with no backend yet.

```bash
npm install
npm run dev      # open the printed URL
npm run check    # self-check of seed data + grading rules
npm run build    # static build in dist/ (deploy anywhere)
```

Sign in by picking a role: **Super admin**, **Teacher**, **Accountant** or **Student**. Each role sees only its own menu. Use the avatar menu (top right) to switch roles during a demo, and press **⌘K / Ctrl+K** to search for any feature.

Data changes persist in the browser. To start fresh, use **Settings → Reset demo data**.

| Where | What |
|---|---|
| `src/lib/data.ts` | Types + seeded dummy data |
| `src/lib/store.tsx` | All reads/writes (swap point for Supabase) |
| `src/lib/grading.ts` | GPA-5 grading, attendance-weighted results, risk flags |
| `src/lib/export.ts` | Excel import/export, PDF marksheets/reports/receipts |
| `src/nav.ts` | Menu + role permissions |
| `src/pages/*` | One file per screen |

Backend setup is in [SUPABASE.md](SUPABASE.md).

## Deploy (demo)

The app is a static site and uses hash URLs (`/#/fees`), so it needs no server rewrites. On Vercel: **Add New → Project → import the GitHub repo → Deploy**. Vite is detected automatically (build `npm run build`, output `dist`). Every push to `main` redeploys.
