# Integrations

This directory tracks external integration boundaries planned or already represented in
GestSchool_V2.

Current real integration-related code remains in the backend:

- Payment-facing finance code: `Backend/api/src/finance` and `Backend/api/src/payments`
- Notification provider configuration: `Backend/api/src/notifications`
- Storage upload descriptors: `Backend/api/src/storage`

Near-term integrations planned by product direction:

- Payment provider integration
- Brevo email/SMS integration

Rule:

- Do not create provider-specific folders before implementation starts.
- Do not introduce fake SDK wrappers or empty service packages.
- When an integration becomes real, document its environment variables, provider
  lifecycle, retry strategy, and audit requirements here before extraction.
