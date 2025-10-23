# PowerShell script to kill all running Node.js processes
# Usage: .\kill-nodejs.ps1

Write-Host "Searching for Node.js processes..." -ForegroundColor Yellow

# Get all Node.js processes
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses.Count -eq 0) {
    Write-Host "No Node.js processes found running." -ForegroundColor Green
    exit 0
}

Write-Host "Found $($nodeProcesses.Count) Node.js process(es):" -ForegroundColor Cyan

# Display the processes before killing them
foreach ($process in $nodeProcesses) {
    Write-Host "  PID: $($process.Id) - $($process.ProcessName) - Started: $($process.StartTime)" -ForegroundColor White
}

# Ask for confirmation
$confirmation = Read-Host "`nDo you want to kill all these Node.js processes? (y/N)"

if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
    Write-Host "`nKilling Node.js processes..." -ForegroundColor Red
    
    foreach ($process in $nodeProcesses) {
        try {
            Stop-Process -Id $process.Id -Force
            Write-Host "  [OK] Killed process PID: $($process.Id)" -ForegroundColor Green
        }
        catch {
            Write-Host "  [ERROR] Failed to kill process PID: $($process.Id) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host "`nAll Node.js processes have been terminated." -ForegroundColor Green
} else {
    Write-Host "Operation cancelled. No processes were killed." -ForegroundColor Yellow
}

