# Readout Next: minimal contract

The ideal-edition exercise showed that CanvasMD does not need a second canonical
Story schema. The existing source-anchored `HeroCard` plus its exact `support`
bundle already contains the required contract.

## Anchor

- `kind`, `anchorId`, `headline`, `sourceLabel`, and `url` answer what happened and
  where the authoritative source lives.
- `excerpt` is source context, never an inferred endpoint classification.
- `nct` is optional context and appears only after unique deterministic resolution.

## Conversation

- `support.clinicianPosts` is the primary differentiating evidence.
- `publisherPosts`, `otherPosts`, and `links` follow it as corroborating context.
- Full thread disclosure and quote context remain attached to the authored post.
- A thread whose exact X status is already attached to an event is folded into that
  event and cannot occupy another top-story slot.

## Presentation

- The collapsed card identifies the source and previews physician conversation.
- Abstract/source context and conversation have distinct disclosures.
- Web and native use the same payload and the same source/conversation hierarchy.
- Thin editions remain thin.
- The weekly story view opens on developments, not a generated recap. The Daily
  owns narrative synthesis; the Readout owns fast inspection and evidence.

## Explicit refusals

- No automatic readout wrapper.
- No endpoint status inferred from p-values, confidence intervals, hazard ratios,
  publication types, registry dates, or bibliography relationships.
- No semantic-only suppression. One-story-one-card folding requires an exact
  support receipt or another deterministic shared identity.
- No engagement metric substitutes for attributable physician receipts.
