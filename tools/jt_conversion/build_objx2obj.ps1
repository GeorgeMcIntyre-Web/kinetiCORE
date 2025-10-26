# Build OBJXtoOBJ.exe - Convert OBJX binary to standard OBJ/MTL

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "Building OBJXtoOBJ.exe"
Write-Host "========================================`n"

$LINESIM = "C:\tmp\LineSimulator"
$CSC = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BUILD_DIR = Join-Path $SCRIPT_DIR "objx2obj_build"

# Check compiler
if (-not (Test-Path $CSC)) {
    Write-Error "C# compiler not found"
    exit 1
}

# Create build directory
Write-Host "[1/5] Creating build directory..."
if (-not (Test-Path $BUILD_DIR)) {
    New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null
}

# Copy required DLLs
Write-Host "[2/5] Copying DLLs..."
Copy-Item "$LINESIM\lib\ObjXFile.dll" $BUILD_DIR -Force
Copy-Item "$LINESIM\lib\LineSimulatorLibrary.dll" $BUILD_DIR -Force
Copy-Item "$LINESIM\lib\SharpDX.dll" $BUILD_DIR -Force
Copy-Item "$LINESIM\lib\SharpDX.Mathematics.dll" $BUILD_DIR -Force

Write-Host "  Copied DLLs successfully"

# Compile
Write-Host "[3/5] Compiling OBJXtoOBJ.cs..."
$sourceFile = Join-Path $BUILD_DIR "OBJXtoOBJ.cs"
$outFile = Join-Path $BUILD_DIR "OBJXtoOBJ.exe"

# Copy latest source from build dir (already edited there)
if (-not (Test-Path $sourceFile)) {
    Write-Error "Source file not found at $sourceFile"
    exit 1
}

& $CSC /target:exe "/out:$outFile" `
    "/reference:$BUILD_DIR\ObjXFile.dll" `
    "/reference:$BUILD_DIR\LineSimulatorLibrary.dll" `
    "/reference:$BUILD_DIR\SharpDX.dll" `
    "/reference:$BUILD_DIR\SharpDX.Mathematics.dll" `
    $sourceFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "Compilation failed"
    exit 1
}

Write-Host "  Compilation successful!`n"

# Test
Write-Host "[4/5] Testing with sample OBJX..."
$testObjx = Join-Path $SCRIPT_DIR "simple_build\test_sample1.objx"
$testObj = Join-Path $BUILD_DIR "test_output.obj"

if (Test-Path $testObjx) {
    & $outFile $testObjx $testObj
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n  Test successful!`n"
    }
}

Write-Host "[5/5] Copying to parent directory..."
Copy-Item $outFile (Join-Path $SCRIPT_DIR "OBJXtoOBJ.exe") -Force
Copy-Item $sourceFile (Join-Path $SCRIPT_DIR "OBJXtoOBJ.cs") -Force

Write-Host "========================================"
Write-Host "BUILD COMPLETE!"
Write-Host "========================================`n"
Write-Host "Executable: $outFile`n"
Write-Host "Usage:"
Write-Host "  OBJXtoOBJ.exe input.objx output.obj`n"
Write-Host "This completes the pipeline: JT → OBJX → OBJ"
Write-Host ""
