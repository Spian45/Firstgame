# One-time setup: make an editable .aseprite file in art/ren/ for every Ren sprite sheet the game uses.
# Existing .aseprite files are left alone (so your edits are never overwritten); delete one to remake it.
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\.."
. "$PSScriptRoot\find_aseprite.ps1"

$sheets = "$root\assets\sprites\ren_pixel"
$art = "$root\art\ren"
New-Item -ItemType Directory -Force $art | Out-Null
$meta = Get-Content "$sheets\ren_sheets.json" -Raw | ConvertFrom-Json

foreach ($png in Get-ChildItem "$sheets\ren_*.png") {
    $name = $png.BaseName                       # ren_attack
    $key = $name -replace '^ren_', ''           # attack
    $out = "$art\$name.aseprite"
    if (Test-Path $out) { Write-Host "keep  $out (already exists)"; continue }
    $m = $meta.$key
    $fps = if ($m) { $m.fps } else { 12 }
    & $aseprite -b --script-param "png=$($png.FullName)" --script-param "out=$out" `
        --script-param "w=74" --script-param "h=65" --script-param "fps=$fps" `
        --script "$PSScriptRoot\import_sheet.lua" | Write-Host   # piping makes PowerShell wait for Aseprite
}
