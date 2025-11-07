param(
  [string]$JsonPath = "$PSScriptRoot/../../kinetiCORE_data/Tooling/9X_110_GEO.json"
)

Write-Host "Analyzing GLB-like scene structure (synthetic from JSON paths)..."
node "$PSScriptRoot/../headless/AnalyzeScene.mjs" --json "$JsonPath"
exit $LASTEXITCODE





