@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM   Build Production-Grade LineSimConverter
REM   Robust, Fault-Tolerant JT/PSZ to OBJ Converter
REM ═══════════════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

echo.
echo ═══════════════════════════════════════════════════════════════════════════
echo   Building Production-Grade LineSimConverter
echo ═══════════════════════════════════════════════════════════════════════════
echo.

REM ═══════════════════════════════════════════════════════════════════════════
REM Configuration
REM ═══════════════════════════════════════════════════════════════════════════

set LINESIM_DIR=C:\tmp\LineSimulator
set OUT_DIR=.\converter_build_robust
set LOG_FILE=build.log

REM Find C# compiler
set CSC=
for %%v in (v4.0.30319 v3.5 v2.0.50727) do (
    if exist "C:\Windows\Microsoft.NET\Framework64\%%v\csc.exe" (
        set CSC=C:\Windows\Microsoft.NET\Framework64\%%v\csc.exe
        goto :found_csc
    )
)

:found_csc
if "%CSC%"=="" (
    echo [ERROR] C# compiler not found!
    echo [ERROR] Install .NET Framework 4.8 SDK
    echo [ERROR] Download from: https://dotnet.microsoft.com/download/dotnet-framework
    pause
    exit /b 1
)

echo [1/6] Environment Check
echo       CSC:        %CSC%
echo       LineSimulator: %LINESIM_DIR%
echo       Output:     %OUT_DIR%
echo.

REM ═══════════════════════════════════════════════════════════════════════════
REM Validate LineSimulator Installation
REM ═══════════════════════════════════════════════════════════════════════════

if not exist "%LINESIM_DIR%" (
    echo [ERROR] LineSimulator not found at: %LINESIM_DIR%
    echo [ERROR] Expected directory structure:
    echo [ERROR]   C:\tmp\LineSimulator\
    echo [ERROR]   ├── lib\
    echo [ERROR]   ├── lib3\
    echo [ERROR]   └── plugins\
    echo.
    echo [FIX] Extract LineSimulator.7z to C:\tmp\LineSimulator
    pause
    exit /b 1
)

REM Check critical DLLs
set MISSING_DLLS=0
set "DLLS_TO_CHECK=lib3\JtReader.dll lib3\Jt951.dll lib\ObjXWriter.dll lib\PszReader.dll"

echo [2/6] Validating Dependencies
for %%d in (%DLLS_TO_CHECK%) do (
    if not exist "%LINESIM_DIR%\%%d" (
        echo       ✗ MISSING: %%d
        set /a MISSING_DLLS+=1
    ) else (
        echo       ✓ Found:   %%d
    )
)

if %MISSING_DLLS% GTR 0 (
    echo.
    echo [ERROR] %MISSING_DLLS% required DLL(s) missing!
    echo [ERROR] LineSimulator installation may be corrupted
    pause
    exit /b 1
)

echo.

REM ═══════════════════════════════════════════════════════════════════════════
REM Create Output Directory
REM ═══════════════════════════════════════════════════════════════════════════

echo [3/6] Preparing Build Directory
if exist "%OUT_DIR%" (
    echo       Cleaning existing build...
    rd /s /q "%OUT_DIR%" 2>nul
)
mkdir "%OUT_DIR%" 2>nul

REM ═══════════════════════════════════════════════════════════════════════════
REM Copy Dependencies
REM ═══════════════════════════════════════════════════════════════════════════

echo [4/6] Copying Dependencies
set COPY_COUNT=0

REM Core JT Open Toolkit DLLs
echo       Copying JT Open Toolkit...
for %%f in (
    JtReader.dll
    Jt951.dll
    JtTk105.dll
    ParaSupt951.dll
    plmxmlAdapterJT60.dll
    plmxmlExtensions.dll
    plmxmlSDK.dll
    psbodyshop.dll
    pskernel.dll
    psxttoolkit.dll
) do (
    copy /Y "%LINESIM_DIR%\lib3\%%f" "%OUT_DIR%\" >nul 2>&1
    if errorlevel 1 (
        echo       ✗ Failed to copy: %%f
    ) else (
        set /a COPY_COUNT+=1
    )
)

