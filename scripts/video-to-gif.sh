#!/usr/bin/env bash
#
# Convert an MP4/MOV video to an optimized animated GIF.
#
# Usage:
#   ./scripts/video-to-gif.sh <input-video> [width] [fps] [delay]
#
# Examples:
#   ./scripts/video-to-gif.sh demo.mp4              # 500px wide, 10 fps
#   ./scripts/video-to-gif.sh demo.mov 800           # 800px wide, 10 fps
#   ./scripts/video-to-gif.sh demo.mp4 640 15 7      # 640px wide, 15 fps, 7cs delay
#
# Output: <input-basename>.gif in the current directory.
#
# Dependencies: ffmpeg, sips, gifsicle

set -euo pipefail

# ── args ──────────────────────────────────────────────────────────────
INPUT="${1:?Usage: video-to-gif.sh <input-video> [width] [fps] [delay]}"
WIDTH="${2:-500}"
FPS="${3:-10}"
DELAY="${4:-10}"

if [[ ! -f "$INPUT" ]]; then
  echo "Error: file not found: $INPUT" >&2
  exit 1
fi

# ── derive output name ────────────────────────────────────────────────
BASENAME="$(basename "${INPUT%.*}")"
OUTPUT="${BASENAME}.gif"

# ── calculate height preserving aspect ratio ──────────────────────────
# Use ffprobe to get video dimensions, then scale proportionally.
read -r SRC_W SRC_H < <(
  ffprobe -v error \
    -select_streams v:0 \
    -show_entries stream=width,height \
    -of csv=p=0:s=x "$INPUT" | tr 'x' ' '
)

if [[ -z "$SRC_W" || -z "$SRC_H" ]]; then
  echo "Error: could not read video dimensions from $INPUT" >&2
  exit 1
fi

HEIGHT=$(( (WIDTH * SRC_H + SRC_W - 1) / SRC_W ))
# ensure even number (some tools prefer it)
HEIGHT=$(( HEIGHT + (HEIGHT % 2) ))

echo "Source : ${SRC_W}x${SRC_H}"
echo "Output : ${WIDTH}x${HEIGHT} @ ${FPS} fps, delay=${DELAY}cs"

# ── temp workspace ────────────────────────────────────────────────────
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

PNG_DIR="$TMPDIR/pngs"
GIF_DIR="$TMPDIR/gifs"
mkdir -p "$PNG_DIR" "$GIF_DIR"

# ── 1. extract frames ────────────────────────────────────────────────
echo "Extracting frames…"
ffmpeg -hide_banner -loglevel warning \
  -i "$INPUT" -r "$FPS" "$PNG_DIR/frame%04d.png"

FRAME_COUNT=$(ls "$PNG_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
echo "  → $FRAME_COUNT frames"

# ── 2. convert PNGs to individual GIFs ────────────────────────────────
echo "Converting to GIF frames…"
sips -s format gif "$PNG_DIR"/*.png --out "$GIF_DIR" >/dev/null 2>&1

# ── 3. assemble + optimize ────────────────────────────────────────────
echo "Assembling animated GIF…"
gifsicle --optimize=3 \
  --resize "${WIDTH}x${HEIGHT}" \
  --delay="$DELAY" \
  --loopcount \
  "$GIF_DIR"/*.gif > "$OUTPUT"

FILESIZE=$(du -h "$OUTPUT" | cut -f1 | tr -d ' ')
echo "Done → $OUTPUT ($FILESIZE)"
