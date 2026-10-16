#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
echo "Running CSS 311 Parallel Ray Tracing Benchmarks..."
python3 "$DIR/bench_all.py" "$@"
