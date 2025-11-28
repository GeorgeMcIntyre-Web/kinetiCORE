@echo off
REM Start Chrome with remote debugging enabled for MCP Chrome DevTools
REM This allows Cursor to connect to Chrome for debugging

echo Starting Chrome with remote debugging on port 9222...
echo.
echo IMPORTANT: Keep this window open while debugging!
echo.

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-profile-stable"

echo.
echo Chrome started! You can now use MCP Chrome DevTools in Cursor.
echo.
pause



