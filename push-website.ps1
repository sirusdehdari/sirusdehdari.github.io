# Commits and pushes any changes in the Website repo to GitHub.
# Run this after you've edited index.html, styles.css, added pages, etc.
#
# Usage: double-click push-website.bat (which calls this script), or
# from PowerShell:
#   cd "C:\Users\tuf_d\Dropbox\Sirus\Website"
#   .\push-website.ps1

$WebsiteRoot = "C:\Users\tuf_d\Dropbox\Sirus\Website"
Set-Location $WebsiteRoot

Write-Host "Checking for changes..." -ForegroundColor Cyan
git status --short

$changes = git status --porcelain
if (-not $changes) {
    Write-Host ""
    Write-Host "No changes to commit -- nothing to push." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    exit
}

Write-Host ""
Write-Host "Staging all changes..." -ForegroundColor Cyan
git add -A

Write-Host "Committing..." -ForegroundColor Cyan
git commit -m "update website"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "FAILED: git commit exited with code $LASTEXITCODE." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "FAILED: git push exited with code $LASTEXITCODE." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host ""
Write-Host "Done. Closing..." -ForegroundColor Green
Start-Sleep -Seconds 2
