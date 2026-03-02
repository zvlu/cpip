# Security Policy

## Supported Versions

This project is under active development. The latest `master` branch is the supported version.

## Reporting a Vulnerability

If you discover a security issue, do not open a public issue with sensitive details.

Send a private report to your internal engineering/security contact and include:

- A clear description of the vulnerability
- Reproduction steps
- Potential impact
- Suggested mitigation (if known)

## Recommended Deployment Controls

- Keep all secrets in your hosting provider secret manager (never in source control)
- Rotate `SUPABASE_SERVICE_ROLE_KEY` and third-party API keys regularly
- Restrict API access to authenticated users at the application edge
- Keep `ALLOW_GUEST_MODE=false` in production deployments
- Keep `ENABLE_PUBLIC_SIGNUP=false` unless you have additional abuse controls (captcha, email verification, fraud monitoring)
- Enable database RLS for all customer-bound tables
- Enable centralized logging and alerting for API failures and auth anomalies
