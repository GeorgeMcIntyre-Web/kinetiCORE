@echo off
REM Build LineSimConverter.exe using LineSimulator DLLs
REM
REM This converter reads JT files (using JT Open Toolkit) and PSZ files
REM (Tecnomatix format) and converts them to OBJ+JSON for web viewing.

echo ===============================================================
echo   Building LineSimConverter.exe
echo   JT/PSZ to OBJ Converter for Robot Libraries
echo ===============================================================
echo.

set LINESIM_DIR=C:\tmp\LineSimulator
set LINESIM_CODE_DIR=C:\tmp\LineSimulatorCode
set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe

if not exist "%CSC%" (
    echo ERROR: C# compiler not found at %CSC%
    echo Install .NET Framework 4.8 SDK
    exit /b 1
)

if not exist "%LINESIM_DIR%" (
    echo ERROR: LineSimulator not found at %LINESIM_DIR%
    echo Extract LineSimulator.7z first
    exit /b 1
)

echo Compiler: %CSC%
echo LineSimulator: %LINESIM_DIR%
echo.

REM Copy all required DLLs to output directory
echo [1/3] Copying dependencies...

set OUT_DIR=.\converter_build
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

REM Core LineSimulator DLLs
copy "%LINESIM_DIR%\lib3\JtReader.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib3\Jt951.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib3\JtTk105.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib3\ParaSupt951.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib3\plmxmlAdapterJT60.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib3\plmxmlExtensions.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib3\plmxmlSDK.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib3\psbodyshop.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib3\pskernel.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib3\psxttoolkit.dll" "%OUT_DIR%\" > nul

REM ObjXWriter and dependencies
copy "%LINESIM_DIR%\lib\ObjXWriter.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib\LineSimulatorLibrary.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib\PszReader.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib\ModelDataFile.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib\ObjXFile.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib\JtConfig.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib\CommonLibrary.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib\CommonLibraryNetStandard.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib\SharpDX.dll" "%OUT_DIR%\" > nul
copy "%LINESIM_DIR%\lib\SharpDX.Mathematics.dll" "%OUT_DIR%\" > nul

echo       Done! Copied %ERRORLEVEL% DLL files
echo.

REM Compile LineSimConverter
echo [2/3] Compiling LineSimConverter.cs...

"%CSC%" /target:exe ^
  /out:"%OUT_DIR%\LineSimConverter.exe" ^
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
  LineSimConverter.cs

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Compilation failed!
    exit /b 1
)

echo       Done!
echo.

REM Test the converter
echo [3/3] Testing converter...
echo.

"%OUT_DIR%\LineSimConverter.exe"

echo.
echo ===============================================================
echo   Build Complete!
echo ===============================================================
echo.
echo Executable: %OUT_DIR%\LineSimConverter.exe
echo.
echo Usage:
echo   Convert single JT:
echo     LineSimConverter.exe --jt input.jt output.obj
echo.
echo   Batch convert directory:
echo     LineSimConverter.exe --batch "C:\Robots\KUKA" "C:\WebRobots\KUKA"
echo.
echo All dependencies are in: %OUT_DIR%
echo.

pause
