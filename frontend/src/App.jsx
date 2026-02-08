import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";

const weeklyData = [
  { day: "Mon", completed: 3 },
  { day: "Tue", completed: 4 },
  { day: "Wed", completed: 2 },
  { day: "Thu", completed: 5 },
  { day: "Fri", completed: 4 },
  { day: "Sat", completed: 6 },
  { day: "Sun", completed: 3 }
];

const tasks = [
  { id: 1, title: "Study Java for 60 min", xp: 20 },
  { id: 2, title: "Solve 2 coding problems", xp: 30 },
  { id: 3, title: "Workout session", xp: 25 }
];

const achievements = [
  { label: "5-day streak", status: "Unlocked" },
  { label: "First week complete", status: "Unlocked" },
  { label: "100 XP club", status: "In progress" }
];

export default function App() {
  const totalXp = useMemo(
    () => tasks.reduce((acc, item) => acc + item.xp, 0),
    []
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Progress Arena</h1>
        <nav>
          <button type="button">Dashboard</button>
          <button type="button">Tasks</button>
          <button type="button">Analytics</button>
          <button type="button">History</button>
          <button type="button">Settings</button>
        </nav>
        <div className="mode-card">
          <p>Mode</p>
          <strong>Dual (Invite Active)</strong>
          <span>Invite Code: 7A9K1</span>
        </div>
      </aside>

      <main>
        <header className="hero">
          <div>
            <p className="eyebrow">Today</p>
            <h2>Stay consistent, keep the streak alive</h2>
            <p className="subcopy">
              You have 3 tasks scheduled. Finish them to earn more XP and
              advance your level.
            </p>
          </div>
          <div className="stats">
            <div>
              <p>XP Today</p>
              <strong>{totalXp}</strong>
            </div>
            <div>
              <p>Current streak</p>
              <strong>6 days</strong>
            </div>
            <div>
              <p>Level</p>
              <strong>Level 4</strong>
            </div>
          </div>
        </header>

        <section className="grid">
          <div className="card">
            <h3>Today&apos;s Tasks</h3>
            <ul className="task-list">
              {tasks.map((task) => (
                <li key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{task.xp} XP</span>
                  </div>
                  <button type="button">Mark complete</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3>Weekly Progress</h3>
            <div className="chart">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weeklyData}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#5c6cff"
                    fill="#c7ccff"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid">
          <div className="card">
            <h3>Leaderboard</h3>
            <div className="leaderboard">
              <div>
                <span>1</span>
                <p>Alex</p>
                <strong>320 XP</strong>
              </div>
              <div>
                <span>2</span>
                <p>You</p>
                <strong>280 XP</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Achievements</h3>
            <ul className="badge-list">
              {achievements.map((badge) => (
                <li key={badge.label}>
                  <strong>{badge.label}</strong>
                  <span>{badge.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
