# git-autosave.ps1 — Windows equivalent of git-safety autosave
# Runs as a background job: every 10 minutes, auto-commit if there are changes.
# Start:  powershell.exe -NoProfile -File <this-script>
# 
# Note: This script idles with while loop. It is meant to be launched
# manually when working, or set up as a Windows Scheduled Task for persistence.

$repo = "G:\AI\Chancellor-OS-Lab\projects\zhimengji"
$parentRepo = "G:\AI\Chancellor-OS-Lab"
$logFile = "$repo\scripts\autosave.log"
$interval = 600  # 10 minutes

while ($true) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  try {
    # --- zhimengji repo ---
    Set-Location $repo
    $status = git status --porcelain 2>$null
    if ($status) {
      git add -A 2>> $logFile
      git commit -m "autosave $timestamp" 2>> $logFile
      # Push silently (best-effort)
      git push origin main 2>> $logFile
      $count = ($status -split "`n" | Measure-Object | Select-Object -ExpandProperty Count)
      Add-Content $logFile "[$timestamp] autosave committed: $count files"
    }

    # --- parent repo submodule update ---
    Set-Location $parentRepo
    $parentStatus = git status --porcelain projects/zhimengji 2>$null
    if ($parentStatus) {
      git add projects/zhimengji 2>> $logFile
      git commit -m "autosave: update zhimengji submodule $timestamp" 2>> $logFile
      Add-Content $logFile "[$timestamp] parent submodule updated"
    }
  }
  catch {
    Add-Content $logFile "[$timestamp] ERROR: $_"
  }
  Start-Sleep -Seconds $interval
}
