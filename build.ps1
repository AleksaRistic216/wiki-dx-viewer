# Build script for wiki-dx-viewer Tauri app (Windows)
# Usage: .\build.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SrcDir = Join-Path $ScriptDir "src"
$TauriDir = Join-Path $ScriptDir "src-tauri"
$ResourcesDir = Join-Path $TauriDir "resources"
$NodeVersion = "20.18.1"

Write-Host "==> Building Wiki DX Viewer for Windows" -ForegroundColor Cyan
Write-Host "==> Node.js version: $NodeVersion"

# Download and extract Node.js
function Setup-Node {
    $nodeDir = Join-Path $ResourcesDir "node"
    if (Test-Path (Join-Path $nodeDir "node.exe")) {
        Write-Host "==> Node.js already downloaded, skipping"
        return
    }

    $url = "https://nodejs.org/dist/v${NodeVersion}/node-v${NodeVersion}-win-x64.zip"
    $tmpDir = Join-Path $env:TEMP "wiki-dx-node-$(Get-Random)"
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    Write-Host "==> Downloading Node.js from $url"
    Invoke-WebRequest -Uri $url -OutFile "$tmpDir\node.zip" -UseBasicParsing

    Write-Host "==> Extracting Node.js"
    Expand-Archive -Path "$tmpDir\node.zip" -DestinationPath $tmpDir -Force

    New-Item -ItemType Directory -Path $nodeDir -Force | Out-Null
    Copy-Item "$tmpDir\node-v${NodeVersion}-win-x64\node.exe" -Destination $nodeDir

    Remove-Item -Recurse -Force $tmpDir
    Write-Host "==> Node.js extracted to $nodeDir"
}

# Build Next.js standalone
function Build-NextJS {
    Write-Host "==> Installing npm dependencies"
    Push-Location $SrcDir
    npm install --silent

    Write-Host "==> Building Next.js (standalone mode)"
    npm run build

    $serverDir = Join-Path $ResourcesDir "server"
    if (Test-Path $serverDir) {
        Remove-Item -Recurse -Force $serverDir
    }
    New-Item -ItemType Directory -Path $serverDir -Force | Out-Null

    Write-Host "==> Copying standalone server to resources"
    $standalonePath = Join-Path $SrcDir ".next\standalone"
    # Use robocopy for reliable copying including dot-directories
    robocopy "$standalonePath" "$serverDir" /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null

    # Copy static assets (not included in standalone output)
    $staticPath = Join-Path $SrcDir ".next\static"
    if (Test-Path $staticPath) {
        $destStatic = Join-Path $serverDir ".next\static"
        New-Item -ItemType Directory -Path $destStatic -Force | Out-Null
        robocopy "$staticPath" "$destStatic" /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    }

    # Copy public folder
    $publicPath = Join-Path $SrcDir "public"
    if (Test-Path $publicPath) {
        $destPublic = Join-Path $serverDir "public"
        New-Item -ItemType Directory -Path $destPublic -Force | Out-Null
        Copy-Item -Path "$publicPath\*" -Destination $destPublic -Recurse -Force
    }

    Pop-Location
    Write-Host "==> Next.js standalone build ready"
}

# Generate placeholder icons
function Setup-Icons {
    $iconsDir = Join-Path $TauriDir "icons"
    if (Test-Path (Join-Path $iconsDir "icon.ico")) {
        Write-Host "==> Icons already exist, skipping"
        return
    }

    Write-Host "==> Generating placeholder icons (replace with real icons later)"
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null

    # Create minimal .ico file (32x32 blue square)
    python -c @"
import struct, zlib
def create_png(size):
    width = height = size
    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            raw += b'\x1a\x6b\xaa\xff'
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
import os
icons_dir = r'$iconsDir'
for size, name in [(32,'32x32.png'),(128,'128x128.png'),(256,'128x128@2x.png')]:
    open(os.path.join(icons_dir, name), 'wb').write(create_png(size))
# Create a simple .ico (just the 32x32 PNG wrapped)
png32 = create_png(32)
ico_header = struct.pack('<HHH', 0, 1, 1)
ico_entry = struct.pack('<BBBBHHII', 32, 32, 0, 0, 1, 32, len(png32), 22)
open(os.path.join(icons_dir, 'icon.ico'), 'wb').write(ico_header + ico_entry + png32)
print('Icons created')
"@

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  (icon generation failed - add icons manually to src-tauri/icons/)" -ForegroundColor Yellow
    }
}

# Build Tauri
function Build-Tauri {
    Write-Host "==> Building Tauri application"
    Push-Location $TauriDir

    # Ensure tauri-cli is installed
    $tauriCli = cargo install --list 2>&1 | Select-String "tauri-cli"
    if (-not $tauriCli) {
        Write-Host "==> Installing tauri-cli"
        cargo install tauri-cli --version "^2"
    }

    cargo tauri build
    Pop-Location

    Write-Host ""
    Write-Host "==> Build complete!" -ForegroundColor Green
    Write-Host "    Installers are in: $TauriDir\target\release\bundle\"
}

# Main
New-Item -ItemType Directory -Path $ResourcesDir -Force | Out-Null
Setup-Node
Build-NextJS
Setup-Icons
Build-Tauri
