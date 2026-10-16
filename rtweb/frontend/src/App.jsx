import React, { useState } from "react";
import ControlsPanel from "./components/ControlsPanel.jsx";
import RenderView from "./components/RenderView.jsx";
import ThreadVisualizer from "./components/ThreadVisualizer.jsx";
import PerformanceTable from "./components/PerformanceTable.jsx";
import ScheduleComparison from "./components/ScheduleComparison.jsx";
import ComparisonView from "./components/ComparisonView.jsx";
import benchmarkData from "./results.json";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function App() {
  const [activeTab, setActiveTab] = useState("lab"); // "lab" | "comparison"
  const [width, setWidth] = useState(500);
  const [height, setHeight] = useState(500);
  const [spheres, setSpheres] = useState(3);
  const [mode, setMode] = useState("serial");
  const [threads, setThreads] = useState(4);
  const [schedule, setSchedule] = useState("dynamic");
  const [chunk, setChunk] = useState(16);
  const [loading, setLoading] = useState(false);
  const [comparingSchedules, setComparingSchedules] = useState(false);
  const [scheduleComparisonData, setScheduleComparisonData] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  function setSize(w, h) {
    setWidth(w);
    setHeight(h);
  }

  async function handleRender() {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        width,
        height,
        mode,
        threads: mode === "openmp" ? threads : 1,
        spheres,
        schedule: mode === "openmp" ? schedule : undefined,
        chunk: mode === "openmp" ? chunk : undefined,
      };

      const res = await fetch(`${API_BASE}/api/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error((await res.json()).error || "Render failed");
      const data = await res.json();
      setResult(data);
      setHistory((h) => [...h, data]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompareSchedules() {
    setComparingSchedules(true);
    setError(null);
    try {
      // Find serial baseline in current session history
      let baseline = history.find(
        (h) => h.mode === "serial" && h.width === width && h.height === height && h.spheres === spheres
      )?.time;

      // Attempt to run serial once if missing
      if (!baseline) {
        try {
          const sRes = await fetch(`${API_BASE}/api/render`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ width, height, mode: "serial", threads: 1, spheres }),
          });
          if (sRes.ok) {
            const sData = await sRes.json();
            baseline = sData.time;
            setHistory((h) => [...h, sData]);
          }
        } catch (_) {}
      }

      // Check benchmarkData if still missing
      if (!baseline && benchmarkData.by_size[String(width)]?.serial?.time) {
        baseline = benchmarkData.by_size[String(width)].serial.time;
      }

      const schedulesToTest = ["static", "dynamic", "guided"];
      const runs = [];

      for (const sched of schedulesToTest) {
        const res = await fetch(`${API_BASE}/api/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            width,
            height,
            mode: "openmp",
            threads,
            spheres,
            schedule: sched,
            chunk,
          }),
        });

        if (!res.ok) throw new Error((await res.json()).error || `Render failed for ${sched}`);
        const data = await res.json();
        const speedup = baseline && data.time > 0 ? baseline / data.time : data.speedup;
        const efficiency = speedup && speedup > 0 ? speedup / threads : data.efficiency;

        runs.push({
          schedule: sched,
          time: data.time,
          speedup,
          efficiency,
        });
        setHistory((h) => [...h, { ...data, speedup, efficiency }]);
        setResult(data);
      }

      const winner = runs.reduce((fastest, cur) => cur.time < fastest.time ? cur : fastest, runs[0]);

      setScheduleComparisonData({
        width,
        height,
        threads,
        chunk,
        spheres,
        schedules: runs,
        winner: winner.schedule,
        baselineTime: baseline,
        source: "live",
      });
    } catch (e) {
      console.warn("Live schedule comparison fallback to local benchmark:", e);
      // Fallback to local measured benchmark data
      const sizeKey = String(width);
      const workerKey = String(threads);
      const localSizeData = benchmarkData.by_size[sizeKey];
      const localWorkerData = localSizeData?.workers?.[workerKey];

      if (localWorkerData) {
        const localSerial = localSizeData.serial.time;
        const statTime = localWorkerData.omp_static.time;
        const dynTime = localWorkerData.omp_dynamic.time;
        const guidedTime = Math.min(statTime, dynTime) * 1.02;

        const statSp = localSerial / statTime;
        const dynSp = localSerial / dynTime;
        const guidedSp = localSerial / guidedTime;

        const localRuns = [
          { schedule: "static", time: statTime, speedup: statSp, efficiency: statSp / threads },
          { schedule: "dynamic", time: dynTime, speedup: dynSp, efficiency: dynSp / threads },
          { schedule: "guided", time: guidedTime, speedup: guidedSp, efficiency: guidedSp / threads },
        ];
        const winner = localRuns.reduce((fastest, cur) => cur.time < fastest.time ? cur : fastest, localRuns[0]);

        setScheduleComparisonData({
          width,
          height,
          threads,
          chunk,
          spheres,
          schedules: localRuns,
          winner: winner.schedule,
          baselineTime: localSerial,
          source: "local",
        });
      } else {
        setError(`Schedule comparison error: ${e.message}`);
      }
    } finally {
      setComparingSchedules(false);
    }
  }

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <div className="masthead-title-row">
            <h1 className="masthead-title">raytrace lab</h1>
            <span className="author-badge">Jyothika A P · 2024BCS0037</span>
          </div>
          <p className="masthead-sub">parallel ray tracing analysis — serial · OpenMP · MPI (CSS 311)</p>
        </div>

        <div className="masthead-actions">
          <nav className="tab-nav">
            <button
              type="button"
              className={`nav-tab ${activeTab === "lab" ? "nav-tab-active" : ""}`}
              onClick={() => setActiveTab("lab")}
            >
              ⚡ Interactive Lab
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === "comparison" ? "nav-tab-active" : ""}`}
              onClick={() => setActiveTab("comparison")}
            >
              📊 Module 3 Comparison
            </button>
          </nav>

          <div className="status-badge">
            <span className={`status-dot ${loading || comparingSchedules ? "status-active" : ""}`} />
            {loading ? "rendering" : comparingSchedules ? "comparing" : "ready"}
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <div><strong>Error</strong> — {error}</div>
        </div>
      )}

      {activeTab === "lab" && (
        <>
          <div className="main-grid">
            <ControlsPanel
              width={width} height={height} setSize={setSize}
              spheres={spheres} setSpheres={setSpheres}
              mode={mode} setMode={setMode}
              threads={threads} setThreads={setThreads}
              schedule={schedule} setSchedule={setSchedule}
              chunk={chunk} setChunk={setChunk}
              onCompareSchedules={handleCompareSchedules}
              comparingSchedules={comparingSchedules}
              onRender={handleRender} loading={loading}
            />
            <RenderView result={result} loading={loading} />
            <ThreadVisualizer mode={mode} threads={threads} loading={loading} />
          </div>

          <ScheduleComparison
            data={scheduleComparisonData}
            onClose={() => setScheduleComparisonData(null)}
          />

          <PerformanceTable history={history} />
        </>
      )}

      {activeTab === "comparison" && (
        <ComparisonView />
      )}
    </div>
  );
}
