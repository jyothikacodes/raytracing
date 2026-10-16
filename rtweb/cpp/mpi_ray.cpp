// CSS 311 Parallel Ray Tracing - Module 3: MPI Implementation
// Name: Jyothika A P   Roll No: 2024BCS0037
//
// Reuses the identical scene and pixel tracing math from serial_raytracer.cpp
// and openmp_raytracer.cpp so output matches pixel-for-pixel.
//
// Modes:
//   1. static: Contiguous row blocks per rank (remainder rows assigned to first ranks),
//              collected with MPI_Gatherv.
//   2. dynamic: Master-worker. Rank 0 dispatches 1 row at a time (tag 1), sends tag 0 to stop.
//               Workers return rendered rows with tag = row index. Requires np >= 2.
//
// Usage: mpirun -np <procs> ./mpi_ray <width> <height> <static|dynamic> [numSpheres 2 or 3] [outputPPM]

#include <mpi.h>
#include <cstdio>
#include <cmath>
#include <vector>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <string>
#include <algorithm>
using namespace std;

struct Vec3 {
    double x, y, z;
    Vec3(double x_ = 0, double y_ = 0, double z_ = 0) : x(x_), y(y_), z(z_) {}
    Vec3 operator+(Vec3 o) { return Vec3(x + o.x, y + o.y, z + o.z); }
    Vec3 operator-(Vec3 o) { return Vec3(x - o.x, y - o.y, z - o.z); }
    Vec3 operator*(double s) { return Vec3(x * s, y * s, z * s); }
    double dot(Vec3 o) { return x * o.x + y * o.y + z * o.z; }
    Vec3 norm() { double l = sqrt(dot(*this)); return Vec3(x / l, y / l, z / l); }
};

struct Sphere { Vec3 center; double radius; Vec3 color; };

// Fixed read-only scene: up to 3 spheres + 1 light
Sphere ALL_SPHERES[3] = {
    { Vec3(0, 0, -5),    1.0, Vec3(0.9, 0.2, 0.2) },   // red
    { Vec3(-2, 0, -6),   1.2, Vec3(0.2, 0.8, 0.2) },   // green
    { Vec3(2, -0.3, -7), 0.8, Vec3(0.2, 0.3, 0.9) },   // blue
};
Vec3 LIGHT(5, 5, 0);
Vec3 BACKGROUND(0.6, 0.75, 1.0);

bool hitSphere(Vec3 origin, Vec3 dir, Sphere s, double &t) {
    Vec3 oc = origin - s.center;
    double b = 2 * dir.dot(oc);
    double c = oc.dot(oc) - s.radius * s.radius;
    double disc = b * b - 4 * c;
    if (disc < 0) return false;
    double t0 = (-b - sqrt(disc)) / 2;
    if (t0 < 0.001) return false;
    t = t0;
    return true;
}

// Same pure per-pixel function as serial_raytracer.cpp and openmp_raytracer.cpp
Vec3 tracePixel(int x, int y, int W, int H, int numSpheres) {
    double ndc_x = (2.0 * (x + 0.5) / W - 1.0) * ((double)W / H);
    double ndc_y = 1.0 - 2.0 * (y + 0.5) / H;
    Vec3 origin(0, 0, 0);
    Vec3 dir = Vec3(ndc_x, ndc_y, -1).norm();

    double closest = 1e9;
    int hitIdx = -1;
    for (int i = 0; i < numSpheres; i++) {
        double t;
        if (hitSphere(origin, dir, ALL_SPHERES[i], t) && t < closest) {
            closest = t;
            hitIdx = i;
        }
    }
    if (hitIdx == -1) return BACKGROUND;

    Vec3 hitPoint = origin + dir * closest;
    Vec3 normal = (hitPoint - ALL_SPHERES[hitIdx].center).norm();
    Vec3 lightDir = (LIGHT - hitPoint).norm();
    double diff = max(0.0, normal.dot(lightDir));
    return ALL_SPHERES[hitIdx].color * diff;
}

// Tags for dynamic master-worker protocol
const int TAG_STOP = 0;
const int TAG_WORK = 1;

