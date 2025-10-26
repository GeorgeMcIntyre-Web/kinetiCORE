@echo off
REM Build SimpleJTtoOBJ.exe using LineSimulator DLLs

setlocal

echo ========================================
echo Building SimpleJTtoOBJ.exe
echo ========================================
echo.

REM Set paths
set LINESIM=C:\tmp\LineSimulator
set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
set BUILD_DIR=%~dp0simple_build

REM Check compiler exists
if not exist "%CSC%" (
    echo ERROR: C# compiler not found at %CSC%
    exit /b 1
)

REM Check LineSimulator exists
if not exist "%LINESIM%\lib3\JtReader.dll" (
    echo ERROR: LineSimulator not found at %LINESIM%
    exit /b 1
)

REM Create build directory
echo [1/4] Creating build directory...
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"

REM Copy required DLLs
echo [2/4] Copying LineSimulator DLLs...

REM JT Open Toolkit (lib3)
copy /Y "%LINESIM%\lib3\JtReader.dll" "%BUILD_DIR%\" >nul
copy /Y "%LINESIM%\lib3\Jt951.dll" "%BUILD_DIR%\" >nul
copy /Y "%LINESIM%\lib3\JtTk105.dll" "%BUILD_DIR%\" >nul
copy /Y "%LINESIM%\lib3\pskernel.dll" "%BUILD_DIR%\" >nul

REM LineSimulator libraries (lib)
copy /Y "%LINESIM%\lib\ObjXWriter.dll" "%BUILD_DIR%\" >nul
copy /Y "%LINESIM%\lib\ObjXFile.dll" "%BUILD_DIR%\" >nul

REM Additional dependencies
copy /Y "%LINESIM%\lib\SharpDX.dll" "%BUILD_DIR%\" >nul 2>nul
copy /Y "%LINESIM%\lib\SharpDX.Mathematics.dll" "%BUILD_DIR%\" >nul 2>nul

echo   Copied DLLs successfully

REM Copy source file
copy /Y "%~dp0SimpleJTtoOBJ.cs" "%BUILD_DIR%\" >nul

REM Compile
echo [3/4] Compiling SimpleJTtoOBJ.cs...
"%CSC%" /target:exe /out:"%BUILD_DIR%\SimpleJTtoOBJ.exe" /reference:"%BUILD_DIR%\JtReader.dll" /reference:"%BUILD_DIR%\ObjXWriter.dll" "%BUILD_DIR%\SimpleJTtoOBJ.cs"

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Compilation failed
    exit /b 1
)

echo   Compilation successful!

REM Test executable
echo [4/4] Testing executable...
"%BUILD_DIR%\SimpleJTtoOBJ.exe" >nul 2>&1
if %ERRORLEVEL% EQU 1 (
    echo   Test passed - shows usage message
) else (
    echo   WARNING: Unexpected return code
)

echo.
echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo.
echo Executable: %BUILD_DIR%\SimpleJTtoOBJ.exe
echo.
echo Usage:
echo   SimpleJTtoOBJ.exe input.jt output.obj
echo.
echo Ready to test with:
echo   cd %BUILD_DIR%
echo   SimpleJTtoOBJ.exe "C:\path\to\file.jt" "output.obj"
echo.

endlocal
