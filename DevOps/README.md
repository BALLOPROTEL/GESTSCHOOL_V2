# DevOps

This directory documents release and deployment responsibilities for GestSchool_V2.

Some DevOps files must stay at the repository root because the platforms require it:

- GitHub Actions: `.github/workflows`
- Render blueprint: `render.yaml`
- Vercel configuration: `vercel.json`
- Workspace scripts: `package.json`

Current deployment model:

- Web admin: Vercel, package `@gestschool/web-admin`
- API: Render web service, package `@gestschool/api`
- Worker: Render worker service, package `@gestschool/api`
- Package manager: pnpm via Corepack

Rule:

- Keep platform-required config files at their required locations.
- Use this folder for release notes, runbooks, and deployment decision records only.
- Do not move `.github`, `render.yaml`, or `vercel.json` here unless the platform
  configuration is also changed and validated.