int main(int argc, char** argv) {
    MPI_Init(&argc, &argv);

    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    int W = argc > 1 ? atoi(argv[1]) : 500;
    int H = argc > 2 ? atoi(argv[2]) : 500;
    string mode = argc > 3 ? argv[3] : "static";
    int numSpheres = 3;
    string outPath = "";

    if (argc > 4) {
        string arg4 = argv[4];
        if (arg4 == "2" || arg4 == "3") {
            numSpheres = atoi(argv[4]);
            if (argc > 5) outPath = argv[5];
        } else {
            outPath = arg4;
        }
    }

    if (mode == "dynamic" && size < 2) {
        if (rank == 0) {
            fprintf(stderr, "Error: Dynamic master-worker mode requires np >= 2 (master + at least 1 worker).\n");
        }
        MPI_Finalize();
        return 1;
    }

    vector<uint8_t> globalImage;
    if (rank == 0) {
        globalImage.resize(W * H * 3);
    }

    // Time with MPI_Wtime between two MPI_Barriers
    MPI_Barrier(MPI_COMM_WORLD);
    double t0 = MPI_Wtime();

    if (mode == "static") {
        // Mode 1: Static row distribution
        // Contiguous row blocks per rank (remainder rows go to the first ranks)
        int baseRows = H / size;
        int rem = H % size;
        int myRows = baseRows + (rank < rem ? 1 : 0);
        int myStartRow = rank * baseRows + min(rank, rem);

        vector<uint8_t> localBuffer(myRows * W * 3);

        for (int r = 0; r < myRows; r++) {
            int y = myStartRow + r;
            for (int x = 0; x < W; x++) {
                Vec3 col = tracePixel(x, y, W, H, numSpheres);
                int idx = (r * W + x) * 3;
                localBuffer[idx + 0] = (uint8_t)(min(1.0, max(0.0, col.x)) * 255);
                localBuffer[idx + 1] = (uint8_t)(min(1.0, max(0.0, col.y)) * 255);
                localBuffer[idx + 2] = (uint8_t)(min(1.0, max(0.0, col.z)) * 255);
            }
        }

        // Setup counts and displacements for MPI_Gatherv
        vector<int> counts(size);
        vector<int> displs(size);
        for (int r = 0; r < size; r++) {
            int rRows = baseRows + (r < rem ? 1 : 0);
            int rStart = r * baseRows + min(r, rem);
            counts[r] = rRows * W * 3;
            displs[r] = rStart * W * 3;
        }

        MPI_Gatherv(localBuffer.data(), myRows * W * 3, MPI_UNSIGNED_CHAR,
                    rank == 0 ? globalImage.data() : nullptr,
                    counts.data(), displs.data(), MPI_UNSIGNED_CHAR,
                    0, MPI_COMM_WORLD);

    } else {
        // Mode 2: Dynamic master-worker
        // Rank 0 is master, ranks 1..size-1 are workers
        if (rank == 0) {
            vector<uint8_t> recvRow(W * 3);
            int nextRow = 0;
            int rowsReceived = 0;

            // Initial dispatch of one row to each worker
            for (int worker = 1; worker < size; worker++) {
                if (nextRow < H) {
                    int rowToSend = nextRow++;
                    MPI_Send(&rowToSend, 1, MPI_INT, worker, TAG_WORK, MPI_COMM_WORLD);
                } else {
                    int stopSignal = -1;
                    MPI_Send(&stopSignal, 1, MPI_INT, worker, TAG_STOP, MPI_COMM_WORLD);
                }
            }

            // Receive completed rows and dispatch remaining rows
            while (rowsReceived < H) {
                MPI_Status status;
                MPI_Recv(recvRow.data(), W * 3, MPI_UNSIGNED_CHAR, MPI_ANY_SOURCE, MPI_ANY_TAG, MPI_COMM_WORLD, &status);

                int completedRow = status.MPI_TAG; // worker returns tag = row index
                int worker = status.MPI_SOURCE;
                rowsReceived++;

                memcpy(&globalImage[completedRow * W * 3], recvRow.data(), W * 3);

                if (nextRow < H) {
                    int rowToSend = nextRow++;
                    MPI_Send(&rowToSend, 1, MPI_INT, worker, TAG_WORK, MPI_COMM_WORLD);
                } else {
                    int stopSignal = -1;
                    MPI_Send(&stopSignal, 1, MPI_INT, worker, TAG_STOP, MPI_COMM_WORLD);
                }
            }
        } else {
            // Worker process
            vector<uint8_t> rowBuffer(W * 3);
            while (true) {
                int rowIdx = -1;
                MPI_Status status;
                MPI_Recv(&rowIdx, 1, MPI_INT, 0, MPI_ANY_TAG, MPI_COMM_WORLD, &status);

                if (status.MPI_TAG == TAG_STOP) {
                    break;
                }

                // Render assigned row
                for (int x = 0; x < W; x++) {
                    Vec3 col = tracePixel(x, rowIdx, W, H, numSpheres);
                    int idx = x * 3;
                    rowBuffer[idx + 0] = (uint8_t)(min(1.0, max(0.0, col.x)) * 255);
                    rowBuffer[idx + 1] = (uint8_t)(min(1.0, max(0.0, col.y)) * 255);
                    rowBuffer[idx + 2] = (uint8_t)(min(1.0, max(0.0, col.z)) * 255);
                }

                // Send row back with tag = row index
                MPI_Send(rowBuffer.data(), W * 3, MPI_UNSIGNED_CHAR, 0, rowIdx, MPI_COMM_WORLD);
            }
        }
    }

    MPI_Barrier(MPI_COMM_WORLD);
    double t1 = MPI_Wtime();
    double elapsed = t1 - t0;

    if (rank == 0) {
        printf("Name: Jyothika A P Roll No: 2024BCS0037\n");
        printf("Mode=%s Size=%dx%d Procs=%d Time=%.6f s\n", mode.c_str(), W, H, size, elapsed);
        printf("{\"width\":%d,\"height\":%d,\"procs\":%d,\"mode\":\"%s\",\"time\":%.6f}\n",
               W, H, size, mode.c_str(), elapsed);

        if (!outPath.empty()) {
            FILE* f = fopen(outPath.c_str(), "wb");
            if (f) {
                fprintf(f, "P6\n%d %d\n255\n", W, H);
                fwrite(globalImage.data(), 1, W * H * 3, f);
                fclose(f);
            }
        }
    }

    MPI_Finalize();
    return 0;
}
