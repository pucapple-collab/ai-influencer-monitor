# Final Mac apply

The remote-safe code path is complete. On the Mac, the remaining local-device work is intentionally small.

```bash
cd ~/AI-Influencer-Factory/monitor-app
git switch main
git pull --ff-only
npm install --no-audit --no-fund
npm run check
npm run desktop
```

Then verify the widget opens, can be dragged, its panel opens/closes, and the dashboard loads.

## Safe generation test

Keep these disabled until provider pricing and credentials are reviewed:

```env
FACTORY_REAL_EXECUTION_ENABLED=false
FACTORY_REAL_PUBLISH_ENABLED=false
```

The dashboard AI button runs the dry-run path by default. Dry-run does not require provider credentials and must end with the job in `review`.

## Real activation

Only after explicit approval:

1. Add provider credentials server-side.
2. Check `/api/production-readiness`.
3. Review provider pricing/spend controls.
4. Set `FACTORY_REAL_EXECUTION_ENABLED=true`.
5. Send one request with `mode: "real"` and `confirmExternalCall: true`.
6. Turn the switch back off after the test if continuous real execution is not intended.

Publishing stays separately disabled behind `FACTORY_REAL_PUBLISH_ENABLED`.
