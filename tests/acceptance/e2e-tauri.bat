@echo off
REM v2.0 Golden Path E2E — 真实 Tauri 后端
REM 1. 启动 Tauri 应用（带 CDP debug 端口）
REM 2. Playwright 通过 CDP 连接真实窗口
REM 3. 运行完整五画板管线测试

echo === v2.0 Golden Path E2E ===
echo 正在启动 Tauri 应用（debug 端口 9222）...

cd /d "%~dp0..\.."

REM Kill any existing Tauri process
taskkill /f /im "zhimengji.exe" 2>nul
timeout /t 2 /nobreak >nul

REM Start Tauri with CDP debugging
set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
start "zhimengji-e2e" cmd /c "npm run tauri dev"

echo 等待 Tauri 窗口就绪...
timeout /t 15 /nobreak >nul

echo 运行 Playwright CDP 测试...
npx playwright test e2e/cdp-real.spec.ts --headed

echo === 测试完成 ===
pause
