# Bus Booking Web App

React (Vite) frontend + Express backend + Supabase (Postgres + Auth).

## Structure
- `frontend/` — React app (Vite + Tailwind CSS v4). Talks to Supabase directly for auth + public reads; talks to `backend/` for bookings, payment, tickets, admin.
- `backend/` — Express API. Uses the Supabase `service_role` key. Verifies the user's Supabase JWT on every request.
- `supabase/schema.sql` — tables, RLS policies, `create_booking` function, and sample data. Paste the whole file into the Supabase SQL editor. Re-running it resets the sample data.

This app models **one bus operator** (like FlixBus / Zingbus). A bus is identified by its
registration number (`reg_no`); the company name is set via `COMPANY_NAME` / `VITE_COMPANY_NAME`.

## Setup

1. Create a project at https://supabase.com. From Settings -> API copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key
2. In the Supabase SQL editor, run `supabase/schema.sql`.
3. Backend:
   ```
   cd backend
   cp .env.example .env      # fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
   npm install
   npm run dev               # http://localhost:4000
   ```
4. Frontend:
   ```
   cd frontend
   cp .env.example .env      # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
   npm install
   npm run dev               # http://localhost:5173
   ```
5. Sign up in the app. To make yourself admin, run in the SQL editor:
   ```
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
   ```

## Payment
Mock only — the "Pay now" button calls `POST /api/bookings/:id/pay` which flips the booking to `confirmed`.
