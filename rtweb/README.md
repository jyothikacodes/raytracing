# Ray Tracer Performance Lab — CSS 311 Parallel Ray Tracing
**Student:** Jyothika A P · **Roll No:** 2024BCS0037

Comprehensive parallel ray tracing evaluation covering **Serial**, **OpenMP (Static, Dynamic, Guided Scheduling)**, and **MPI (Module 3 Static Block Decomposition and Dynamic Master-Worker)**, complete with automated benchmark suites and an interactive web lab deployed on Vercel (`raytracing-beta.vercel.app`).

---

## Folder structure

```
raytracing/
├── cpp/
│   ├── Makefile                  # Compiles serial, OpenMP, and MPI binaries
│   ├── serial_raytracer.cpp      # Baseline sequential ray tracer
│   ├── openmp_raytracer.cpp      # OpenMP with runtime static/dynamic/guided scheduling
│   ├── mpi_ray.cpp               # MPI implementation (Module 3: static & dynamic master-worker)
│   ├── results.json              # Local benchmark data (sizes 100-2000, 2/4/8 workers)
│   └── results.csv               # Raw and processed benchmark metrics
├── backend/
│   ├── server.js                 # Express API that spawns C++ binaries as child processes
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx               # Tabbed lab: Interactive Lab & Module 3 Comparison
│       ├── App.css               # Instrument-panel theme styling
│       ├── results.json          # Precomputed benchmark matrix for offline/Vercel view
│       └── components/
│           ├── ControlsPanel.jsx       # Size, spheres, mode, threads, schedule, chunk controls
│           ├── RenderView.jsx          # Viewport + timing, speedup, and efficiency readout
│           ├── ScheduleComparison.jsx  # Side-by-side static vs dynamic vs guided comparison
│           ├── ComparisonView.jsx      # Module 3 comparison matrix, line & speedup charts
│           ├── ThreadVisualizer.jsx    # SVG beam-splitting concurrency visualizer
│           └── PerformanceTable.jsx    # Live render history and charts
├── bench_all.py                  # Automated benchmark suite (sizes 100-2000, 2/4/8 workers, best of 3)
├── bench_all.sh                  # Shell wrapper for benchmark execution
├── Makefile                      # Top-level Makefile
└── README.md
```

---

## Compilation

You need: `g++` (with OpenMP support), `mpicxx` (OpenMPI / MPICH), and Node.js 18+.

### Compile all binaries:
```bash
# Using the Makefile from root or cpp/:
make

# Or manually:
cd rtweb/cpp
g++ -O2 -std=c++17 serial_raytracer.cpp -o serial_raytracer
g++ -O2 -std=c++17 -fopenmp openmp_raytracer.cpp -o openmp_raytracer
mpicxx -O2 mpi_ray.cpp -o mpi_ray
```

---

## Command-Line Usage

### 1. Baseline Serial
```bash
./serial_raytracer <width> <height> <outputPath.ppm> [numSpheres=3]
# Example:
./serial_raytracer 1000 1000 output_serial.ppm 3
```

### 2. OpenMP with Dynamic Scheduling (Task 1)
Supports `static`, `dynamic`, and `guided` scheduling with customizable chunk size (`1`, `4`, `16`, `64`):
```bash
./openmp_raytracer <width> <height> <outputPath.ppm> <numThreads> [numSpheres=3] [schedule=static] [chunkSize=1]

# Examples:
# Static schedule (default chunk)
./openmp_raytracer 1000 1000 output_omp.ppm 4 3 static 1

# Dynamic scheduling (work-stealing queue, chunk 16)
./openmp_raytracer 1000 1000 output_omp.ppm 8 3 dynamic 16

# Guided scheduling (exponentially decreasing chunk size)
./openmp_raytracer 1000 1000 output_omp.ppm 8 3 guided 16
```
Outputs execution metrics in machine-parseable JSON:
```json
{"width":1000,"height":1000,"threads":8,"schedule":"dynamic","chunk":16,"time":0.009180}
```

