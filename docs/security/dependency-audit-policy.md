# Dependency audit policy

GestSchool blocks every production dependency advisory. The complete
development audit blocks every critical or high advisory except the single
temporary exception declared in
`scripts/security/dependency-audit-exceptions.json`.

## Temporary exception

- Owner: GestSchool maintainers.
- Advisory: `GHSA-mh99-v99m-4gvg`.
- Package: exactly `brace-expansion@1.1.16`.
- Scope: development dependencies only.
- Allowed chains: the currently inventoried ESLint, Jest and Nest CLI chains.
- Expiration: end of 2026-08-11 UTC.
- Automatic renewal: forbidden.

The latest stable Jest 30 and Nest CLI 11 dependency trees still use
`minimatch@3`, whose compatible brace-expansion line does not contain the
official `5.0.8` fix. Forcing brace-expansion 5 below minimatch 3 is forbidden.
The repository passes only static, repository-owned glob patterns to these
tools. HTTP input, user content and GitHub Actions inputs are not used as glob
patterns.

Compensating measures:

1. Production dependencies have no exception.
2. The policy verifies the exact advisory, package, version, dev-only scope and
   dependency-chain categories.
3. Any other critical/high advisory, PostCSS finding, malformed report or
   expired exception fails the gate.
4. The gate runs on every CI execution and every Monday through the scheduled
   workflow.
5. Audit reports are generated with pnpm 11 and retained as CI artifacts.

Remove the exception as soon as stable parent releases no longer resolve
`minimatch@3` to `brace-expansion@1.1.16`. Re-run the frozen pnpm 10 install,
the complete validation matrix and both pnpm 11 audits before removal.
