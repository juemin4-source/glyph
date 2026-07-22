# zhimengji auto-backup — runs via Windows Task Scheduler every 10 min
$repo = "G:/AI/Chancellor-OS-Lab/projects/zhimengji"
$log = "$repo/scripts/auto-backup.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
  cd $repo
  $status = git status --short
  if ($status) {
    git add -A 2>> $log
    git commit -m "auto-backup $timestamp" 2>> $log
    git push origin main 2>> $log
    Add-Content $log "[$timestamp] Auto-backup completed: $($status -split "`n" | Measure-Object | Select-Object -ExpandProperty Count) files"
  }
} catch {
  Add-Content $log "[$timestamp] ERROR: $_"
}
