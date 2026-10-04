<#
.SYNOPSIS
  Builds the client bundle and packages the plugin for every supported server ABI.

.DESCRIPTION
  build.yaml describes the Jellyfin 10.11 build (version must end in .0).
  The Jellyfin 12 build is packaged from a temporary copy of build.yaml with
  targetAbi 12.0.0.0, framework net10.0 and the version's last part set to 1,
  so both builds can live in one manifest (JPRM keys entries by version) and
  a 12.x server always prefers its own build. Always release both together.
#>
param(
    [string]$Output = "artifacts"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    npm --prefix web run build
    if ($LASTEXITCODE) { throw "web build failed" }

    New-Item -ItemType Directory -Force $Output | Out-Null
    $original = Get-Content build.yaml -Raw
    $version = [regex]::Match($original, '(?m)^version:\s*"([^"]+)"').Groups[1].Value
    if (-not $version.EndsWith(".0")) { throw "build.yaml version must end in .0 (got $version)" }
    $version12 = $version.Substring(0, $version.Length - 1) + "1"

    $builds = @(
        @{ Abi = "10.11.0.0"; Framework = "net9.0"; Version = $version },
        @{ Abi = "12.0.0.0"; Framework = "net10.0"; Version = $version12 }
    )

    # JPRM rewrites <Version> in Directory.Build.props; it is restored after each build.
    $originalProps = Get-Content Directory.Build.props -Raw

    foreach ($b in $builds) {
        $yaml = $original `
            -replace '(?m)^targetAbi:.*$', "targetAbi: `"$($b.Abi)`"" `
            -replace '(?m)^framework:.*$', "framework: `"$($b.Framework)`"" `
            -replace '(?m)^version:.*$', "version: `"$($b.Version)`""
        Set-Content build.yaml $yaml -NoNewline
        try {
            # JPRM prints warnings (e.g. no image) on stderr; Windows PowerShell 5.1
            # would turn those into terminating errors, so judge by the exit code only.
            & {
                $ErrorActionPreference = "Continue"
                jprm --verbosity=warning plugin build . --output=$Output 2>&1 | ForEach-Object { "$_" }
            }
            if ($LASTEXITCODE) { throw "jprm failed for ABI $($b.Abi)" }
        } finally {
            Set-Content build.yaml $original -NoNewline
            Set-Content Directory.Build.props $originalProps -NoNewline
        }
    }

    Get-ChildItem $Output -Filter *.zip | Select-Object Name, Length
} finally {
    Pop-Location
}
