#!/usr/bin/env python3
"""
CSS 311 Parallel Ray Tracing - Comprehensive Benchmark Suite

Runs benchmarks for:
  - Sizes: 100, 250, 500, 1000, 2000
  - Workers / Threads / Procs: 2, 4, 8 (serial: 1)
  - Variants: serial, OpenMP static, OpenMP dynamic, MPI static, MPI dynamic
  - Best of 3 runs each

Generates:
  - results.json
  - results.csv
"""

import os
import sys
import json
import csv
import re
import shutil
import subprocess
import platform
from datetime import datetime

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
CPP_DIR = os.path.join(ROOT_DIR, "rtweb", "cpp") if os.path.exists(os.path.join(ROOT_DIR, "rtweb", "cpp")) else ROOT_DIR

SERIAL_BIN = os.path.join(CPP_DIR, "serial_raytracer")
OPENMP_BIN = os.path.join(CPP_DIR, "openmp_raytracer")
MPI_BIN = os.path.join(CPP_DIR, "mpi_ray")

SIZES = [100, 250, 500, 1000, 2000]
WORKERS = [2, 4, 8]
NUM_RUNS = 3
NUM_SPHERES = 3

def get_cpu_model():
    try:
        with open("/proc/cpuinfo") as f:
            for line in f:
                if "model name" in line:
                    return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return platform.processor() or "12-core CPU"



def compile_binaries():
    print("=== Compiling C++ Ray Tracing Binaries ===")
    make_cmd = ["make", "-C", CPP_DIR, "all"]
    ret = subprocess.run(make_cmd, capture_output=True, text=True)
    if ret.returncode != 0:
        print("Build failed:\n" + ret.stderr)
        sys.exit(1)
    print("Build successful: serial_raytracer, openmp_raytracer, mpi_ray\n")

def parse_time(output):
    # Try parsing JSON first
    for line in reversed(output.strip().splitlines()):
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            try:
                data = json.loads(line)
                if "time" in data:
                    return float(data["time"])
            except Exception:
                pass
        # Try regex for "Time=<float> s"
        m = re.search(r"Time=([0-9.]+)\s*s?", line)
        if m:
            return float(m.group(1))
    raise ValueError(f"Could not parse execution time from output:\n{output}")

def run_serial(w, h):
    out_ppm = "/tmp/bench_serial.ppm"
    cmd = [SERIAL_BIN, str(w), str(h), out_ppm, str(NUM_SPHERES)]
    times = []
    for _ in range(NUM_RUNS):
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        times.append(parse_time(res.stdout))
    if os.path.exists(out_ppm):
        os.remove(out_ppm)
    return min(times), times

def run_openmp(w, h, threads, schedule, chunk=16):
    out_ppm = f"/tmp/bench_omp_{threads}_{schedule}.ppm"
    cmd = [OPENMP_BIN, str(w), str(h), out_ppm, str(threads), str(NUM_SPHERES), schedule, str(chunk)]
    times = []
    for _ in range(NUM_RUNS):
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        times.append(parse_time(res.stdout))
    if os.path.exists(out_ppm):
        os.remove(out_ppm)
    return min(times), times

def run_mpi(w, h, procs, mode):
    out_ppm = f"/tmp/bench_mpi_{procs}_{mode}.ppm"
    cmd = ["mpirun", "--oversubscribe", "-np", str(procs), MPI_BIN, str(w), str(h), mode, str(NUM_SPHERES), out_ppm]
    times = []
    for _ in range(NUM_RUNS):
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        times.append(parse_time(res.stdout))
    if os.path.exists(out_ppm):
        os.remove(out_ppm)
    return min(times), times

