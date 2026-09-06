#!/usr/bin/env bash
# Test de bout en bout du workflow avec le moteur mock, sans clés API.
# Démarre un serveur dev isolé (base PGlite dédiée), lance un run, attend la fin, affiche le résultat.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3123}"
export GEO_MOCK_ENGINE=1 PGLITE_DIR=./.data/e2e CRON_SECRET=e2e APP_PASSWORD=e2e
export WORKFLOW_LOCAL_DATA_DIR=./.workflow-data-e2e
rm -rf .data/e2e .workflow-data-e2e
pnpm seed >/dev/null
pnpm dev --port "$PORT" >"${E2E_LOG:-/tmp/geo-e2e.log}" 2>&1 &
DEV_PID=$!
trap 'kill $DEV_PID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf "http://localhost:$PORT/login" >/dev/null && break; sleep 1; done
AUTH="Authorization: Bearer e2e"
LAUNCH=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' -d '{}' "http://localhost:$PORT/api/runs")
echo "lancé : $LAUNCH"
RUN_ID=$(echo "$LAUNCH" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0)).runId)')
for i in $(seq 1 120); do
  STATUS=$(curl -sf -H "$AUTH" "http://localhost:$PORT/api/runs?limit=5" | node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0)).runs.find(r=>r.id==='$RUN_ID')))")
  ST=$(echo "$STATUS" | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).status)" 2>/dev/null || echo "?")
  if [ "$ST" = "done" ] || [ "$ST" = "failed" ]; then echo "final : $STATUS"; exit 0; fi
  sleep 2
done
echo "timeout, dernier état : $STATUS"; exit 1
