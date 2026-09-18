#!/bin/sh
set -eu

PROJECT='/Users/juhyun/AI-Influencer-Factory/monitor-app'
ELECTRON="$PROJECT/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
ENTRY="$PROJECT/electron/main.cjs"
NODE="$PROJECT/node_modules/.bin/next"

NEXT_LOG="$HOME/Library/Logs/FactoryGuide-next.log"
NEXT_ERR="$HOME/Library/Logs/FactoryGuide-next-error.log"

cd "$PROJECT"

# 1. Next.js Monitor API가 죽어 있으면 시작
if ! /usr/bin/curl -fsS --max-time 2 \
  http://localhost:3000/api/monitor >/dev/null 2>&1; then

  echo 'Starting Factory Guide Next.js monitor server.'

  /usr/bin/nohup "$NODE" dev \
    >>"$NEXT_LOG" \
    2>>"$NEXT_ERR" &

  # 최대 약 20초 동안 서버 준비 대기
  i=0
  while [ "$i" -lt 20 ]; do
    if /usr/bin/curl -fsS --max-time 1 \
      http://localhost:3000/api/monitor >/dev/null 2>&1; then
      echo 'Factory Guide Next.js monitor server ready.'
      break
    fi

    i=$((i + 1))
    /bin/sleep 1
  done
else
  echo 'Factory Guide Next.js monitor server already running.'
fi


# 2. Local runtime watcher 중복 실행 방지
WATCHER="$PROJECT/scripts/local-runtime-watch.mjs"

if ! /bin/ps -axo command= | /usr/bin/grep -F "$WATCHER" | /usr/bin/grep -v grep >/dev/null 2>&1; then
  echo 'Starting Factory Guide local runtime watcher.'
  /usr/bin/nohup /usr/bin/env node "$WATCHER" \
    >>"$HOME/Library/Logs/FactoryGuide-runtime.log" \
    2>>"$HOME/Library/Logs/FactoryGuide-runtime-error.log" &
else
  echo 'Factory Guide local runtime watcher already running.'
fi

# 3. Electron 위젯 중복 실행 방지

if /bin/ps -axo command= | /usr/bin/awk -v exe="$ELECTRON" -v entry="$ENTRY" '
  $0 == exe " " entry || $0 == exe " electron/main.cjs" { found = 1 }
  END { exit !found }
'; then
  echo 'Factory Guide already running; skipped duplicate launch.'
  exit 0
fi

if [ ! -x "$ELECTRON" ] || [ ! -r "$ENTRY" ] || [ ! -r "$PROJECT/electron/widget.html" ]; then
  echo 'Factory Guide launch failed: existing Electron or widget files missing.' >&2
  exit 1
fi

unset ELECTRON_RUN_AS_NODE
echo 'Starting Factory Guide widget.'
exec "$ELECTRON" "$ENTRY"
