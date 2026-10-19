#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' 'Automatic system installation is disabled until the server is identified.' \
  'Do not change packages, ownership, firewall or SELinux on an existing website blindly.' \
  'See docs/deployment/course-production.md for reviewed manual setup.' >&2
exit 64
