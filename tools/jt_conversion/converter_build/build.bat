@echo off
REM Simple build script for LineSimConverter

set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe

echo Building LineSimConverter.exe...

"%CSC%" ^
  /target:exe ^
  /out:LineSimConverter.exe ^
  /reference:JtReader.dll ^
  /reference:LineSimulatorLibrary.dll ^
  /reference:PszReader.dll ^
  /reference:ObjXWriter.dll ^
  /reference:ModelDataFile.dll ^
  /reference:ObjXFile.dll ^
  LineSimConverter.cs

if %ERRORLEVEL% EQU 0 (
  echo Build successful!
  echo Testing...
  LineSimConverter.exe
) else (
  echo Build failed!
  exit /b 1
)
