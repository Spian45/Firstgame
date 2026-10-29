# Call one PixelLab MCP tool from PowerShell, using the connection saved in Claude Code's user config
# (the API key stays out of the repo). Prints the tool's text output.
#   . tools/pixellab/pixellab.ps1; Invoke-PixelLab 'get_balance' @{}
$script:pixellabCfg = Get-Content "$env:USERPROFILE\.claude.json" -Raw | ConvertFrom-Json
$script:pixellabAuth = $script:pixellabCfg.mcpServers.pixellab.headers.Authorization

function Send-PixelLab($body, $sid) {
    $h = @{ Authorization = $script:pixellabAuth; Accept = 'application/json, text/event-stream' }
    if ($sid) { $h['Mcp-Session-Id'] = $sid }
    $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'https://api.pixellab.ai/mcp' -Headers $h -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 20 -Compress)
    $text = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    $data = $text -split "`n" | Where-Object { $_ -like 'data: *' } | Select-Object -Last 1
    if ($data) { $text = $data.Substring(6) }
    return @{ sid = $r.Headers['Mcp-Session-Id']; json = $text }
}

function Invoke-PixelLab([string] $Name, [hashtable] $Arguments) {
    $init = Send-PixelLab @{ jsonrpc = '2.0'; id = 1; method = 'initialize'; params = @{ protocolVersion = '2025-03-26'; capabilities = @{}; clientInfo = @{ name = 'united-realm-tools'; version = '1.0' } } } $null
    Send-PixelLab @{ jsonrpc = '2.0'; method = 'notifications/initialized' } $init.sid | Out-Null
    $res = (Send-PixelLab @{ jsonrpc = '2.0'; id = 2; method = 'tools/call'; params = @{ name = $Name; arguments = $Arguments } } $init.sid).json | ConvertFrom-Json
    if ($res.error) { return "ERROR: " + ($res.error | ConvertTo-Json -Depth 5) }
    return ($res.result.content | Where-Object type -eq 'text' | ForEach-Object { $_.text }) -join "`n"
}
