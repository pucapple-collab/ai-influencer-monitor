# AI Provider connection checklist

This project keeps provider execution server-side and blocks real calls unless the API request explicitly sends `mode: "real"` and `confirmExternalCall: true`.

## Safe preflight

`GET /api/ai-preflight` checks only whether expected server environment variables exist. It never contacts an AI provider and never triggers paid usage.

## Credentials

- Gemini: `GEMINI_API_KEY`
- Claude: `ANTHROPIC_API_KEY`
- Higgsfield: prefer `HF_CREDENTIALS` (official TypeScript SDK convention). `HF_KEY` and legacy `HIGGSFIELD_API_KEY` are also recognized by this app.

Never put provider secrets in `NEXT_PUBLIC_*` variables or commit them to Git.

## Models

- Gemini defaults to `gemini-3.8-flash`.
- Claude defaults to `claude-opus-5`.
- Higgsfield requires explicit model selection before a billable generation. The app intentionally leaves Higgsfield in READY state until that choice is made.

## Phone / remote stage

GitHub code, CI, dry-run integration tests, and provider-readiness checks can be completed remotely. Mac-only Electron/widget launch and LaunchAgent validation remain local-device steps.

## Billing gate

Dry-run and preflight never make provider calls. Real execution is blocked until explicit confirmation is supplied. Before enabling production provider calls, review each provider's current pricing and set a spending limit where the provider supports one.
