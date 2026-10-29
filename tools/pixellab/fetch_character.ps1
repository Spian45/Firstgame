# Wait for a PixelLab character to finish, then download its rotations into art/ren/pixellab/<name>/.
# Uses the PixelLab MCP connection saved in Claude Code's user config (the API key never touches the repo).
#   powershell -File tools/pixellab/fetch_character.ps1 -CharacterId <id> -Name ren
param([Parameter(Mandatory)] [string] $CharacterId, [string] $Name = 'character', [int] $TimeoutSeconds = 900)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\.."
$cfg = Get-Content "$env:USERPROFILE\.claude.json" -Raw | ConvertFrom-Json
$auth = $cfg.mcpServers.pixellab.headers.Authorization
$url = 'https://api.pixellab.ai/mcp'
$h = @{ Authorization = $auth; Accept = 'application/json, text/event-stream' }

function Call($body, $sid) {
    $hh = $h.Clone(); if ($sid) { $hh['Mcp-Session-Id'] = $sid }
    $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $url -Headers $hh -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 20 -Compress)
    $text = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    $data = $text -split "`n" | Where-Object { $_ -like 'data: *' } | Select-Object -Last 1
    if ($data) { $text = $data.Substring(6) }
    return @{ sid = $r.Headers['Mcp-Session-Id']; json = $text }
}
function Tool($name, $arguments) {
    $init = Call @{ jsonrpc = '2.0'; id = 1; method = 'initialize'; params = @{ protocolVersion = '2025-03-26'; capabilities = @{}; clientInfo = @{ name = 'united-realm-tools'; version = '1.0' } } } $null
    Call @{ jsonrpc = '2.0'; method = 'notifications/initialized' } $init.sid | Out-Null
    return (Call @{ jsonrpc = '2.0'; id = 2; method = 'tools/call'; params = @{ name = $name; arguments = $arguments } } $init.sid).json | ConvertFrom-Json
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
do {
    $g = Tool 'get_character' @{ character_id = $CharacterId }
    $text = ($g.result.content | Where-Object type -eq 'text' | ForEach-Object { $_.text }) -join "`n"
    if ($text -notmatch 'status: processing') { break }
    Start-Sleep -Seconds 20
} while ((Get-Date) -lt $deadline)

$out = "$root\art\ren\pixellab\$Name"
New-Item -ItemType Directory -Force $out | Out-Null
$text | Set-Content "$out\character.txt"
# download every PNG link in the description (rotations, previews)
$links = [regex]::Matches($text, 'https://[^\s\)\]"]+\.png[^\s\)\]"]*') | ForEach-Object { $_.Value } | Select-Object -Unique
foreach ($l in $links) {
    $file = ($l -split '[?#]')[0] -split '/' | Select-Object -Last 1
    $dirName = ($l -split '[?#]')[0] -split '/' | Select-Object -Last 2 | Select-Object -First 1
    Invoke-WebRequest -UseBasicParsing -Uri $l -OutFile "$out\$dirName-$file"
}
# and the full zip package if offered
try { Invoke-WebRequest -UseBasicParsing -Uri "https://api.pixellab.ai/mcp/characters/$CharacterId/download" -Headers @{ Authorization = $auth } -OutFile "$out\$Name.zip" } catch { }
Write-Host "status text saved, $($links.Count) images downloaded to $out"
