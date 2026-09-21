# Activation control center

Use `GET /api/activation-status` as the single read-only checkpoint for the remaining activation path.

It reports provider credential presence, server safety switches, remaining stages, and the next action. It never returns credential values, contacts an AI provider, publishes content, or triggers paid usage.

## Safety boundary

Real generation remains a two-key action:

1. server switch `FACTORY_REAL_EXECUTION_ENABLED=true`
2. request confirmation `confirmExternalCall=true`

Real publishing uses an independent switch and confirmation. Keep both switches off during ordinary development.

## Final activation order

1. Review current provider pricing and configure account spend controls.
2. Add server-only credentials.
3. Confirm `/api/activation-status` has no missing providers.
4. Enable real execution only for one minimal test.
5. Run one provider at a time and inspect the execution record.
6. Disable real execution again unless continuous production use is intentionally approved.
7. Select and review a publishing platform separately before enabling publishing.
