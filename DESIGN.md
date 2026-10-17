# Design Brief

## Direction

Gold & Obsidian, documentary edition — extend the existing presale system with a calm archival reading surface and conspicuous test-token identity.

## Tone

Numismatic editorial restraint: warm black framing, parchment document, dark ink, and gold reserved for meaningful wayfinding and actions.

## Differentiation

An edition ledger pairs a carefully typeset parchment reading sheet with an unambiguous TTTI-T (Test) disclosure before any purchase decision.

## Color Palette

| Token | OKLCH | Role |
| --- | --- | --- |
| background / foreground | 0.13 0.008 60 / 0.94 0.025 85 | existing obsidian and warm ivory |
| card / border | 0.155 0.01 60 / 0.265 0.024 70 | quiet chrome and hairlines |
| primary / accent | 0.79 0.13 82 / 0.63 0.1 58 | existing gold and restrained bronze |
| muted / muted-foreground | 0.19 0.012 60 / 0.7 0.035 78 | low-key supporting UI |
| reading-surface / reading-ink | 0.965 0.014 85 / 0.22 0.025 60 | document-only parchment and ink |
| reading-muted / reading-rule / reading-link | 0.43 0.03 60 / 0.85 0.025 80 / 0.43 0.1 70 | archival metadata, fine rules, readable links |

## Typography

- Display: Fraunces — existing engraved headings; reserve oversized treatment for the document title.
- Body: Satoshi — UI and article prose; JetBrains Mono — section numerals, edition dates, symbols and amounts.
- Scale: page title `text-4xl md:text-6xl`, section heading `text-2xl md:text-3xl`, metadata `text-xs uppercase tracking-widest`, reading body `text-base leading-[1.8]` at `max-w-[68ch]`.

## Elevation & Depth

Keep existing open obsidian sections; `.paper-sheet` is the sole light surface on the reading page, with a fine border and no stacking shadows.

## Structural Zones

| Zone | Background | Border | Notes |
| --- | --- | --- | --- |
| Header | existing `bg-background/90 backdrop-blur` | quiet `border-b border-border` | crest and existing navigation remain legible |
| Reading introduction | `bg-background` | one `.divider-gold` | document title, edition selector, factual identity disclosure |
| Article | `.paper-sheet` | `.paper-rule` between major sections | optional side TOC on desktop; in-flow TOC on mobile; `.paper-prose` |
| Purchase surfaces | existing dark surfaces | `.token-identity-note` inside existing flow | test identity and explicit acknowledgement adjacent to both purchase actions |
| Footer | existing `bg-card` | `border-t border-border` | existing navigation and disclaimers preserved |

## Spacing & Rhythm

Keep existing `.section-breathing`; document intro `max-w-6xl`, reading column `68ch`, 24px mobile gutters, 32–48px section gaps, and 44px minimum touch targets.

## Component Patterns

- Buttons: retain the existing gold primary purchase action; edition controls are quiet tabs or segmented links with visible selected state and focus ring.
- Cards: one parchment article, not nested cards; choose clear section numerals and rules over ornamental panels.
- Badges: label the current token literally `TTTI-T (Test)` in text, not a gold achievement badge; distinguish historical ledger references factually.
- Editions: label `Corrected edition` as current and `Original` as archival; preserve original wording separately; corrected figures must match current app data.
- Standards: show only verified official icon files with provenance; existing unofficial ICRC-3 vector must not be presented as official; use text labels otherwise.
- Acknowledgement: in each existing purchase mode, place a clearly labeled required reading acknowledgement beside the final purchase control, with a link to the white paper; do not precheck it.

## Motion

- Entrance: optional existing `animate-fade-up` for the introductory title only; honor reduced motion.
- Hover: existing `transition-smooth` for tabs and links, without shifting document layout.
- Decorative: no article shimmer, glow, animated seals or moving text.

## Constraints

- Preserve current routes, crest, navigation, purchase flow, dark default, optional `.light` variant and existing Fraunces/Satoshi/JetBrains Mono font assets.
- English, factual token status and historical disclosure; avoid investment promises, implied token equivalence or unverified standards certification.
- Use semantic tokens and readable contrast; on parchment use `.paper-sheet` ink rather than dark-theme `text-foreground`; visible keyboard focus throughout.

## Signature Detail

A finely ruled edition marker and sober `TTTI-T (Test)` identity note make the white paper feel like an archival primary source rather than a campaign landing page.
