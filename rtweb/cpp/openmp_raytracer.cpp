// CSS 311 Assignment I - SIMPLE OpenMP Parallel Ray Tracer
// Name: JYOTHIKA A P   Roll No: 2024BCS0037
//
// Identical algorithm and math to serial_raytracer.cpp. Only difference:
// the flattened pixel loop is annotated with #pragma omp parallel for,
// and the thread count is set from the command line.
//
// Usage: ./openmp_raytracer <width> <height> <outputPPM> <numThreads> [numSpheres 2 or 3]

#include <cstdio>
#include <cmath>
#include <vector>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <omp.h>
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

Sphere ALL_SPHERES[3] = {
    { Vec3(0, 0, -5),    1.0, Vec3(0.9, 0.2, 0.2) },
    { Vec3(-2, 0, -6),   1.2, Vec3(0.2, 0.8, 0.2) },
    { Vec3(2, -0.3, -7), 0.8, Vec3(0.2, 0.3, 0.9) },
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

// SAME pure per-pixel function as the serial version -- no shared mutable
// state, no dependency on any other pixel. That purity is exactly why
// this call is safe to run on many threads at once.
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

int main(int argc, char** argv) {
    int W = argc > 1 ? atoi(argv[1]) : 500;
    int H = argc > 2 ? atoi(argv[2]) : 500;
    const char* outPath = argc > 3 ? argv[3] : "output.ppm";
    int numThreads = argc > 4 ? atoi(argv[4]) : 4;
    int numSpheres = argc > 5 ? atoi(argv[5]) : 3;

    omp_set_num_threads(numThreads);
    vector<Vec3> image(W * H);

    auto t0 = chrono::steady_clock::now();

    // Shared:  image[] (each thread writes a different index -> no race),
    //          ALL_SPHERES, LIGHT, BACKGROUND (read-only)
    // Private: pixel, x, y (each thread gets its own copy automatically,
    //          since they are declared inside the loop body)
    #pragma omp parallel for schedule(static)
    for (int pixel = 0; pixel < W * H; pixel++) {
        int x = pixel % W;
        int y = pixel / W;
        image[pixel] = tracePixel(x, y, W, H, numSpheres);
    }
    // implicit barrier here: all threads finish before we continue

    auto t1 = chrono::steady_clock::now();
    double elapsed = chrono::duration<double>(t1 - t0).count();

    FILE* f = fopen(outPath, "wb");
    fprintf(f, "P6\n%d %d\n255\n", W, H);
    for (int i = 0; i < W * H; i++) {
        uint8_t r = (uint8_t)(min(1.0, image[i].x) * 255);
        uint8_t g = (uint8_t)(min(1.0, image[i].y) * 255);
        uint8_t b = (uint8_t)(min(1.0, image[i].z) * 255);
        fwrite(&r, 1, 1, f); fwrite(&g, 1, 1, f); fwrite(&b, 1, 1, f);
    }
    fclose(f);

    printf("{\"width\":%d,\"height\":%d,\"threads\":%d,\"time\":%.6f}\n", W, H, numThreads, elapsed);
    return 0;
}
