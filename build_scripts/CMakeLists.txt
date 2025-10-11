cmake_minimum_required(VERSION 3.20)
project(JTConverterWrapper)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Set output directories
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

# Add executable
add_executable(jt_converter_wrapper
    jt_converter_real_meshes_v3.cpp
)

# Print configuration info
message(STATUS "Building REAL JT converter wrapper")
message(STATUS "This version extracts REAL geometry: complex assemblies, real tessellation data, material colors")

# Install target
install(TARGETS jt_converter_wrapper
    RUNTIME DESTINATION bin
)
