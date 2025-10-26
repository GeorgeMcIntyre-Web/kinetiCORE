# Build DirectJTtoOBJ.exe - Direct JT to standard OBJ converter

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "Building DirectJTtoOBJ.exe"
Write-Host "========================================`n"

$LINESIM = "C:\tmp\LineSimulator"
$CSC = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BUILD_DIR = Join-Path $SCRIPT_DIR "direct_build"

# Check compiler
if (-not (Test-Path $CSC)) {
    Write-Error "C# compiler not found"
    exit 1
}

# Create build directory
Write-Host "[1/4] Creating build directory..."
if (-not (Test-Path $BUILD_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null
}

# Copy JT Open Toolkit DLLs (only what's needed)
Write-Host "[2/4] Copying JT Open Toolkit DLLs..."
Copy-Item "$LINESIM\lib3\JtReader.dll" $BUILD_DIR -Force
Copy-Item "$LINESIM\lib3\Jt951.dll" $BUILD_DIR -Force
Copy-Item "$LINESIM\lib3\JtTk105.dll" $BUILD_DIR -Force
Copy-Item "$LINESIM\lib3\pskernel.dll" $BUILD_DIR -Force

Write-Host "  Copied DLLs successfully"

# Copy source
Copy-Item (Join-Path $SCRIPT_DIR "DirectJTtoOBJ.cs") $BUILD_DIR -Force

# Compile
Write-Host "[3/4] Compiling DirectJTtoOBJ.cs..."
$sourceFile = Join-Path $BUILD_DIR "DirectJTtoOBJ.cs"
$outFile = Join-Path $BUILD_DIR "DirectJTtoOBJ.exe"
$jtReaderDll = Join-Path $BUILD_DIR "JtReader.dll"

& $CSC /target:exe "/out:$outFile" "/reference:$jtReaderDll" $sourceFile

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
Write-Host "  DirectJTtoOBJ.exe input.jt output.obj`n"
Write-Host "This converter outputs standard OBJ/MTL files!"
Write-Host ""
