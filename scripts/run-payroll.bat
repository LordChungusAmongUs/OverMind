@echo off
taskkill /F /IM chrome.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --restore-last-session --new-window "https://overmind-dashboard.vercel.app/restaurant/payroll?autostart=1"
