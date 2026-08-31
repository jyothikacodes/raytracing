# Ray Tracer Performance Lab — CSS 311 Assignment I

Performance Analysis of Serial and OpenMP Parallel Ray Tracing, with a small
web dashboard to demonstrate it.

## Folder structure

```
raytracer-project/
├── cpp/
│   ├── serial_raytracer.cpp      # ~110 lines, no OpenMP
│   └── openmp_raytracer.cpp      # same logic + #pragma omp parallel for
├── backend/
│   ├── server.js                 # Express API that runs the C++ binaries
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── App.css
│       └── components/
│           ├── ControlsPanel.jsx       # size / spheres / mode / threads + Render button
│           ├── RenderView.jsx          # shows the image + time/speedup/efficiency
│           ├── ThreadVisualizer.jsx    # animated "1 worker" vs "N workers" bars
│           └── PerformanceTable.jsx    # history table + charts
└── README.md
```

## Architecture — how the pieces talk to each other

```
React Frontend (Vite, localhost:5173)
        |  fetch POST /api/render { width, height, mode, threads, spheres }
        v
Express Backend API (Node, localhost:4000)
        |  spawns a child process:
        |    ./serial_raytracer W H out.ppm S            (mode = serial)
        |    ./openmp_raytracer W H out.ppm T S           (mode = openmp)
        v
C++ Ray Tracer binary
        |  does the actual rendering + timing, writes out.ppm,
        |  prints one JSON line to stdout:
        |    {"width":500,"height":500,"threads":4,"time":0.004552}
        v
Backend reads out.ppm, converts it to a PNG in memory (pure JS, via the
`pngjs` library — no ImageMagick needed), computes speedup/efficiency
against the last Serial run at that same size, and responds:
        {
          image: "data:image/png;base64,...",
          time, threads, speedup, efficiency, width, height, mode
        }
        |
        v
React Frontend renders the image, updates the stat cards, appends a row
to the performance history table/charts.
```

**Direct React → C++ is not practical** (browsers can't spawn native
processes), so the small Express API is the bridge. It does no rendering
math itself — it only runs the binary and shuttles the result.

## Running it

You need: `g++` with OpenMP support, Node.js 18+.

```bash
# 1. Compile the ray tracers
cd cpp
g++ -O2 -std=c++17 serial_raytracer.cpp -o serial_raytracer
g++ -O2 -std=c++17 -fopenmp openmp_raytracer.cpp -o openmp_raytracer

# 2. Start the backend (in one terminal)
cd ../backend
npm install
node server.js
# -> Ray tracer backend listening on http://localhost:4000

# 3. Start the frontend (in another terminal)
cd ../frontend
npm install
npm run dev
# -> open the printed http://localhost:5173 URL in your browser
```

Then in the browser: pick an image size, pick Serial or OpenMP (+ thread
count), click **Render**. Run Serial first at a given size so the backend
has a baseline to compute Speedup/Efficiency against when you then run
OpenMP at the same size.

## Command-line usage (no web UI needed)

```bash
./serial_raytracer <width> <height> <outputPath.ppm> [numSpheres=3]
./openmp_raytracer <width> <height> <outputPath.ppm> <numThreads> [numSpheres=3]
```

Both print one JSON line with the measured time — this is what the
backend parses, and it's also exactly what you paste into the assignment
document's Q5/Q10 timing tables.

## What's genuinely parallel here (for the viva)

The parallelized region is the flattened pixel loop in
`openmp_raytracer.cpp`:

```cpp
#pragma omp parallel for schedule(static)
for (int pixel = 0; pixel < W * H; pixel++) {
    int x = pixel % W, y = pixel / W;
    image[pixel] = tracePixel(x, y, W, H, numSpheres);
}
```

- **Shared:** the scene data (spheres, light — read-only) and the `image[]`
  buffer (each thread writes a different index, so no two threads ever
  touch the same memory).
- **Private:** `pixel`, `x`, `y` — each declared inside the loop, so OpenMP
  gives every thread its own copy automatically.
- **No critical/atomic needed:** because writes are to disjoint indices,
  there is no race condition to guard against.
- **Implicit barrier:** at the end of the `parallel for`, guaranteeing the
  image is fully computed before it's written to disk (or, in the web
  version, before it's sent back to the frontend).

## Note on the timing numbers already collected

Serial and OpenMP were both run here on a machine with only 1 logical CPU
core, so the measured speedup is close to 1.0x (sometimes slightly under,
due to thread-scheduling overhead) rather than the near-linear speedup the
`O((W·H·S)/T)` model predicts. Re-run both binaries — or use the web
dashboard — on a real multi-core laptop to get a meaningful speedup curve
for the Q10 table.
