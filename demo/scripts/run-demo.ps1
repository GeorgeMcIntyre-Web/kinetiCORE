param(
  [string]$JsonPath = "$PSScriptRoot/../../kinetiCORE_data/Tooling/9X_110_GEO.json",
  [string]$OutDir = "$PSScriptRoot/../../out"
)

Write-Host "Running kinematic demo (headless)..."
if (!(Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

# Prefer pure Node.js runner (no ts-node) for reliability
node "$PSScriptRoot/../headless/TestRunner.mjs" --json "$JsonPath" --out "$OutDir"

exit $LASTEXITCODE


