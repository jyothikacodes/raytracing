#!/bin/bash
# Module 3 - full terminal output (Serial, OpenMP static/dynamic, MPI).
# Run from the repo root:   bash module3.sh | tee module3_output.txt
cd rtweb/cpp || exit 1
NAME="Jyothika A P"; ROLL="2024BCS0037"
line() { printf '%*s\n' 78 '' | tr ' ' '='; }
line; echo " CSS 311 - ASSIGNMENT 2 - MODULE III (MPI)"; echo " Name: $NAME    Roll No: $ROLL"; echo " $(date)"; line
echo; echo "[1] Build"
g++ -O2 -std=c++17 serial_raytracer.cpp -o serial_raytracer &&
g++ -O2 -std=c++17 -fopenmp openmp_raytracer.cpp -o openmp_raytracer &&
mpicxx -O2 mpi_ray.cpp -o mpi_ray && echo "    serial_raytracer, openmp_raytracer, mpi_ray built OK" || { echo BUILD FAILED; exit 1; }

echo; line; echo "[2] Q8 - Small test case: 8x8 image, 3 spheres, 3 processes"; line
echo "\$ mpirun -np 3 ./mpi_ray 8 8 static 3"; mpirun --oversubscribe -np 3 ./mpi_ray 8 8 static 3 | head -2

echo; line; echo "[3] Q9 - MPI test cases (4 processes), image checked against serial output"; line
for n in 100 500 1000 2000; do
  ./serial_raytracer $n $n s_$n.ppm 3 > /dev/null
  echo "\$ mpirun -np 4 ./mpi_ray $n $n static 3 out.ppm"
  mpirun --oversubscribe -np 4 ./mpi_ray $n $n static 3 m_$n.ppm | head -2
  if cmp -s s_$n.ppm m_$n.ppm; then echo "    image check: IDENTICAL to serial output"; else echo "    image check: MISMATCH"; fi
  echo
done

echo; line; echo "[4] Q11 - Execution time comparison (ms, best of 3) and speedup vs serial"; line
python3 - "$NAME" "$ROLL" <<'PY'
import subprocess, re, sys
def best(cmd, pat):
    ts=[]
    for _ in range(3):
        o=subprocess.run(cmd,capture_output=True,text=True).stdout
        ts.append(float(re.search(pat,o).group(1)))
    return min(ts)*1000
V=["Serial","OMP static","OMP dynamic","MPI"]
for w in (2,4,8):
    print(f"\n  {w} workers (OpenMP threads / MPI processes)          Name: {sys.argv[1]}  Roll No: {sys.argv[2]}")
    print("  " + "Size".ljust(11) + "".join(v.rjust(14) for v in V) + "   Fastest parallel")
    for n in (100,250,500,1000,2000):
        s=best(["./serial_raytracer",str(n),str(n),"o.ppm","3"], r'"time":([\d.]+)')
        t=[s,
           best(["./openmp_raytracer",str(n),str(n),"o.ppm",str(w),"3","static","16"], r'"time":([\d.]+)'),
           best(["./openmp_raytracer",str(n),str(n),"o.ppm",str(w),"3","dynamic","16"], r'"time":([\d.]+)'),
           best(["mpirun","--oversubscribe","-np",str(w),"./mpi_ray",str(n),str(n),"static","3"], r'Time=([\d.]+) s')]
        k=min(range(1,4),key=lambda i:t[i])
        print("  "+f"{n}x{n}".ljust(11)+"".join(f"{x:14.3f}" for x in t)+f"   {V[k]} ({s/t[k]:.2f}x)")
PY
echo; line; echo " Module III complete.   Name: $NAME   Roll No: $ROLL"; line