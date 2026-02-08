import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { query } from "./db.js";
import { authMiddleware, signToken } from "./auth.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

const buildDashboard = async (userId) => {
  const [{ rows: tasks }, { rows: streaks }, { rows: points }] = await Promise.all([
    query(
      `SELECT id, title, frequency, xp_value, active
       FROM tasks
       WHERE user_id = $1 AND active = true
       ORDER BY created_at DESC`,
      [userId]
    ),
    query(
      `SELECT current_streak, longest_streak, last_completed_date
       FROM streaks
       WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT COALESCE(SUM(xp_earned), 0) AS total_xp
       FROM task_logs
       WHERE user_id = $1`,
      [userId]
    )
  ]);

  const streak = streaks[0] || {
    current_streak: 0,
    longest_streak: 0,
    last_completed_date: null
  };

  return {
    tasks,
    points: Number(points[0]?.total_xp || 0),
    streak
  };
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/signup", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const existing = await query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  await query(
    `INSERT INTO users (id, email, password_hash, display_name)
     VALUES ($1, $2, $3, $4)`,
    [userId, email, passwordHash, displayName || email.split("@")[0]]
  );
  await query(
    `INSERT INTO streaks (id, user_id, current_streak, longest_streak)
     VALUES ($1, $2, 0, 0)`,
    [uuidv4(), userId]
  );

  const token = signToken({ id: userId, email });
  return res.status(201).json({ token });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await query(
    `SELECT id, password_hash FROM users WHERE email = $1`,
    [email]
  );
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signToken({ id: user.id, email });
  return res.json({ token });
});

app.get("/auth/me", authMiddleware, async (req, res) => {
  const { rows } = await query(
    `SELECT id, email, display_name FROM users WHERE id = $1`,
    [req.user.id]
  );
  return res.json({ user: rows[0] });
});

app.post("/pairing/invite", authMiddleware, async (req, res) => {
  const inviteCode = uuidv4().split("-")[0];
  const pairId = uuidv4();
  await query(
    `INSERT INTO user_pairs (id, user_a_id, invite_code, status)
     VALUES ($1, $2, $3, 'pending')`,
    [pairId, req.user.id, inviteCode]
  );
  return res.status(201).json({ inviteCode });
});

app.post("/pairing/join", authMiddleware, async (req, res) => {
  const { inviteCode } = req.body;
  const { rows } = await query(
    `SELECT id, user_a_id FROM user_pairs WHERE invite_code = $1 AND status = 'pending'`,
    [inviteCode]
  );
  const pair = rows[0];
  if (!pair) {
    return res.status(404).json({ error: "Invite not found" });
  }
  await query(
    `UPDATE user_pairs
     SET user_b_id = $1, status = 'active'
     WHERE id = $2`,
    [req.user.id, pair.id]
  );
  return res.json({ status: "active" });
});

app.get("/pairing/status", authMiddleware, async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM user_pairs
     WHERE (user_a_id = $1 OR user_b_id = $1)
     ORDER BY created_at DESC
     LIMIT 1`,
    [req.user.id]
  );
  return res.json({ pairing: rows[0] || null });
});

app.get("/tasks", authMiddleware, async (req, res) => {
  const { rows } = await query(
    `SELECT id, title, frequency, xp_value, active
     FROM tasks
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.user.id]
  );
  return res.json({ tasks: rows });
});

app.post("/tasks", authMiddleware, async (req, res) => {
  const { title, frequency, xpValue } = req.body;
  if (!title || !frequency) {
    return res.status(400).json({ error: "Title and frequency are required" });
  }
  const taskId = uuidv4();
  await query(
    `INSERT INTO tasks (id, user_id, title, frequency, xp_value, active)
     VALUES ($1, $2, $3, $4, $5, true)`,
    [taskId, req.user.id, title, frequency, xpValue || 10]
  );
  return res.status(201).json({ id: taskId });
});

app.put("/tasks/:id", authMiddleware, async (req, res) => {
  const { title, frequency, xpValue, active } = req.body;
  await query(
    `UPDATE tasks
     SET title = COALESCE($1, title),
         frequency = COALESCE($2, frequency),
         xp_value = COALESCE($3, xp_value),
         active = COALESCE($4, active)
     WHERE id = $5 AND user_id = $6`,
    [title, frequency, xpValue, active, req.params.id, req.user.id]
  );
  return res.json({ status: "updated" });
});

