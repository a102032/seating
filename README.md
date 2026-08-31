# Seating Chart & Classroom Manager

An interactive seating chart app for a Smartboard and laptop, with drag-and-drop
seating, random student/row pickers, and a flip-clock countdown timer.

## Running it on your computer

```bash
npm install
npm run dev
```

Then open the web address it prints (something like `http://localhost:5173`).

## Connecting the shared online database (optional, but needed for real-time sync)

Right now the app saves everything to the browser it's running in, so it
already works fine on one device. To make the laptop and the Smartboard
update each other **instantly**, connect a free Supabase project:

1. Go to [supabase.com](https://supabase.com) and create a free account and a
   new project.
2. In your new project, open the **SQL Editor** and run everything inside
   [`supabase/schema.sql`](./supabase/schema.sql) - this creates the one
   table the app needs and turns on real-time sync.
3. In your Supabase project, go to **Project Settings -> API**. Copy the
   **Project URL** and the **anon public** key.
4. In this project's folder, copy `.env.example` to a new file named `.env`
   and paste your two values in:

   ```bash
   cp .env.example .env
   ```

   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

5. Restart `npm run dev`. Any laptop and Smartboard pointed at the same
   deployed app will now sync seating, rosters, and classes instantly.

`.env` is already ignored by git, so your keys never get committed.

## Building for deployment

```bash
npm run build
```

This produces a `dist/` folder you can host anywhere that serves static
files (Vercel, Netlify, GitHub Pages, etc).
