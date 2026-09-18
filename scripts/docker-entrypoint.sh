#!/bin/sh
set -eu

ROLE="${1:-web}"

case "$ROLE" in
  web)
    exec node apps/web/server.js
    ;;
  worker)
    exec node /app/runtime/worker/dist/index.js
    ;;
  migrate)
    exec node /app/runtime/db/dist/migrate-cli.js
    ;;
  seed-demo)
    exec node /app/runtime/db/dist/seed-demo-cli.js
    ;;
  *)
    echo "Unknown role: $ROLE (expected web|worker|migrate|seed-demo)" >&2
    exit 1
    ;;
esac
