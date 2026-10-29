# Sets $aseprite to the Aseprite executable: the ASEPRITE environment variable if set, otherwise the
# Steam install (any Steam library folder).
$aseprite = $env:ASEPRITE
if (-not $aseprite -or -not (Test-Path $aseprite)) {
    $steam = 'C:\Program Files (x86)\Steam'
    $libs = @($steam)
    $vdf = "$steam\steamapps\libraryfolders.vdf"
    if (Test-Path $vdf) {
        $libs += (Select-String -Path $vdf -Pattern '"path"\s+"([^"]+)"' -AllMatches).Matches |
            ForEach-Object { $_.Groups[1].Value -replace '\\\\', '\' }
    }
    $aseprite = $libs | Select-Object -Unique |
        ForEach-Object { "$_\steamapps\common\Aseprite\Aseprite.exe" } |
        Where-Object { try { Test-Path $_ } catch { $false } } |
        Select-Object -First 1
}
if (-not $aseprite) {
    throw 'Aseprite not found. Install it from Steam, or set the ASEPRITE environment variable to Aseprite.exe.'
}
