# Start Chrome with remote debugging enabled for MCP Chrome DevTools
# This allows Cursor to connect to Chrome for debugging

Write-Host "Starting Chrome with remote debugging on port 9222..." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Keep this window open while debugging!" -ForegroundColor Yellow
Write-Host ""

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$tempDir = $env:TEMP

if (Test-Path $chromePath) {
    Start-Process $chromePath -ArgumentList "--remote-debugging-port=9222", "--user-data-dir=$tempDir\chrome-profile-stable"
    Write-Host "Chrome started! You can now use MCP Chrome DevTools in Cursor." -ForegroundColor Green
} else {
    Write-Host "ERROR: Chrome not found at $chromePath" -ForegroundColor Red
    Write-Host "Please update the path in this script or install Chrome." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


