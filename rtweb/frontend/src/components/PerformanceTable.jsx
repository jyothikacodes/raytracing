import React from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const AMBER = "#ffb020";
const GRID = "#2b2c22";
const DIM = "#86846e";

export default function PerformanceTable({ history }) {
  if (!history.length) {
    return (
      <div className="panel log-panel">
        <h2 className="panel-title">Render log</h2>
        <p className="log-empty">Nothing recorded yet — every render this session lands here, oldest first.</p>
      </div>
    );
  }

  const chartData = history.map((h, idx) => ({
    name: `${h.mode === "openmp" ? `omp-${h.threads}t` : "serial"} #${idx + 1}`,
    timeMs: +(h.time * 1000).toFixed(2),
    threads: h.threads,
  }));

  return (
    <div className="panel log-panel">
      <h2 className="panel-title">Render log</h2>

      <table className="log-table">
        <thead>
          <tr>
            <th>Mode</th><th>Threads</th><th>Image size</th><th>Time</th><th>Speedup</th><th>Efficiency</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id}>
              <td>{h.mode === "openmp" ? "openmp" : "serial"}</td>
              <td>{h.threads}</td>
              <td>{h.width} × {h.height}</td>
              <td>{(h.time * 1000).toFixed(2)} ms</td>
              <td className={h.speedup ? "" : "dim"}>{h.speedup ? `${h.speedup.toFixed(2)}×` : "—"}</td>
              <td className={h.efficiency ? "" : "dim"}>{h.efficiency ? `${(h.efficiency * 100).toFixed(1)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="charts-row">
        <div className="chart-box">
          <h3>time vs. threads</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="2 4" stroke={GRID} />
              <XAxis dataKey="threads" stroke={DIM} fontSize={11} tickLine={false} />
              <YAxis stroke={DIM} fontSize={11} tickLine={false} label={{ value: "ms", angle: -90, position: "insideLeft", fill: DIM, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#12150f", border: "1px solid #2b2c22", fontSize: 12 }} />
              <Line type="monotone" dataKey="timeMs" stroke={AMBER} strokeWidth={2} dot={{ r: 3, fill: AMBER }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box">
          <h3>serial vs. parallel time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="2 4" stroke={GRID} />
              <XAxis dataKey="name" stroke={DIM} tick={{ fontSize: 9.5 }} tickLine={false} />
              <YAxis stroke={DIM} fontSize={11} tickLine={false} label={{ value: "ms", angle: -90, position: "insideLeft", fill: DIM, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#12150f", border: "1px solid #2b2c22", fontSize: 12 }} />
              <Bar dataKey="timeMs" fill={AMBER} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
