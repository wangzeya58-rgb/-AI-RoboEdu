#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' 'Automatic remote deployment is disabled.' \
  'The previous script mixed standalone/custom-server releases and could remove persistent data.' \
  'Follow docs/deployment/course-production.md after confirming the target server and backups.' >&2
exit 64
