@echo off
REM Build script for JT Converter Wrapper
REM This script builds the C++ wrapper using CMake

echo ===============================================
echo Building JT Converter Wrapper
echo ===============================================

REM Check if CMake is available
cmake --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: CMake is not installed or not in PATH
    echo Please install CMake from https://cmake.org/download/
    pause
    exit /b 1
)

REM Check if Visual Studio is available
where cl >nul 2>&1
if %errorlevel% neq 0 (
    echo Setting up Visual Studio environment...
    call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" 2>nul
    if %errorlevel% neq 0 (
        call "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat" 2>nul
        if %errorlevel% neq 0 (
            echo ERROR: Visual Studio not found
            echo Please install Visual Studio 2019 or 2022 with C++ development tools
            pause
            exit /b 1
        )
    )
)

REM Create build directory
if not exist build mkdir build
cd build

REM Configure with CMake
echo Configuring with CMake...
cmake .. -G "Visual Studio 17 2022" -A x64
if %errorlevel% neq 0 (
    echo ERROR: CMake configuration failed
    pause
    exit /b 1
)

REM Build the project
echo Building project...
cmake --build . --config Release
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo ===============================================
echo Build completed successfully!
echo ===============================================
echo.
echo Executable location: build\bin\Release\jt_converter_wrapper.exe
echo.
echo To test the wrapper:
echo   jt_converter_wrapper.exe input.jt output.gltf
echo.
echo To start the server:
echo   python jt_conversion_server.py
echo.

REM Copy the executable to the root directory for easier access
if exist bin\Release\jt_converter_wrapper.exe (
    copy bin\Release\jt_converter_wrapper.exe ..\jt_converter_wrapper.exe
    echo Copied executable to root directory
)

pause
