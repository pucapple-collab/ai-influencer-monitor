# Shared AI Development Log

Every worker reports its own work to `/api/ai-development-log`.

Workers: ChatGPT, Claude, Gemini, Higgsfield, Work.

Required lifecycle:
1. STARTED when work is accepted.
2. PROGRESS for meaningful checkpoints only.
3. SUCCESS with the concrete result, or ERROR with the concrete failure.
4. REVIEW when inspecting another worker's result.
5. IMPROVEMENT when proposing or adopting a change discovered from another worker's log.

Each worker must read recent entries before starting a related task. Reuse successful approaches, avoid repeating recorded failures, and record which other worker influenced an adopted improvement using `relatedAgent`.

Do not store prompts containing secrets, credentials, personal data, generated media, or full source files. Log concise execution metadata and conclusions only.

The log is local runtime state and is not committed. Hosted mutation remains blocked by the local API guard.
