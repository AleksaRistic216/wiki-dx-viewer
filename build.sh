#!/usr/bin/env bash
# Build script for wiki-dx-viewer Tauri app
# Usage: ./build.sh [--target <platform>]
# Platforms: windows, macos, linux (defaults to current OS)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
TAURI_DIR="$SCRIPT_DIR/src-tauri"
RESOURCES_DIR="$TAURI_DIR/resources"
NODE_VERSION="20.18.1"

# Detect platform
detect_platform() {
    case "$(uname -s)" in
        Linux*)  echo "linux" ;;
        Darwin*) echo "macos" ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *)       echo "unknown" ;;
    esac
}

PLATFORM="${1:-$(detect_platform)}"
if [ "$1" = "--target" ]; then
    PLATFORM="$2"
fi

echo "==> Building for platform: $PLATFORM"
echo "==> Node.js version: $NODE_VERSION"

# Determine Node.js download URL
get_node_url() {
    local platform="$1"
    local base="https://nodejs.org/dist/v${NODE_VERSION}"
    case "$platform" in
        windows) echo "$base/node-v${NODE_VERSION}-win-x64.zip" ;;
        macos)   echo "$base/node-v${NODE_VERSION}-darwin-arm64.tar.gz" ;;
        linux)   echo "$base/node-v${NODE_VERSION}-linux-x64.tar.xz" ;;
    esac
}

# Download and extract Node.js
setup_node() {
    local node_dir="$RESOURCES_DIR/node"
    if [ -d "$node_dir" ]; then
        echo "==> Node.js already downloaded, skipping"
        return
    fi

    local url=$(get_node_url "$PLATFORM")
    local tmp_dir=$(mktemp -d)
    echo "==> Downloading Node.js from $url"

    case "$PLATFORM" in
        windows)
            curl -sL "$url" -o "$tmp_dir/node.zip"
            unzip -q "$tmp_dir/node.zip" -d "$tmp_dir"
            mkdir -p "$node_dir"
            cp "$tmp_dir"/node-v${NODE_VERSION}-win-x64/node.exe "$node_dir/"
            ;;
        macos)
            curl -sL "$url" -o "$tmp_dir/node.tar.gz"
            tar -xzf "$tmp_dir/node.tar.gz" -C "$tmp_dir"
            mkdir -p "$node_dir/bin"
            cp "$tmp_dir"/node-v${NODE_VERSION}-darwin-arm64/bin/node "$node_dir/bin/"
            ;;
        linux)
            curl -sL "$url" -o "$tmp_dir/node.tar.xz"
            tar -xJf "$tmp_dir/node.tar.xz" -C "$tmp_dir"
            mkdir -p "$node_dir/bin"
            cp "$tmp_dir"/node-v${NODE_VERSION}-linux-x64/bin/node "$node_dir/bin/"
            ;;
    esac

    rm -rf "$tmp_dir"
    echo "==> Node.js extracted to $node_dir"
}

# Build Next.js standalone
build_nextjs() {
    echo "==> Installing npm dependencies"
    cd "$SRC_DIR"
    npm install --silent

    echo "==> Building Next.js (standalone mode)"
    npm run build

    echo "==> Copying standalone server to resources"
    local server_dir="$RESOURCES_DIR/server"
    rm -rf "$server_dir"
    mkdir -p "$server_dir"

    # Copy the standalone output
    cp -r "$SRC_DIR/.next/standalone/"* "$server_dir/"

    # Copy static assets (needed for Next.js)
    if [ -d "$SRC_DIR/.next/static" ]; then
        mkdir -p "$server_dir/.next/static"
        cp -r "$SRC_DIR/.next/static/"* "$server_dir/.next/static/"
    fi

    # Copy public folder if it exists
    if [ -d "$SRC_DIR/public" ]; then
        mkdir -p "$server_dir/public"
        cp -r "$SRC_DIR/public/"* "$server_dir/public/"
    fi

    echo "==> Next.js standalone build ready"
}

# Generate placeholder icons if missing
setup_icons() {
    local icons_dir="$TAURI_DIR/icons"
    if [ ! -f "$icons_dir/icon.ico" ]; then
        echo "==> Generating placeholder icons"
        # Create a minimal 1x1 PNG as placeholder
        # In production, replace with proper app icons
        mkdir -p "$icons_dir"
        python3 -c "
import struct, zlib
def create_png(size):
    width = height = size
    raw = b''
    for y in range(height):
        raw += b'\\x00'  # filter byte
        for x in range(width):
            raw += b'\\x1a\\x6b\\xaa\\xff'  # RGBA blue-ish
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    return b'\\x89PNG\\r\\n\\x1a\\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
for size, name in [(32,'32x32.png'),(128,'128x128.png'),(256,'128x128@2x.png')]:
    open('$icons_dir/' + name, 'wb').write(create_png(size))
print('Icons created')
" 2>/dev/null || echo "  (skipping icon generation - install python3 or add icons manually)"
    fi
}

# Build Tauri app
build_tauri() {
    echo "==> Building Tauri application"
    cd "$TAURI_DIR"
    cargo tauri build
    echo ""
    echo "==> Build complete! Installers are in:"
    echo "    $TAURI_DIR/target/release/bundle/"
}

# Main
mkdir -p "$RESOURCES_DIR"
setup_node
build_nextjs
setup_icons
build_tauri
