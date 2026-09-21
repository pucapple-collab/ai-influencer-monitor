#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[1/5] Install dependencies"
npm install --no-audit --no-fund

echo "[2/5] Lint + production build"
npm run check

echo "[3/5] Start local validation server"
FACTORY_SKIP_MONITOR=1 FACTORY_REAL_EXECUTION_ENABLED=false FACTORY_REAL_PUBLISH_ENABLED=false npm run dev >/tmp/factory-final-next.log 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in {1..60}; do
  if curl -fsS http://127.0.0.1:3000/api/production-readiness >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl -fsS http://127.0.0.1:3000/api/production-readiness >/dev/null; then
  cat /tmp/factory-final-next.log
  exit 1
fi

echo "[4/5] Full zero-cost factory simulation"
FACTORY_BASE_URL=http://127.0.0.1:3000 FACTORY_SKIP_MONITOR=1 npm run simulate:factory

echo "[5/5] Final local preflight PASS"
mkdir -p runtime
VALIDATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TMP_STATUS="runtime/validation-status.json.$"
cat > "$TMP_STATUS" <<EOF
{
  "ok": true,
  "validatedAt": "$VALIDATED_AT",
  "lint": true,
  "build": true,
  "factorySimulation": true,
  "externalCallMade": false,
  "paidUsageTriggered": false,
  "realExecutionEnabled": false,
  "realPublishEnabled": false
}
EOF
chmod 600 "$TMP_STATUS"
mv "$TMP_STATUS" runtime/validation-status.json
echo "Validation status saved: runtime/validation-status.json"
echo "Real AI execution: DISABLED"
echo "Real publishing: DISABLED"
echo "Next: npm run desktop"
