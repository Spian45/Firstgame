# Queue template animations for a PixelLab character one at a time (the trial plan allows one running job),
# then download every animation's frames into art/ren/pixellab/<Name>/<animation>/frame_NN.png.
#   powershell -File tools/pixellab/animate_queue.ps1 -CharacterId <id> -Name ren_v2 -Mode skeleton-v3 `
#       -Animations running-8-frames=run,jumping-1=jump
# Mode: 'template' redraws every frame (cheap, but the look drifts); 'skeleton-v3' moves the character
# itself, which keeps her look, colours and size consistent.
param(
    [Parameter(Mandatory)] [string] $CharacterId,
    [string] $Name = 'character',
    [string[]] $Animations = @(),   # template=name pairs; may be empty to just download
    [string] $Mode = 'skeleton-v3',
    [string] $Direction = 'east'
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\.."
. "$PSScriptRoot\pixellab.ps1"

foreach ($pair in $Animations) {
    $template, $animName = $pair -split '=', 2
    while ($true) {
        $r = Invoke-PixelLab 'animate_character' @{ character_id = $CharacterId; template_animation_id = $template; animation_name = $animName; directions = @($Direction); mode = $Mode }
        if ($r -notmatch 'job slots') {
            Write-Host "queued $animName ($template, $Mode): $((($r -split "`n") | Where-Object { $_ -match '^cost|error' }) -join ' ')"
            break
        }
        Invoke-PixelLab 'wait_for_jobs' @{ timeout_seconds = 240 } | Out-Null
    }
}
# wait for everything still running
for ($i = 0; $i -lt 10; $i++) {
    $w = Invoke-PixelLab 'wait_for_jobs' @{ timeout_seconds = 240 }
    if ($w -notmatch 'still running') { break }
}

$info = Invoke-PixelLab 'get_character' @{ character_id = $CharacterId }
$out = "$root\art\ren\pixellab\$Name"
New-Item -ItemType Directory -Force $out | Out-Null
$info | Set-Content "$out\character.txt"
# animation lines look like:   <name> - 1 dir (east), 8f ...  (the dash is a long dash in the reply)   then   east: https://.../{i}.png?t=... (i=0..7)
$current = $null
$count = 0
foreach ($line in $info -split "`n") {
    if ($line -match '^\s{2}(\S+) \S+ \d+ dirs?\b') { $current = $Matches[1]; continue }   # '  <name> - 1 dir (east), 8f'
    if ($current -and $line -match '^\s+(\w[\w-]*): (https://\S+\{i\}\.png\S*) \(i=0\.\.(\d+)\)') {
        $dir = $Matches[1]; $tpl = $Matches[2]; $last = [int]$Matches[3]
        $folder = "$out\$current"
        New-Item -ItemType Directory -Force $folder | Out-Null
        for ($i = 0; $i -le $last; $i++) {
            Invoke-WebRequest -UseBasicParsing -Uri ($tpl -replace '\{i\}', $i) -OutFile ("$folder\frame_{0:D2}.png" -f $i)
            $count++
        }
    }
}
Write-Host "$count animation frames downloaded to $out"
