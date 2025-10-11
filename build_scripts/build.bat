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
    call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" 2>nul
    if %errorlevel% neq 0 (
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
)

REM Create build directory (go up one level to project root)
if not exist ..\build_glb mkdir ..\build_glb
cd ..\build_glb

REM Configure with CMake
echo Configuring with CMake...
cmake ..\build_scripts -G "Visual Studio 17 2022" -A x64
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
echo Executable location: bin\Release\jt_converter_wrapper.exe
echo.
echo To test the wrapper:
echo   bin\Release\jt_converter_wrapper.exe input.jt output.glb
echo.
echo To start the server:
echo   python ..\tools\jt_conversion\jt_conversion_server_glb.py
echo.

pause
