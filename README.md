# Ops Task Portal

**A task manager for an operations team.** Create, assign and track tasks, see at a
glance what's overdue or due today, and get a daily email summary.

Built for Shikho's Program Operations team.

---

## Features

- **Task board:** Active, Due Today, Overdue and Done views, with sorting and status filters
- **Task drawer:** Create and edit tasks with owner, due date, status and description
- **Searchable dropdowns:** Quick picking of people and categories
- **Daily email report:** `/api/send-report` emails a summary of today's tasks to a configurable recipient list (Bangladesh time)
- **Settings:** Turn email reports on or off and manage recipients from the UI
- **Light / dark theme**, plus a small confetti burst when a task is marked done

## Tech stack

- **Next.js** (App Router) + **TypeScript**
- **Firebase / Firestore** for tasks and settings
- **Nodemailer** (Gmail) for reports
- **Framer Motion** + **Lucide** icons
- Deployed on **Vercel**

## Run locally

```bash
npm install
```

Create `.env.local`:

```bash
# Firebase web config: see firebaseClient.ts for the keys it reads
EMAIL_USER=you@gmail.com
EMAIL_PASS=your-gmail-app-password
```

```bash
npm run dev
```

Open http://localhost:3000.

## Notes

`PRODUCTION_AUDIT.md` and `PRODUCTION_FIXES_SUMMARY.md` record the production-readiness
review and the fixes made after it.

---

Built by [Sahidul Turab](https://github.com/sahidul-turab).
