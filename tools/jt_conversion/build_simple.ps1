# Build SimpleJTtoOBJ.exe using PowerShell

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "Building SimpleJTtoOBJ.exe"
Write-Host "========================================`n"

# Set paths
$LINESIM = "C:\tmp\LineSimulator"
$CSC = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BUILD_DIR = Join-Path $SCRIPT_DIR "simple_build"

# Check compiler
if (-not (Test-Path $CSC)) {
    Write-Error "C# compiler not found at $CSC"
    exit 1
}

# Check LineSimulator
if (-not (Test-Path "$LINESIM\lib3\JtReader.dll")) {
    Write-Error "LineSimulator not found at $LINESIM"
    exit 1
}

# Create build directory
Write-Host "[1/4] Creating build directory..."
if (-not (Test-Path $BUILD_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null
}

# Copy required DLLs
Write-Host "[2/4] Copying LineSimulator DLLs..."
# Copy ALL DLLs from LineSimulator to avoid missing dependencies
Write-Host "  Copying lib3 DLLs..."
Copy-Item "$LINESIM\lib3\*.dll" $BUILD_DIR -Force -ErrorAction SilentlyContinue
Write-Host "  Copying lib DLLs..."
Copy-Item "$LINESIM\lib\*.dll" $BUILD_DIR -Force -ErrorAction SilentlyContinue

Write-Host "  Copied DLLs successfully"

# Copy source
Copy-Item (Join-Path $SCRIPT_DIR "SimpleJTtoOBJ.cs") $BUILD_DIR -Force

# Compile
Write-Host "[3/4] Compiling SimpleJTtoOBJ.cs..."
$sourceFile = Join-Path $BUILD_DIR "SimpleJTtoOBJ.cs"
$outFile = Join-Path $BUILD_DIR "SimpleJTtoOBJ.exe"
$jtReaderDll = Join-Path $BUILD_DIR "JtReader.dll"
$objxWriterDll = Join-Path $BUILD_DIR "ObjXWriter.dll"

# Reference only .NET managed DLLs (skip native DLLs like 7z.dll, Jt951.dll, etc.)
$managedDlls = @(
    "JtReader.dll",
    "ObjXWriter.dll",
    "ObjXFile.dll",
    "LineSimulatorLibrary.dll",
    "ModelDataFile.dll",
    "CommonLibrary.dll",
    "CommonLibraryNetStandard.dll",
    "FunctionEvaluator.dll",
    "JtConfig.dll",
    "PszReader.dll",
    "SharpDX.dll",
    "SharpDX.Mathematics.dll",
    "Newtonsoft.Json.dll"
)

$refs = $managedDlls | ForEach-Object {
    $dll = Join-Path $BUILD_DIR $_
    if (Test-Path $dll) { "/reference:$dll" }
}

Write-Host "  Referencing $($refs.Count) managed DLLs..."

& $CSC /target:exe "/out:$outFile" $refs $sourceFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "Compilation failed"
    exit 1
}

Write-Host "  Compilation successful!`n"

# Test
Write-Host "[4/4] Testing executable..."
& $outFile 2>$null
if ($LASTEXITCODE -eq 1) {
    Write-Host "  Test passed - shows usage message`n"
}

Write-Host "========================================"
Write-Host "BUILD COMPLETE!"
Write-Host "========================================`n"
Write-Host "Executable: $outFile`n"
Write-Host "Usage:"
Write-Host "  SimpleJTtoOBJ.exe input.jt output.obj`n"
Write-Host "Ready to test!`n"
