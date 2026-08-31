// CSS 311 Assignment I - SIMPLE Serial Ray Tracer
// Name: ____________________   Roll No: ____________
//
// Algorithm:
//   FOR every pixel:
//     generate ray
//     FOR every sphere: test intersection, keep nearest
//     IF hit -> shade color   ELSE -> background color
//     store pixel
//
// Usage: ./serial_raytracer <width> <height> <outputPPM> [numSpheres 2 or 3]

#include <cstdio>
#include <cmath>
#include <vector>
#include <chrono>
#include <cstdint>
#include <cstdlib>
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

// Fixed simple scene: up to 3 spheres + 1 light. No ground plane, no reflections.
Sphere ALL_SPHERES[3] = {
    { Vec3(0, 0, -5),    1.0, Vec3(0.9, 0.2, 0.2) },   // red
    { Vec3(-2, 0, -6),   1.2, Vec3(0.2, 0.8, 0.2) },   // green
    { Vec3(2, -0.3, -7), 0.8, Vec3(0.2, 0.3, 0.9) },   // blue
};
Vec3 LIGHT(5, 5, 0);
Vec3 BACKGROUND(0.6, 0.75, 1.0);

// Ray-sphere intersection. Ray direction must be normalized (so a = 1).
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

// Computes the color of ONE pixel. Depends only on (x, y) and the fixed
// scene -- not on any other pixel. This is what makes the loop parallelizable.
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
    int numSpheres = argc > 4 ? atoi(argv[4]) : 3;

    vector<Vec3> image(W * H);

    auto t0 = chrono::steady_clock::now();

    for (int pixel = 0; pixel < W * H; pixel++) {
        int x = pixel % W;
        int y = pixel / W;
        image[pixel] = tracePixel(x, y, W, H, numSpheres);
    }

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

    // Machine-readable line the backend/API parses:
    printf("{\"width\":%d,\"height\":%d,\"threads\":1,\"time\":%.6f}\n", W, H, elapsed);
    return 0;
}