app.delete("/tasks/:id", authMiddleware, async (req, res) => {
  await query(
    `DELETE FROM tasks WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  return res.json({ status: "deleted" });
});

const logTask = async (userId, taskId, status) => {
  const { rows } = await query(
    `SELECT xp_value FROM tasks WHERE id = $1 AND user_id = $2`,
    [taskId, userId]
  );
  if (!rows[0]) {
    return null;
  }
  const xpEarned = status === "completed" ? rows[0].xp_value : 0;
  const logId = uuidv4();
  await query(
    `INSERT INTO task_logs (id, task_id, user_id, date, status, xp_earned)
     VALUES ($1, $2, $3, CURRENT_DATE, $4, $5)`,
    [logId, taskId, userId, status, xpEarned]
  );
  if (status === "completed") {
    await query(
      `UPDATE streaks
       SET current_streak = current_streak + 1,
           longest_streak = GREATEST(longest_streak, current_streak + 1),
           last_completed_date = CURRENT_DATE
       WHERE user_id = $1`,
      [userId]
    );
  }
  return { logId, xpEarned };
};

app.post("/tasks/:id/complete", authMiddleware, async (req, res) => {
  const result = await logTask(req.user.id, req.params.id, "completed");
  if (!result) {
    return res.status(404).json({ error: "Task not found" });
  }
  return res.json(result);
});

app.post("/tasks/:id/miss", authMiddleware, async (req, res) => {
  const result = await logTask(req.user.id, req.params.id, "missed");
  if (!result) {
    return res.status(404).json({ error: "Task not found" });
  }
  return res.json(result);
});

app.get("/logs", authMiddleware, async (req, res) => {
  const { from, to } = req.query;
  const { rows } = await query(
    `SELECT task_id, date, status, xp_earned
     FROM task_logs
     WHERE user_id = $1
       AND date BETWEEN COALESCE($2::date, date) AND COALESCE($3::date, date)
     ORDER BY date DESC`,
    [req.user.id, from || null, to || null]
  );
  return res.json({ logs: rows });
});

app.get("/dashboard", authMiddleware, async (req, res) => {
  const dashboard = await buildDashboard(req.user.id);
  return res.json({ dashboard });
});

app.get("/analytics/weekly", authMiddleware, async (req, res) => {
  const { rows } = await query(
    `SELECT date, COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE status = 'missed') AS missed
     FROM task_logs
     WHERE user_id = $1
       AND date >= CURRENT_DATE - INTERVAL '7 days'
     GROUP BY date
     ORDER BY date`,
    [req.user.id]
  );
  return res.json({ data: rows });
});

app.get("/analytics/monthly", authMiddleware, async (req, res) => {
  const { rows } = await query(
    `SELECT date_trunc('week', date)::date AS week,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE status = 'missed') AS missed
     FROM task_logs
     WHERE user_id = $1
       AND date >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY week
     ORDER BY week`,
    [req.user.id]
  );
  return res.json({ data: rows });
});

app.get("/xp", authMiddleware, async (req, res) => {
  const { rows } = await query(
    `SELECT COALESCE(SUM(xp_earned), 0) AS total_xp
     FROM task_logs WHERE user_id = $1`,
    [req.user.id]
  );
  return res.json({ totalXp: Number(rows[0].total_xp || 0) });
});

app.get("/leaderboard", authMiddleware, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.display_name,
            COALESCE(SUM(l.xp_earned), 0) AS total_xp
     FROM users u
     LEFT JOIN task_logs l ON u.id = l.user_id
     WHERE u.id IN (
       SELECT user_a_id FROM user_pairs WHERE user_a_id = $1 OR user_b_id = $1
       UNION
       SELECT user_b_id FROM user_pairs WHERE user_a_id = $1 OR user_b_id = $1
     )
     GROUP BY u.id
     ORDER BY total_xp DESC`,
    [req.user.id]
  );
  return res.json({ leaderboard: rows });
});

app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);
});
