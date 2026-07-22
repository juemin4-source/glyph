<#
.SYNOPSIS
  织梦机 tauri-driver E2E 运行器
.DESCRIPTION
  1. 构建 Tauri 应用 (npm run tauri build)
  2. 启动 tauri-driver (后台)
  3. 等待 port 4444 就绪
  4. 运行 Playwright --project=tauri
  5. 清理 tauri-driver 进程
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $ProjectRoot

Write-Host "=== 织梦机 tauri-driver E2E ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: 构建 Tauri 应用 ──
Write-Host "[1/4] 构建 Tauri 应用..." -ForegroundColor Yellow
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tauri 构建失败，退出" -ForegroundColor Red
    exit 1
}
Write-Host "Tauri 构建完成" -ForegroundColor Green
Write-Host ""

# ── Step 2: 启动 tauri-driver ──
Write-Host "[2/4] 启动 tauri-driver (port 4444)..." -ForegroundColor Yellow
$tauriDriver = Start-Process -FilePath "tauri-driver" -PassThru -NoNewWindow
Start-Sleep -Seconds 3

try {
    # 验证端口
    $portCheck = Get-NetTCPConnection -LocalPort 4444 -ErrorAction SilentlyContinue
    if (-not $portCheck) {
        Write-Host "等待 tauri-driver 就绪..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }

    Write-Host "tauri-driver 已启动 (PID: $($tauriDriver.Id))" -ForegroundColor Green
    Write-Host ""

    # ── Step 3: 等待 Tauri 应用窗口 ──
    Write-Host "[3/4] 等待 Tauri 应用窗口就绪..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    # ── Step 4: 运行 Playwright tauri 测试 ──
    Write-Host "[4/4] 运行 Playwright --project=tauri..." -ForegroundColor Yellow
    npx playwright test --project=tauri
    $testExit = $LASTEXITCODE
    Write-Host ""

    if ($testExit -eq 0) {
        Write-Host "=== 全部 tauri E2E 测试通过 ===" -ForegroundColor Green
    } else {
        Write-Host "=== 部分 tauri E2E 测试失败 (exit code: $testExit) ===" -ForegroundColor Red
    }
} finally {
    # ── 清理 tauri-driver ──
    Write-Host "清理 tauri-driver (PID: $($tauriDriver.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $tauriDriver.Id -Force -ErrorAction SilentlyContinue
    # 确保所有相关进程被清理
    Get-Process -Name "tauri-driver" -ErrorAction SilentlyContinue | Stop-Process -Force
}

exit $testExit