### 3. MPI Ray Tracer (Module 3, Task 2)
Supports two parallelization modes:
- **`static`**: Contiguous row blocks per rank (remainder rows distributed among the first ranks), collected via `MPI_Gatherv`.
- **`dynamic`**: Master-worker architecture. Rank 0 dispatches one row index at a time (`tag = 1`), sends stop signal (`tag = 0`). Workers compute and return the row with `tag = rowIdx`. Requires `np >= 2`.

```bash
# Usage:
mpirun -np <procs> ./mpi_ray <width> <height> <static|dynamic> [numSpheres=3] [outputPPM]

# Note: On laptops with fewer physical/logical cores, use --oversubscribe:
mpirun --oversubscribe -np 4 ./mpi_ray 1000 1000 static 3 output_mpi_static.ppm
mpirun --oversubscribe -np 4 ./mpi_ray 1000 1000 dynamic 3 output_mpi_dynamic.ppm
mpirun --oversubscribe -np 8 ./mpi_ray 2000 2000 dynamic 3 output_mpi_dynamic.ppm
```

Rank 0 outputs:
```
Name: Jyothika A P Roll No: 2024BCS0037
Mode=dynamic Size=1000x1000 Procs=8 Time=0.008900 s
```

Output PPM images generated across Serial, OpenMP, MPI Static, and MPI Dynamic are verified to be 100% bitwise identical.

---

## Automated Benchmark Suite (Task 3)

The benchmark suite tests all image sizes (`100`, `250`, `500`, `1000`, `2000`) and worker configurations (`2`, `4`, `8` workers) across all 5 engines:
- Serial (baseline, 1 worker)
- OpenMP Static
- OpenMP Dynamic (chunk 16)
- MPI Static
- MPI Dynamic

Each combination is run **3 times**, recording the best time, speedup factor, and parallel efficiency.

```bash
# Run benchmark suite:
./bench_all.py
# Or:
./bench_all.sh
```

This generates:
- `results.json`: Full matrix with metadata, timing arrays, and winner rankings.
- `results.csv`: CSV table for easy spreadsheet import and viva submission.

---

## Web Application

The web interface provides an instrument-panel UI with two main views:

1. **Interactive Lab (`/`)**:
   - Live rendering for Serial and OpenMP.
   - Scene selection (2 or 3 spheres), image sizes (100px – 2000px), thread counts (2, 4, 8).
   - **Schedule Dropdown & Chunk Input**: Select between `static`, `dynamic`, `guided` and chunks `1`, `4`, `16`, `64`.
   - **"Compare Schedules" Button**: Automatically evaluates `static`, `dynamic`, and `guided` side-by-side for the current scene, showing time, speedup, and efficiency, and highlighting the winning schedule.
   - Animated SVG beam-split concurrency visualizer and session render history log.

2. **Module 3 Comparison View**:
   - Dedicated performance dashboard reading `results.json`.
   - Interactive performance matrix with worker filters (All, 2W, 4W, 8W).
   - Responsive Recharts visualizations:
     * **Execution Time vs. Image Size** across all engines.
     * **Speedup Factor vs. Image Size**.
   - Fastest engine badge per image size.
   - Clear indicators that MPI benchmarks are measured locally because MPI multi-process daemons cannot run within Vercel serverless functions.

---

## Running Locally

```bash
# 1. Build C++ ray tracers
make

# 2. Run benchmark suite (optional)
./bench_all.sh

# 3. Start backend API
cd rtweb/backend
npm install
node server.js
# Backend listening on http://localhost:4000

# 4. Start frontend
cd ../frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

## Deployment Notes

- **Frontend (Vercel)**: Deployed from `rtweb/frontend`. Configured with `VITE_API_URL` pointing to the Render backend service (`https://raytracing-ooaf.onrender.com`).
- **Backend (Render)**: Deployed from `rtweb/backend`. Runs Node.js Express server with precompiled C++ binaries.
- **Serverless Notice**: Vercel serverless functions cannot execute MPI (`mpirun`) or spawn persistent daemon worker groups. Hence, MPI evaluation is presented through verified locally measured benchmark results loaded directly from `results.json`.
