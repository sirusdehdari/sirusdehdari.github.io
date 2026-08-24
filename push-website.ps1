# Commits and pushes any changes in the Website repo to GitHub.
# Run this after you've edited index.html, styles.css, added pages, etc.
#
# Usage: double-click push-website.bat (which calls this script), or
# from PowerShell:
#   cd "C:\Users\tuf_d\Dropbox\Sirus\Website"
#   .\push-website.ps1

$WebsiteRoot = "C:\Users\tuf_d\Dropbox\Sirus\Website"
Set-Location $WebsiteRoot

# The repo lives inside Dropbox, which can briefly hold a lock on files
# under .git/ (the index, a fresh object, etc.) while it's mid-sync --
# that can make a git command fail right when it's run. Retrying a few
# times rides out that transient window instead of failing the whole
# push over it. Output is captured so a REAL (non-lock) failure still
# shows git's actual error text, not just an exit code.
function Invoke-GitWithRetry {
    param([string[]]$GitArgs, [int]$MaxAttempts = 5, [int]$DelayMs = 500)
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        $output = & git @GitArgs 2>&1
        if ($LASTEXITCODE -eq 0) {
            if ($output) { Write-Host ($output -join "`n") }
            return
        }
        if ($i -eq $MaxAttempts) {
            if ($output) { Write-Host ($output -join "`n") -ForegroundColor Red }
            throw "git $($GitArgs -join ' ') exited with code $LASTEXITCODE"
        }
        Write-Host "  (retrying 'git $($GitArgs -join ' ')' after: $($output -join ' '))" -ForegroundColor DarkYellow
        Start-Sleep -Milliseconds $DelayMs
    }
}

Write-Host "Checking for changes..." -ForegroundColor Cyan
git status --short

$changes = git status --porcelain
if (-not $changes) {
    Write-Host ""
    Write-Host "No changes to commit -- nothing to push." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    exit
}

try {
    Write-Host ""
    Write-Host "Staging all changes..." -ForegroundColor Cyan
    Invoke-GitWithRetry -GitArgs @("add", "-A")

    Write-Host "Committing..." -ForegroundColor Cyan
    Invoke-GitWithRetry -GitArgs @("commit", "-m", "update website")

    Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
    Invoke-GitWithRetry -GitArgs @("push")
} catch {
    Write-Host ""
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host ""
Write-Host "Done. Closing..." -ForegroundColor Green
Start-Sleep -Seconds 2
