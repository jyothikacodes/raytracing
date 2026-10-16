CXX ?= g++
MPICXX ?= mpicxx
CXXFLAGS ?= -O2 -std=c++17
OPENMP_FLAGS ?= -fopenmp

TARGETS = serial_raytracer openmp_raytracer mpi_ray

all: $(TARGETS)

serial_raytracer: serial_raytracer.cpp
	$(CXX) $(CXXFLAGS) serial_raytracer.cpp -o serial_raytracer

openmp_raytracer: openmp_raytracer.cpp
	$(CXX) $(CXXFLAGS) $(OPENMP_FLAGS) openmp_raytracer.cpp -o openmp_raytracer

mpi_ray: mpi_ray.cpp
	$(MPICXX) -O2 mpi_ray.cpp -o mpi_ray

clean:
	rm -f $(TARGETS) *.ppm
