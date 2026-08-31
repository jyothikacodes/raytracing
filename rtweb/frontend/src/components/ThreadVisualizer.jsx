import React from "react";

// The literal thing OpenMP does to the pixel loop: one incoming ray
// forks at the splitter into N parallel beams, one per thread, which
// travel and land at the same time. Serial mode is just one beam,
// no splitter. This is the diagram doing the explaining, not text.
export default function ThreadVisualizer({ mode, threads, loading }) {
  const beamCount = mode === "openmp" ? threads : 1;
  const W = 400, H = 30 + beamCount * 26;
  const splitX = mode === "openmp" ? 70 : null;
  const startX = 14, endX = W - 46;
  const midY = H / 2;

  const ys = Array.from({ length: beamCount }, (_, i) =>
    beamCount === 1 ? midY : 20 + (i * (H - 40)) / (beamCount - 1)
  );

  return (
    <div className="panel beam-panel">
      <h2 className="panel-title">Beam split</h2>
      <svg className="beam-svg" viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={mode === "serial" ? "One sequential beam" : `One beam splitting into ${threads} parallel beams`}>
        {mode === "openmp" ? (
          <>
            <line x1={startX} y1={midY} x2={splitX} y2={midY}
                  className={`beam-line ${loading ? "beam-line-active" : "beam-line-idle"}`} />
            <circle cx={splitX} cy={midY} r={4} className="beam-node" />
            {ys.map((y, i) => (
              <g key={i}>
                <line x1={splitX} y1={y} x2={endX} y2={y}
                      className={`beam-line ${loading ? "beam-line-active" : "beam-line-idle"}`}
                      style={{ animationDelay: `${i * 0.05}s` }} />
                <circle cx={endX} cy={y} r={3.5} className="beam-node" />
                <text x={endX + 8} y={y + 3} className="beam-label">T{i}</text>
              </g>
            ))}
          </>
        ) : (
          <>
            <line x1={startX} y1={midY} x2={endX} y2={midY}
                  className={`beam-line ${loading ? "beam-line-active" : "beam-line-idle"}`} />
            <circle cx={endX} cy={midY} r={3.5} className="beam-node" />
            <text x={endX + 8} y={midY + 3} className="beam-label">T0</text>
          </>
        )}
      </svg>
      <p className="beam-caption">
        {mode === "serial"
          ? "One thread walks every pixel in sequence."
          : `The pixel range is split ${threads}-way at the fork — each beam renders its share concurrently.`}
      </p>
    </div>
  );
}
