import React, { useState } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import benchmarkData from "../results.json";

const AMBER = "#ffb020";
const BLUE = "#38bdf8";
const GREEN = "#4ade80";
const PURPLE = "#c084fc";
const GRAY = "#94a3b8";
const GRID = "#2b2c22";
const DIM = "#86846e";

export default function ComparisonView() {
  const [selectedWorkers, setSelectedWorkers] = useState("all");
  const { metadata, by_size, table } = benchmarkData;

  // Filter table by worker count
  const filteredTable = selectedWorkers === "all"
    ? table
    : table.filter((row) => row.workers === Number(selectedWorkers));

  // Chart data: Time vs Image Size for a chosen worker count (default 8 or selected)
  const chartWorkerCount = selectedWorkers === "all" ? 8 : Number(selectedWorkers);
  const timeVsSizeData = metadata.sizes.map((sz) => {
    const sizeEntry = by_size[String(sz)];
    const workerEntry = sizeEntry?.workers[String(chartWorkerCount)];
    return {
      size: `${sz}px`,
      sizeNum: sz,
      Serial: +(sizeEntry?.serial.time * 1000).toFixed(2),
      "OMP Static": workerEntry ? +(workerEntry.omp_static.time * 1000).toFixed(2) : null,
      "OMP Dynamic": workerEntry ? +(workerEntry.omp_dynamic.time * 1000).toFixed(2) : null,
      MPI: workerEntry ? +( (workerEntry.mpi?.time ?? workerEntry.mpi_static?.time) * 1000).toFixed(2) : null,
    };
  });

  // Chart data: Speedup comparison for chartWorkerCount
  const speedupData = metadata.sizes.map((sz) => {
    const sizeEntry = by_size[String(sz)];
    const workerEntry = sizeEntry?.workers[String(chartWorkerCount)];
    return {
      size: `${sz}px`,
      "OMP Static": workerEntry ? +workerEntry.omp_static.speedup.toFixed(2) : 0,
      "OMP Dynamic": workerEntry ? +workerEntry.omp_dynamic.speedup.toFixed(2) : 0,
      MPI: workerEntry ? +(workerEntry.mpi?.speedup ?? workerEntry.mpi_static?.speedup).toFixed(2) : 0,
    };
  });

  return (
    <div className="comparison-page">
      <div className="comparison-banner">
        <div className="banner-left">
          <span className="module-tag">Module 3 Evaluation</span>
          <h2 className="banner-title">Parallel Architecture Benchmarks</h2>
          <p className="banner-sub">
            Comprehensive comparison of <strong>Serial</strong>, <strong>OpenMP Static</strong>,{" "}
            <strong>OpenMP Dynamic</strong>, and <strong>MPI</strong>.
          </p>
        </div>
        <div className="banner-right">
          <div className="author-card">
            <span className="author-label">Author</span>
            <span className="author-name">{metadata.name}</span>
            <span className="author-roll">Roll No: {metadata.rollNo}</span>
            <span className="author-hw">{metadata.cpu}</span>
          </div>
        </div>
      </div>

      <div className="notice-strip">
        <span className="notice-icon">ℹ</span>
        <span>
          <strong>Deployment Notice:</strong> OpenMP dynamic scheduling runs live via the backend API.
          MPI requires multi-process message passing and cannot run in Vercel serverless environments,
          so this view loads verified benchmark data measured locally (best of 3 runs).
        </span>
      </div>

      {/* Fastest Variant Cards Per Size */}
      <div className="winner-cards-section">
        <h3 className="section-subtitle">Fastest Engine By Image Size</h3>
        <div className="winner-cards-grid">
          {metadata.sizes.map((sz) => {
            const dataForSize = by_size[String(sz)];
            return (
              <div key={sz} className="winner-card">
                <span className="winner-size">{sz} × {sz}</span>
                <div className="winner-engine">
                  <span className="winner-trophy">★</span>
                  <span>{dataForSize.fastest_overall}</span>
                </div>
                <div className="winner-meta">
                  <span>{(dataForSize.fastest_time * 1000).toFixed(2)} ms</span>
                  <span className="winner-sp">{dataForSize.max_speedup.toFixed(2)}× speedup</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Master Table */}
      <div className="panel comp-table-panel">
        <div className="table-controls">
          <h3 className="panel-title" style={{ margin: 0, border: "none" }}>Performance Matrix</h3>
          <div className="worker-filter-group">
            <span className="filter-label">Filter workers:</span>
            {["all", "2", "4", "8"].map((w) => (
              <button
                key={w}
                type="button"
                className={`worker-tab ${selectedWorkers === w ? "worker-tab-active" : ""}`}
                onClick={() => setSelectedWorkers(w)}
              >
                {w === "all" ? "All Workers" : `${w} Workers`}
              </button>
            ))}
          </div>
        </div>

        <div className="table-responsive">
          <table className="log-table comp-table">
            <thead>
              <tr>
                <th>Size</th>
                <th>Workers</th>
                <th>Serial</th>
                <th>OMP Static</th>
                <th>OMP Dynamic</th>
                <th>MPI</th>
                <th>Fastest Variant</th>
                <th>Max Speedup</th>
              </tr>
            </thead>
            <tbody>
              {filteredTable.map((row, idx) => (
                <tr key={`${row.size}-${row.workers}-${idx}`}>
                  <td className="mono-cell">{row.size} × {row.size}</td>
                  <td><span className="worker-badge">{row.workers}W</span></td>
                  <td>{(row.serial * 1000).toFixed(2)} ms</td>
                  <td>
                    {(row.omp_static * 1000).toFixed(2)} ms
                    <span className="table-sp">({row.omp_static_sp.toFixed(2)}×)</span>
                  </td>
                  <td>
                    {(row.omp_dynamic * 1000).toFixed(2)} ms
                    <span className="table-sp">({row.omp_dynamic_sp.toFixed(2)}×)</span>
                  </td>
                  <td>
                    {((row.mpi ?? row.mpi_static) * 1000).toFixed(2)} ms
                    <span className="table-sp">({(row.mpi_sp ?? row.mpi_static_sp).toFixed(2)}×)</span>
                  </td>
                  <td>
                    <span className="winner-cell-badge">★ {row.fastest}</span>
                  </td>
                  <td className="accent-cell">{row.max_speedup.toFixed(2)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="charts-row" style={{ marginTop: 22 }}>
        <div className="chart-box">
          <div className="chart-header">
            <h3>Execution Time vs. Image Size ({chartWorkerCount} Workers)</h3>
            <span className="chart-caption">Lower is better (ms)</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={timeVsSizeData}>
              <CartesianGrid strokeDasharray="2 4" stroke={GRID} />
              <XAxis dataKey="size" stroke={DIM} fontSize={11} tickLine={false} />
              <YAxis stroke={DIM} fontSize={11} tickLine={false} label={{ value: "Time (ms)", angle: -90, position: "insideLeft", fill: DIM, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#12150f", border: "1px solid #2b2c22", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
              <Line type="monotone" dataKey="Serial" stroke={GRAY} strokeWidth={1.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="OMP Static" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="OMP Dynamic" stroke={AMBER} strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="MPI" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box">
          <div className="chart-header">
            <h3>Speedup Factor by Image Size ({chartWorkerCount} Workers)</h3>
            <span className="chart-caption">Higher is better (× baseline)</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={speedupData}>
              <CartesianGrid strokeDasharray="2 4" stroke={GRID} />
              <XAxis dataKey="size" stroke={DIM} fontSize={11} tickLine={false} />
              <YAxis stroke={DIM} fontSize={11} tickLine={false} label={{ value: "Speedup (×)", angle: -90, position: "insideLeft", fill: DIM, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#12150f", border: "1px solid #2b2c22", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
              <Bar dataKey="OMP Static" fill={BLUE} />
              <Bar dataKey="OMP Dynamic" fill={AMBER} />
              <Bar dataKey="MPI" fill={GREEN} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
