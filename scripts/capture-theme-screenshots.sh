#!/bin/bash
# One-off helper: captures dashboard screenshots for the four themes.
set -e
cd "$(dirname "$0")/.."
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
OUT='C:\Users\HP OMEN\OneDrive\Desktop\Master\note taking\notes\docs\screenshots'

shot() {
  local tag="$1"
  local file="$2"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --user-data-dir="$(cygpath -w "$(mktemp -d)")-$tag" \
    --window-size=1440,900 --virtual-time-budget=15000 \
    --screenshot="$OUT\\$file" "http://localhost:56795/dashboard" 2>&1 | tail -1
}

for t in light dark favicon landing; do
  curl -s -X PUT -d "$t" http://localhost:3000/api/theme > /dev/null
  case "$t" in
    light)   shot light theme-light.png ;;
    dark)    shot dark theme-dark.png ;;
    favicon) shot favicon theme-light-v2.png ;;
    landing) shot landing theme-dark-v2.png ;;
  esac
done

# restore the theme the user had selected
curl -s -X PUT -d "favicon" http://localhost:3000/api/theme > /dev/null
ls -la docs/screenshots/theme-*.png