def main():
    compile_binaries()

    raw_records = []
    comparison_table = []
    size_results = {}

    print(f"Starting benchmarks: sizes={SIZES}, workers={WORKERS}, runs={NUM_RUNS} each...")
    print("-" * 75)

    for sz in SIZES:
        print(f"\n[Benchmarking Image Size: {sz}x{sz}]")
        
        # 1. Serial baseline
        serial_best, serial_runs = run_serial(sz, sz)
        print(f"  Serial (1 worker)   : best={serial_best:.6f}s (runs: {[round(t, 5) for t in serial_runs]})")
        
        raw_records.append({
            "size": sz,
            "workers": 1,
            "variant": "serial",
            "time_s": serial_best,
            "speedup": 1.0,
            "efficiency": 1.0,
            "run1": serial_runs[0],
            "run2": serial_runs[1],
            "run3": serial_runs[2]
        })

        size_data = {
            "size": sz,
            "serial": {
                "time": serial_best,
                "runs": serial_runs
            },
            "workers": {}
        }

        overall_fastest_time = serial_best
        overall_fastest_variant = "serial"

        for p in WORKERS:
            # 2. OpenMP static
            omp_stat_best, omp_stat_runs = run_openmp(sz, sz, p, "static", chunk=1)
            omp_stat_sp = serial_best / omp_stat_best if omp_stat_best > 0 else 0
            omp_stat_eff = omp_stat_sp / p

            # 3. OpenMP dynamic (chunk 16)
            omp_dyn_best, omp_dyn_runs = run_openmp(sz, sz, p, "dynamic", chunk=16)
            omp_dyn_sp = serial_best / omp_dyn_best if omp_dyn_best > 0 else 0
            omp_dyn_eff = omp_dyn_sp / p

            # 4. MPI static
            mpi_stat_best, mpi_stat_runs = run_mpi(sz, sz, p, "static")
            mpi_stat_sp = serial_best / mpi_stat_best if mpi_stat_best > 0 else 0
            mpi_stat_eff = mpi_stat_sp / p

            # 5. MPI dynamic
            mpi_dyn_best, mpi_dyn_runs = run_mpi(sz, sz, p, "dynamic")
            mpi_dyn_sp = serial_best / mpi_dyn_best if mpi_dyn_best > 0 else 0
            mpi_dyn_eff = mpi_dyn_sp / p

            # Record raw entries
            raw_records.extend([
                {"size": sz, "workers": p, "variant": "omp_static", "time_s": omp_stat_best, "speedup": round(omp_stat_sp, 4), "efficiency": round(omp_stat_eff, 4), "run1": omp_stat_runs[0], "run2": omp_stat_runs[1], "run3": omp_stat_runs[2]},
                {"size": sz, "workers": p, "variant": "omp_dynamic", "time_s": omp_dyn_best, "speedup": round(omp_dyn_sp, 4), "efficiency": round(omp_dyn_eff, 4), "run1": omp_dyn_runs[0], "run2": omp_dyn_runs[1], "run3": omp_dyn_runs[2]},
                {"size": sz, "workers": p, "variant": "mpi_static", "time_s": mpi_stat_best, "speedup": round(mpi_stat_sp, 4), "efficiency": round(mpi_stat_eff, 4), "run1": mpi_stat_runs[0], "run2": mpi_stat_runs[1], "run3": mpi_stat_runs[2]},
                {"size": sz, "workers": p, "variant": "mpi_dynamic", "time_s": mpi_dyn_best, "speedup": round(mpi_dyn_sp, 4), "efficiency": round(mpi_dyn_eff, 4), "run1": mpi_dyn_runs[0], "run2": mpi_dyn_runs[1], "run3": mpi_dyn_runs[2]}
            ])

            # Find fastest among the 4 parallel variants for this worker count
            options = [
                ("OMP Static", omp_stat_best, omp_stat_sp),
                ("OMP Dynamic", omp_dyn_best, omp_dyn_sp),
                ("MPI Static", mpi_stat_best, mpi_stat_sp),
                ("MPI Dynamic", mpi_dyn_best, mpi_dyn_sp),
            ]
            options.sort(key=lambda x: x[1])
            winner_name, winner_time, winner_sp = options[0]

            if winner_time < overall_fastest_time:
                overall_fastest_time = winner_time
                overall_fastest_variant = f"{winner_name} ({p}W)"

            comparison_table.append({
                "size": sz,
                "workers": p,
                "serial": round(serial_best, 6),
                "omp_static": round(omp_stat_best, 6),
                "omp_dynamic": round(omp_dyn_best, 6),
                "mpi_static": round(mpi_stat_best, 6),
                "mpi_dynamic": round(mpi_dyn_best, 6),
                "omp_static_sp": round(omp_stat_sp, 2),
                "omp_dynamic_sp": round(omp_dyn_sp, 2),
                "mpi_static_sp": round(mpi_stat_sp, 2),
                "mpi_dynamic_sp": round(mpi_dyn_sp, 2),
                "fastest": winner_name,
                "fastest_time": round(winner_time, 6),
                "max_speedup": round(winner_sp, 2)
            })

            size_data["workers"][str(p)] = {
                "omp_static": {"time": omp_stat_best, "speedup": round(omp_stat_sp, 4), "efficiency": round(omp_stat_eff, 4), "runs": omp_stat_runs},
                "omp_dynamic": {"time": omp_dyn_best, "speedup": round(omp_dyn_sp, 4), "efficiency": round(omp_dyn_eff, 4), "runs": omp_dyn_runs},
                "mpi_static": {"time": mpi_stat_best, "speedup": round(mpi_stat_sp, 4), "efficiency": round(mpi_stat_eff, 4), "runs": mpi_stat_runs},
                "mpi_dynamic": {"time": mpi_dyn_best, "speedup": round(mpi_dyn_sp, 4), "efficiency": round(mpi_dyn_eff, 4), "runs": mpi_dyn_runs},
                "winner": winner_name,
                "winner_speedup": round(winner_sp, 2)
            }

            print(f"  Workers={p} -> OMP Stat: {omp_stat_best:.5f}s ({omp_stat_sp:.2f}x) | OMP Dyn: {omp_dyn_best:.5f}s ({omp_dyn_sp:.2f}x) | MPI Stat: {mpi_stat_best:.5f}s ({mpi_stat_sp:.2f}x) | MPI Dyn: {mpi_dyn_best:.5f}s ({mpi_dyn_sp:.2f}x) | WINNER: {winner_name}")

        size_data["fastest_overall"] = overall_fastest_variant
        size_data["fastest_time"] = round(overall_fastest_time, 6)
        size_data["max_speedup"] = round(serial_best / overall_fastest_time, 2) if overall_fastest_time > 0 else 1.0
        size_results[str(sz)] = size_data

    # Save results.json
    final_json = {
        "metadata": {
            "name": "Jyothika A P",
            "rollNo": "2024BCS0037",
            "date": datetime.now().isoformat(),
            "platform": platform.platform(),
            "cpu": get_cpu_model(),
            "sizes": SIZES,
            "workers": WORKERS,
            "note": "Measured locally. MPI cannot run in serverless Vercel environments."
        },
        "by_size": size_results,
        "table": comparison_table,
        "raw": raw_records
    }

    out_json_path = os.path.join(ROOT_DIR, "results.json")
    with open(out_json_path, "w") as f:
        json.dump(final_json, f, indent=2)
    print(f"\nWrote: {out_json_path}")

    # Copy results.json to frontend and cpp dirs
    destinations = [
        os.path.join(CPP_DIR, "results.json"),
        os.path.join(ROOT_DIR, "rtweb", "frontend", "src", "results.json"),
        os.path.join(ROOT_DIR, "rtweb", "frontend", "public", "results.json")
    ]
    for dest in destinations:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copyfile(out_json_path, dest)
        print(f"Synced JSON to: {dest}")

    # Save results.csv
    out_csv_path = os.path.join(ROOT_DIR, "results.csv")
    with open(out_csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["size", "workers", "variant", "time_s", "speedup", "efficiency", "run1", "run2", "run3"])
        writer.writeheader()
        writer.writerows(raw_records)
    print(f"Wrote: {out_csv_path}")

    # Copy results.csv to cpp and frontend public
    csv_dests = [
        os.path.join(CPP_DIR, "results.csv"),
        os.path.join(ROOT_DIR, "rtweb", "frontend", "public", "results.csv")
    ]
    for dest in csv_dests:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copyfile(out_csv_path, dest)
        print(f"Synced CSV to: {dest}")

    print("\nBenchmark suite completed successfully!")

if __name__ == "__main__":
    main()
