# Run Doc — Ansharussunnah LMS

## How to reproduce uncommitted artifacts
- Copy `.env.local` from the main checkout (contains DATABASE_URL, SUPABASE keys, etc.)
- Run `npm install` to install dependencies
- Run `npx prisma generate` to generate Prisma client

## How to run the server
```powershell
npm run dev -- -p 4000
```

## Current state
- Server running on port 4000 (Next.js 15.5.24)
- Logo: `/public/ansharussunnah-logo.webp` (47KB, transparent WebP)
- All dashboard pages are Server Components with Client Component wrappers
- TypeScript: 0 errors
- Sentry removed (module not installed)
