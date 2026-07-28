#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AUDIT_PNPM_VERSION="${AUDIT_PNPM_VERSION:-11.13.0}"
REPORT_DIR="${DEPENDENCY_AUDIT_REPORT_DIR:-/tmp/gestschool-dependency-audit}"
PROD_REPORT="${REPORT_DIR}/production.json"
FULL_REPORT="${REPORT_DIR}/full.json"

cd "${ROOT_DIR}"
mkdir -p "${REPORT_DIR}"

AUDIT_RUNNER=""
if command -v corepack >/dev/null 2>&1 &&
   corepack "pnpm@${AUDIT_PNPM_VERSION}" --pm-on-fail=ignore --version >/dev/null 2>&1; then
  AUDIT_RUNNER="corepack"
  AUDIT_VERSION="$(corepack "pnpm@${AUDIT_PNPM_VERSION}" --pm-on-fail=ignore --version)"
elif command -v docker >/dev/null 2>&1 &&
     docker version >/dev/null 2>&1; then
  AUDIT_RUNNER="docker"
  AUDIT_VERSION="$(
    docker run --rm node:22.22.0-bookworm-slim \
      sh -lc "corepack pnpm@${AUDIT_PNPM_VERSION} --pm-on-fail=ignore --version"
  )"
else
  echo "Neither a working Corepack nor Docker audit runner is available." >&2
  exit 1
fi

echo "Dependency audits use pnpm ${AUDIT_VERSION}."
if [[ "${AUDIT_VERSION}" != 11.* ]]; then
  echo "Expected pnpm 11.x for the Bulk Advisory audit endpoint." >&2
  exit 1
fi

LOCKFILE_BEFORE="$(sha256sum pnpm-lock.yaml | awk '{print $1}')"

set +e
if [[ "${AUDIT_RUNNER}" == "corepack" ]]; then
  corepack "pnpm@${AUDIT_PNPM_VERSION}" --pm-on-fail=ignore \
    audit --prod --json > "${PROD_REPORT}"
  PROD_EXIT=$?
  corepack "pnpm@${AUDIT_PNPM_VERSION}" --pm-on-fail=ignore \
    audit --json > "${FULL_REPORT}"
  FULL_EXIT=$?
else
  docker run --rm \
    -v "${ROOT_DIR}:/workspace:ro" \
    -w /workspace \
    node:22.22.0-bookworm-slim \
    sh -lc "corepack pnpm@${AUDIT_PNPM_VERSION} --pm-on-fail=ignore audit --prod --json" \
    > "${PROD_REPORT}"
  PROD_EXIT=$?
  docker run --rm \
    -v "${ROOT_DIR}:/workspace:ro" \
    -w /workspace \
    node:22.22.0-bookworm-slim \
    sh -lc "corepack pnpm@${AUDIT_PNPM_VERSION} --pm-on-fail=ignore audit --json" \
    > "${FULL_REPORT}"
  FULL_EXIT=$?
fi
set -e

echo "Raw production audit exit code: ${PROD_EXIT}"
echo "Raw full audit exit code: ${FULL_EXIT}"

node scripts/security/dependency-audit-policy.mjs \
  --prod "${PROD_REPORT}" \
  --full "${FULL_REPORT}"

LOCKFILE_AFTER="$(sha256sum pnpm-lock.yaml | awk '{print $1}')"
if [[ "${LOCKFILE_BEFORE}" != "${LOCKFILE_AFTER}" ]]; then
  echo "pnpm audit modified pnpm-lock.yaml." >&2
  exit 1
fi
echo "Lockfile unchanged by dependency audits."
