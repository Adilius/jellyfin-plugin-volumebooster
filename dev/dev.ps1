<#
.SYNOPSIS
  Local dev loop: build, install into a disposable Jellyfin container, restart.

.DESCRIPTION
  - Builds the client bundle and the plugin for the chosen server line.
  - Installs the plugin into the dev config's plugins folder (other versions removed).
  - Creates the container on first run, otherwise restarts it.
  - Generates quiet 1 kHz test media (-50 dBFS) in dev/media for loudness checks.

  -Abi 10.11 (default): jellyfin/jellyfin:10.11.11, container jf-dev,    http://localhost:8096, dev/config
  -Abi 12:              jellyfin/jellyfin:12.1.20260915-010956, container jf-dev-12, http://localhost:8097, dev/config-12
  Each line has its own config folder: Jellyfin 12 migrates the database on first start.
  Complete the setup wizard on first run (or let e2e/global-setup.js do it).
#>
param(
    [ValidateSet("10.11", "12")]
    [string]$Abi = "10.11",
    [switch]$Logs
)

$ErrorActionPreference = "Stop"
docker info --format "{{.ServerVersion}}" *> $null
if ($LASTEXITCODE) { throw "Docker engine is not running. Start Docker Desktop and try again." }

$lines = @{
    "10.11" = @{ Image = "jellyfin/jellyfin:10.11.11"; Container = "jf-dev"; Port = 8096; Config = "config"; Framework = "net9.0" }
    "12" = @{ Image = "jellyfin/jellyfin:12.1.20260915-010956"; Container = "jf-dev-12"; Port = 8097; Config = "config-12"; Framework = "net10.0" }
}
$line = $lines[$Abi]

$root = Split-Path -Parent $PSScriptRoot
$dev = Join-Path $root "dev"
$config = Join-Path $dev $line.Config
$plugins = Join-Path $config "plugins"
$media = Join-Path $dev "media"
New-Item -ItemType Directory -Force $plugins, (Join-Path $media "music"), (Join-Path $media "videos") | Out-Null

npm --prefix (Join-Path $root "web") run build
if ($LASTEXITCODE) { throw "web build failed" }
dotnet build (Join-Path $root "Jellyfin.Plugin.VolumeBooster") -c Debug -f $line.Framework --nologo -v quiet
if ($LASTEXITCODE) { throw "plugin build failed" }

$version = [regex]::Match((Get-Content (Join-Path $root "build.yaml") -Raw), '(?m)^version:\s*"([^"]+)"').Groups[1].Value
# Remove other versions of this plugin so the server loads exactly one.
Get-ChildItem $plugins -Directory -Filter "Volume Booster_*" | Where-Object Name -ne "Volume Booster_$version" | Remove-Item -Recurse -Force
$pluginDir = Join-Path $plugins "Volume Booster_$version"
New-Item -ItemType Directory -Force $pluginDir | Out-Null
Copy-Item (Join-Path $root "Jellyfin.Plugin.VolumeBooster\bin\Debug\$($line.Framework)\Jellyfin.Plugin.VolumeBooster.dll") $pluginDir -Force

if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    $tone = Join-Path $media "music\tone-1k-50dB.flac"
    if (-not (Test-Path $tone)) {
        ffmpeg -hide_banner -loglevel error -f lavfi -i "sine=f=1000:d=180" -af volume=-50dB -metadata title="Tone 1kHz -50dBFS" $tone
    }
    $video = Join-Path $media "videos\tone-video.mp4"
    if (-not (Test-Path $video)) {
        ffmpeg -hide_banner -loglevel error -f lavfi -i "testsrc=size=640x360:rate=25:d=180" -f lavfi -i "sine=f=1000:d=180" `
            -af volume=-50dB -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -shortest $video
    }
}

$name = $line.Container
$exists = docker ps -a --filter "name=^$name$" --format "{{.Names}}"
if ($exists) {
    # Recreate the container if the repo moved (its bind mounts point elsewhere).
    # Assign first: Windows PowerShell 5.1 pipes a parsed JSON array as a single object.
    $mounts = docker inspect $name --format '{{json .Mounts}}' | ConvertFrom-Json
    $mounted = ($mounts | Where-Object Destination -eq "/config").Source
    if (-not $mounted -or [IO.Path]::GetFullPath($mounted) -ne [IO.Path]::GetFullPath($config)) {
        Write-Host "$name mounts $mounted; recreating it for $config"
        docker rm -f $name | Out-Null
        $exists = $null
    }
}
if ($exists) {
    docker restart $name | Out-Null
} else {
    docker run -d --name $name -p "$($line.Port):8096" `
        -v "${config}:/config" `
        -v "${media}:/media:ro" `
        $line.Image | Out-Null
}
Write-Host "$name ($($line.Image)) running at http://localhost:$($line.Port)"
if ($Logs) { docker logs -f $name --since 10s }
