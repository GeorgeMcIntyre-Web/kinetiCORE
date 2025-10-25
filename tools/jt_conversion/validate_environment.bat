@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM   Environment Validation Script
REM   Checks all prerequisites for JT/PSZ conversion pipeline
REM ═══════════════════════════════════════════════════════════════════════════

echo.
echo ═══════════════════════════════════════════════════════════════════════════
echo   JT/PSZ Conversion Pipeline - Environment Validation
echo ═══════════════════════════════════════════════════════════════════════════
echo.

set PASS_COUNT=0
set FAIL_COUNT=0

REM ═══════════════════════════════════════════════════════════════════════════
REM Check .NET Framework
REM ═══════════════════════════════════════════════════════════════════════════

echo [1/5] .NET Framework
reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release >nul 2>&1
if errorlevel 1 (
    echo       ✗ .NET Framework 4.x not found
    echo       Install from: https://dotnet.microsoft.com/download/dotnet-framework
    set /a FAIL_COUNT+=1
) else (
    for /f "tokens=3" %%v in ('reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release ^| findstr Release') do (
        if %%v GEQ 528040 (
            echo       ✓ .NET Framework 4.8+ installed
            set /a PASS_COUNT+=1
        ) else (
            echo       ⚠ .NET Framework version too old
            echo       Upgrade to 4.8+
            set /a FAIL_COUNT+=1
        )
    )
)

REM ═══════════════════════════════════════════════════════════════════════════
REM Check C# Compiler
REM ═══════════════════════════════════════════════════════════════════════════

echo [2/5] C# Compiler
where csc.exe >nul 2>&1
if errorlevel 1 (
    if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
        echo       ✓ Found: C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
        set /a PASS_COUNT+=1
    ) else (
        echo       ✗ C# compiler not found
        echo       Install Visual Studio Build Tools
        set /a FAIL_COUNT+=1
    )
) else (
    for /f "tokens=*" %%p in ('where csc.exe') do (
        echo       ✓ Found: %%p
        set /a PASS_COUNT+=1
        goto :csc_found
    )
)
:csc_found

REM ═══════════════════════════════════════════════════════════════════════════
REM Check LineSimulator
REM ═══════════════════════════════════════════════════════════════════════════

echo [3/5] LineSimulator Installation
set LINESIM_DIR=C:\tmp\LineSimulator

if not exist "%LINESIM_DIR%" (
    echo       ✗ LineSimulator directory not found
    echo       Expected: %LINESIM_DIR%
    echo       Extract LineSimulator.7z first
    set /a FAIL_COUNT+=1
    goto :skip_dll_check
)

echo       ✓ Directory found: %LINESIM_DIR%
set /a PASS_COUNT+=1

REM ═══════════════════════════════════════════════════════════════════════════
REM Check Required DLLs
REM ═══════════════════════════════════════════════════════════════════════════

echo [4/5] Required DLLs

set DLL_COUNT=0
set DLL_MISSING=0

REM Critical DLLs
for %%d in (
    "lib3\JtReader.dll"
    "lib3\Jt951.dll"
    "lib3\JtTk105.dll"
    "lib3\pskernel.dll"
    "lib\ObjXWriter.dll"
    "lib\PszReader.dll"
    "lib\ModelDataFile.dll"
    "lib\LineSimulatorLibrary.dll"
) do (
    set /a DLL_COUNT+=1
    if exist "%LINESIM_DIR%\%%~d" (
        for %%s in ("%LINESIM_DIR%\%%~d") do (
            set SIZE=%%~zs
            set /a SIZE_KB=!SIZE! / 1024
            if !SIZE_KB! LSS 1 (
                set SIZE_DISPLAY=!SIZE! bytes
            ) else (
                set SIZE_DISPLAY=!SIZE_KB! KB
            )
            echo       ✓ %%~d (!SIZE_DISPLAY!)
        )
        set /a PASS_COUNT+=1
    ) else (
        echo       ✗ MISSING: %%~d
        set /a DLL_MISSING+=1
        set /a FAIL_COUNT+=1
    )
)

if %DLL_MISSING% GTR 0 (
    echo.
    echo       [WARNING] %DLL_MISSING% DLL(s) missing!
)

:skip_dll_check

REM ═══════════════════════════════════════════════════════════════════════════
REM Check Disk Space
REM ═══════════════════════════════════════════════════════════════════════════

echo [5/5] System Resources

REM Check available disk space on C:
for /f "tokens=3" %%s in ('dir /-C C:\ ^| findstr /C:"bytes free"') do (
    set BYTES_FREE=%%s
)

REM Simple check if > 10GB free (10737418240 bytes)
if %BYTES_FREE% GTR 10737418240 (
    set /a GB_FREE=%BYTES_FREE% / 1073741824
    echo       ✓ Disk space: ~!GB_FREE! GB free on C:
    set /a PASS_COUNT+=1
) else (
    set /a GB_FREE=%BYTES_FREE% / 1073741824
    echo       ⚠ Disk space: Only ~!GB_FREE! GB free on C:
    echo       Recommend 50+ GB for robot library conversion
    set /a FAIL_COUNT+=1
)

REM Check RAM
for /f "tokens=4" %%m in ('systeminfo ^| findstr /C:"Total Physical Memory"') do (
    set RAM_MB=%%m
)
echo       ✓ RAM: %RAM_MB% MB

REM ═══════════════════════════════════════════════════════════════════════════
REM Final Summary
REM ═══════════════════════════════════════════════════════════════════════════

echo.
echo ═══════════════════════════════════════════════════════════════════════════
echo   Validation Summary
echo ═══════════════════════════════════════════════════════════════════════════
echo.
echo   Passed:  %PASS_COUNT%
echo   Failed:  %FAIL_COUNT%
echo.

if %FAIL_COUNT% EQU 0 (
    echo   ✓✓✓ ALL CHECKS PASSED ✓✓✓
    echo.
    echo   Your environment is ready for JT/PSZ conversion!
    echo.
    echo   Next steps:
    echo     1. Run: build_converter_robust.bat
    echo     2. Test: LineSimConverterRobust.exe --jt test.jt test.obj
    echo     3. Batch: LineSimConverterRobust.exe --batch C:\Robots C:\Output
    echo.
    exit /b 0
) else (
    echo   ✗✗✗ VALIDATION FAILED ✗✗✗
    echo.
    echo   Please fix the issues above before proceeding.
    echo.
    echo   Common fixes:
    echo     - Extract LineSimulator.7z to C:\tmp\LineSimulator
    echo     - Install .NET Framework 4.8 SDK
    echo     - Free up disk space (delete temp files)
    echo.
    exit /b 1
)
