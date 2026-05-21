# GymAssist AI

GymAssist AI is a modern gym management dashboard for Indian gym owners. It helps manage members, recurring renewals, payments, dues, receipts, reminders, and AI-generated diet/workout plans from one workspace.

## Features

- Member onboarding with membership plans and expiry tracking
- Recurring membership renewals for monthly, quarterly, half-yearly, and yearly payments
- Active, expiring soon, and expired member filters
- Payment recording with dues, receipts, renewal history, and UPI support
- Gym branding settings for gym name, GST number, UPI ID, and standard plan fees
- AI assistant for payment reminders, renewal messages, revenue summaries, diet plans, and workout plans
- Supabase-backed per-gym member and payment tables

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Supabase
- Groq/OpenAI/Gemini-compatible AI provider fallback

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env.local` and add:

```env
AI_PROVIDER=auto
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
OPENAI_API_KEY=optional_backup_key
GEMINI_API_KEY=optional_backup_key

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
AUTH_SESSION_SECRET=your_auth_session_secret
```

Run the required Supabase migrations from the `supabase/` folder in Supabase SQL Editor, especially:

- `auth_security.sql`
- `gymassist_user_tables.sql`
- `billing_payment_tracking.sql`

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev      # start local development server
npm run build    # production build
npm run start    # start production server
npm run lint     # run eslint
```

## Notes

This app uses secure server-side Supabase access. Keep `SUPABASE_SERVICE_ROLE_KEY` only in trusted server environments and never expose it to the browser.
