# Multi-AI Factory operating map

This file is a distilled operating map, not a copy of provider documentation.

## Control plane

ChatGPT/monitor-app remains the control plane because it already owns factory state, approval gates, audit history, cost locks, GitHub CI, and the desktop monitor. Providers are workers, not independent sources of truth.

## Work allocation

- Claude: architecture, complex coding, code review, long-horizon agent tasks. Default API model: `claude-opus-5`. For lower-cost parallel work, `claude-sonnet-5` can be selected explicitly.
- Gemini: research-heavy, multimodal, structured-output, high-throughput sub-tasks. New integrations use the Interactions API rather than legacy generateContent.
- Higgsfield: image/video/3D/marketing media. Treat generation as asynchronous and retain request IDs. Use cost estimation before paid media generation where available.
- monitor-app: routing, approvals, persistence, retries, cost gates, audit, final merge decisions.

## Official source indexes reviewed

Claude Platform:
- https://platform.claude.com/docs/en/intro
- https://platform.claude.com/docs/en/claude_api_primer
- https://platform.claude.com/docs/en/models/overview
- https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables

Gemini:
- https://ai.google.dev/gemini-api/docs
- https://ai.google.dev/gemini-api/docs/interactions-overview
- https://ai.google.dev/gemini-api/docs/function-calling
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/models

Higgsfield:
- https://docs.higgsfield.ai/docs/llms.txt
- https://docs.higgsfield.ai/docs/how-to/introduction.md
- https://docs.higgsfield.ai/docs/how-to/webhooks.md
- https://docs.higgsfield.ai/docs/how-to/sdk.md
- https://docs.higgsfield.ai/docs/guides/images.md
- https://docs.higgsfield.ai/docs/guides/video.md
- https://open.higgsfield.ai/quick-start

## Credential contract

All credentials stay server-side.

```
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
HF_API_KEY_ID=
HF_API_KEY_SECRET=
```

Higgsfield also supports a combined `HF_CREDENTIALS` value for its SDK path. Never expose any of these with a `NEXT_PUBLIC_` prefix.

## Routing rule

The router expresses preferred ownership, but only a provider with both credentials and an implemented adapter is executable. Missing providers never block unrelated work: the controller falls back where possible and continues other queues.
