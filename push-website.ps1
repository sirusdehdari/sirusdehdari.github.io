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
    Read-Host "Press Enter to close"
    exit
}

Write-Host ""
Write-Host "Staging all changes..." -ForegroundColor Cyan
git add -A

Write-Host "Committing..." -ForegroundColor Cyan
git commit -m "update website"

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Read-Host "Press Enter to close"
