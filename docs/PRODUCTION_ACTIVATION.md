# Production activation runbook

The factory is designed to remain safe and zero-cost until a human deliberately crosses the real-execution gate.

## 1. Server-only credentials

Copy `.env.production.example` to the deployment provider's encrypted environment settings. Do not commit real values and do not use `NEXT_PUBLIC_*` for provider secrets.

## 2. Readiness check

Call `GET /api/production-readiness`. This endpoint checks local configuration only. It never contacts providers and never triggers paid usage.

## 3. Billing checkpoint

Before the first real request, verify current provider pricing and account spending controls. Real generation must stay disabled until this checkpoint is accepted.

## 4. Minimal real test

Run one provider at a time, with one low-cost prompt. A real generation request must explicitly use `mode: "real"` and `confirmExternalCall: true`.

## 5. Publishing

Publishing remains disconnected until a target platform is selected and its credentials/scopes are reviewed. Real publishing additionally requires `confirmExternalPublish: true`.

## 6. Mac validation

After pulling main on the Mac, run the existing verification and desktop widget smoke test. LaunchAgent/Electron validation cannot be completed from the remote GitHub runner.
