# Progress Arena

Progress Arena is a lightweight productivity and gamified progress tracker designed for personal use or friendly competition between two people. It includes a Node/Express backend with PostgreSQL and a React dashboard front-end.

## Features
- Email/password authentication with JWT.
- Single or dual mode via invite codes.
- Task creation, completion logging, and streak tracking.
- XP totals, weekly analytics, and leaderboard endpoints.
- Minimal responsive dashboard UI.

## Quickstart (Local Dev)
1. Copy env config:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Start services:
   ```bash
   docker-compose up --build
   ```
3. Apply schema:
   ```bash
   psql postgres://progress:progress@localhost:5432/progress -f backend/db/schema.sql
   ```
4. Open the app:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:4000/health

## Deployment Notes
- Use managed PostgreSQL (e.g., RDS, Supabase) and set `DATABASE_URL`.
- Set `JWT_SECRET` to a strong random value.
- Configure `CORS_ORIGIN` for your deployed frontend domain.
