# Export every art/ren/*.aseprite to the game's sprite sheets (assets/sprites/ren_pixel/<name>.png):
# all frames in one horizontal strip, visible layers merged. The game reads the frame count from the
# strip's width, so adding or removing frames needs no code change. Frame timing (fps) stays in
# src/character.js; this prints each animation's Aseprite timing so you can match it there.
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\.."
. "$PSScriptRoot\find_aseprite.ps1"

$sheets = "$root\assets\sprites\ren_pixel"
$files = Get-ChildItem "$root\art\ren\*.aseprite"
if (-not $files) { Write-Host 'No .aseprite files in art/ren. Run tools/aseprite/make_sources.ps1 first.'; exit 1 }

foreach ($f in $files) {
    $png = "$sheets\$($f.BaseName).png"
    $json = "$env:TEMP\$($f.BaseName).json"
    & $aseprite -b $f.FullName --sheet $png --sheet-type horizontal --format json-array --data $json --list-tags | Out-Null
    $data = Get-Content $json -Raw | ConvertFrom-Json
    $frames = $data.frames.Count
    $ms = ($data.frames | Measure-Object -Property duration -Average).Average
    Remove-Item $json
    Write-Host ("exported {0,-14} {1,3} frames  ~{2} fps" -f $f.BaseName, $frames, [math]::Round(1000 / $ms))
}
Write-Host 'Done. Refresh the game in the browser to see the changes.'