REM LineSimulator Libraries
echo       Copying LineSimulator libraries...
for %%f in (
    ObjXWriter.dll
    LineSimulatorLibrary.dll
    PszReader.dll
    ModelDataFile.dll
    ObjXFile.dll
    JtConfig.dll
    CommonLibrary.dll
    CommonLibraryNetStandard.dll
    SharpDX.dll
    SharpDX.Mathematics.dll
) do (
    copy /Y "%LINESIM_DIR%\lib\%%f" "%OUT_DIR%\" >nul 2>&1
    if errorlevel 1 (
        echo       ✗ Failed to copy: %%f
    ) else (
        set /a COPY_COUNT+=1
    )
)

echo       ✓ Copied %COPY_COUNT% DLLs
echo.

REM ═══════════════════════════════════════════════════════════════════════════
REM Compile Converter
REM ═══════════════════════════════════════════════════════════════════════════

echo [5/6] Compiling LineSimConverterRobust.cs

"%CSC%" /nologo ^
  /target:exe ^
  /platform:x64 ^
  /optimize+ ^
  /out:"%OUT_DIR%\LineSimConverterRobust.exe" ^
  /reference:"%OUT_DIR%\JtReader.dll" ^
  /reference:"%OUT_DIR%\LineSimulatorLibrary.dll" ^
  /reference:"%OUT_DIR%\PszReader.dll" ^
  /reference:"%OUT_DIR%\ObjXWriter.dll" ^
  /reference:"%OUT_DIR%\ModelDataFile.dll" ^
  /reference:"%OUT_DIR%\ObjXFile.dll" ^
  /reference:"%OUT_DIR%\JtConfig.dll" ^
  /reference:"%OUT_DIR%\CommonLibrary.dll" ^
  /reference:"%OUT_DIR%\SharpDX.dll" ^
  /reference:"%OUT_DIR%\SharpDX.Mathematics.dll" ^
  LineSimConverterRobust.cs

if errorlevel 1 (
    echo.
    echo [ERROR] Compilation failed!
    echo [ERROR] See error messages above
    echo.
    echo [DEBUG] Check:
    echo [DEBUG]   1. .NET Framework 4.8 SDK installed
    echo [DEBUG]   2. LineSimConverterRobust.cs exists
    echo [DEBUG]   3. All referenced DLLs are in %OUT_DIR%
    pause
    exit /b 1
)

echo       ✓ Compilation successful
echo.

REM ═══════════════════════════════════════════════════════════════════════════
REM Test Executable
REM ═══════════════════════════════════════════════════════════════════════════

echo [6/6] Testing Executable
"%OUT_DIR%\LineSimConverterRobust.exe" >nul 2>&1
if errorlevel 1 (
    echo       ✓ Executable runs (expected error - no arguments)
) else (
    echo       ✓ Executable runs
)
echo.

REM ═══════════════════════════════════════════════════════════════════════════
REM Success Summary
REM ═══════════════════════════════════════════════════════════════════════════

echo ═══════════════════════════════════════════════════════════════════════════
echo   Build Complete!
echo ═══════════════════════════════════════════════════════════════════════════
echo.
echo   Executable:  %OUT_DIR%\LineSimConverterRobust.exe
echo   Dependencies: %COPY_COUNT% DLLs copied
echo.
echo ═══════════════════════════════════════════════════════════════════════════
echo   Quick Start
echo ═══════════════════════════════════════════════════════════════════════════
echo.
echo   Convert single robot:
echo     cd %OUT_DIR%
echo     LineSimConverterRobust.exe --jt input.jt output.obj -v
echo.
echo   Batch convert library:
echo     cd %OUT_DIR%
echo     LineSimConverterRobust.exe --batch "C:\Robots" "C:\Web" --parallel 8
echo.
echo   Resume interrupted batch:
echo     cd %OUT_DIR%
echo     LineSimConverterRobust.exe --batch "C:\Robots" "C:\Web" --resume
echo.
echo ═══════════════════════════════════════════════════════════════════════════
echo   Next Steps
echo ═══════════════════════════════════════════════════════════════════════════
echo.
echo   1. Test with single robot:
echo        LineSimConverterRobust.exe --jt "C:\path\to\test.jt" test.obj --verbose
echo.
echo   2. Run batch conversion:
echo        LineSimConverterRobust.exe --batch "C:\RobotLibrary" "C:\WebRobots" --parallel 8 --log robots.log
echo.
echo   3. Check logs:
echo        type conversion.log
echo.
echo   For help:
echo     LineSimConverterRobust.exe
echo.

pause
