# Dependency audit policy

GestSchool blocks every production dependency advisory. The complete
development audit blocks every critical or high advisory. PostCSS advisories
remain blocking at every severity because the frontend build processes
repository CSS and source maps through PostCSS.

## Exceptions

No temporary exception is active. The machine-readable policy in
`scripts/security/dependency-audit-exceptions.json` must contain an empty
`exceptions` array; adding an entry fails the gate until the policy and its
tests are deliberately reviewed.

The former `GHSA-mh99-v99m-4gvg` exception for
`brace-expansion@1.1.16` was retired when compatible fixes became available on
the existing dependency branches. `minimatch@3` now resolves the compatible
`brace-expansion@1.1.18`; modern consumers resolve `brace-expansion@5.0.9`.
No incompatible major override is used.

Enforcement:

1. Production dependencies have no exception.
2. Any critical/high advisory, PostCSS finding or malformed report fails the
   gate.
3. The gate runs on every CI execution and every Monday through the scheduled
   workflow.
4. Audit reports are generated with pnpm 11 and retained as CI artifacts.
5. The pnpm 10 lockfile checksum is checked before and after each audit.
