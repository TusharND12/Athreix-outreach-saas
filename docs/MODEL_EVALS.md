# AI quality and cost evaluation

Athreix treats AI output as an assistive layer over deterministic eligibility, normalization, and scoring—not as an unmeasured source of truth.

## Production gate

Before changing the default analysis or batch model, evaluate at least 100 representative, rights-cleared B2B records split across industries, geographies, sparse/rich profiles, verified/unverified contacts, and intentionally ineligible cases. A future B2C launch requires its own rights-cleared evaluation set and approval; it is not covered by the B2B launch result.

Measure:

- Schema validity and refusal handling
- Score rank correlation with expert review
- False-high-score rate, especially when evidence is missing
- Groundedness of summaries and rationales against stored evidence
- Sensitive-attribute leakage or impermissible inference
- Outreach factual accuracy, personalization quality, and unsupported claims
- Median/p95 latency, input/output/cache tokens, and cost per 1,000 leads

## Baseline strategy

Athreix uses OpenRouter as its only LLM gateway and exposes separate research, high-volume scoring, and interactive outreach model variables. Establish the accuracy target with a capable model available through OpenRouter, then evaluate lower-cost candidates against the same fixed dataset.

Suggested starting experiment:

1. Establish the quality ceiling with the strongest suitable OpenRouter model on the fixed evaluation set.
2. Compare lower-latency candidates for bounded high-volume qualification and scoring.
3. Compare high-quality writing/reasoning candidates for manually reviewed outreach and research chat.
4. Require structured-output support for every production task and reject schema-invalid responses.
5. Ship the least expensive configuration that clears every quality and safety threshold.
6. Re-run the suite after prompt, schema, model, data-source, or scoring-factor changes.

## Required review behavior

- A missing fact remains unknown; it is never converted into a negative or fabricated value.
- AI may explain or add bounded insight but cannot bypass suppression/compliance eligibility.
- UI labels distinguish deterministic score components from model-generated analysis.
- Every response stores model, prompt/schema version, latency, token usage, refusal status, and a hash of the evidence input.

Official references:

- [OpenRouter model routing](https://openrouter.ai/docs/guides/routing/routers/auto-router)
- [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [OpenRouter OpenAI SDK compatibility](https://openrouter.ai/docs/guides/community/openai-sdk)
