#!/usr/bin/env bash
# Read-only HTTP checks. This is not a database or storage readiness check.
set -euo pipefail
ORIGIN="${APP_ORIGIN:-http://127.0.0.1:5000}"
ORIGIN="${ORIGIN%/}"
login_code="$(curl --silent --show-error --max-time 10 -o /dev/null -w '%{http_code}' "${ORIGIN}/login")"
test "$login_code" = 200 || { printf '%s\n' "Login page failed: HTTP $login_code" >&2; exit 1; }
api_code="$(curl --silent --show-error --max-time 10 -o /dev/null -w '%{http_code}' "${ORIGIN}/api/v1/courses")"
test "$api_code" = 401 || { printf '%s\n' "Unauthenticated course API expected 401; received $api_code" >&2; exit 1; }
printf '%s\n' 'PASS: login page HTTP 200; unauthenticated course API HTTP 401.' \
  'Also run pnpm run deploy:check with the production environment for DB/storage checks.'
