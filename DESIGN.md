---
name: Athreix Prospect AI
description: A calm intelligence desk for turning audience intent into trustworthy action.
colors:
  signal-amber: "oklch(0.842 0.165 91.3)"
  working-white: "oklch(1 0 0)"
  decision-black: "oklch(0.145 0.006 91.3)"
  quiet-layer: "oklch(0.965 0.003 91.3)"
  quiet-ink: "oklch(0.42 0.01 91.3)"
  boundary: "oklch(0.9 0.004 91.3)"
  signal-layer: "oklch(0.945 0.035 91.3)"
  dark-canvas: "oklch(0.13 0.004 91.3)"
  success: "oklch(0.52 0.13 145)"
  destructive: "oklch(0.55 0.21 27)"
  signal-amber-srgb: "#f3c624"
  working-white-srgb: "#ffffff"
  decision-black-srgb: "#0b0a07"
  quiet-ink-srgb: "#4f4d47"
  boundary-srgb: "#dfdedb"
  dark-canvas-srgb: "#080706"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3rem, 7.8vw, 5.8rem)"
    fontWeight: 600
    lineHeight: 0.96
    letterSpacing: "-0.038em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.03
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  pill: "9999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "clamp(5rem, 10vw, 9rem)"
components:
  button-signal:
    backgroundColor: "{colors.signal-amber}"
    textColor: "{colors.decision-black}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
    height: "2.75rem"
  button-product:
    backgroundColor: "{colors.decision-black}"
    textColor: "{colors.working-white}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
    height: "2.75rem"
  field:
    backgroundColor: "{colors.working-white}"
    textColor: "{colors.decision-black}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 0.75rem"
    height: "2.75rem"
  surface:
    backgroundColor: "{colors.working-white}"
    textColor: "{colors.decision-black}"
    rounded: "{rounded.xl}"
    padding: "1.25rem"
  status-chip:
    backgroundColor: "{colors.quiet-layer}"
    textColor: "{colors.quiet-ink}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
    height: "1.5rem"
---

# Design System: Athreix Prospect AI

## 1. Overview

**Creative North Star: "The Intelligence Desk"**

Athreix feels like a focused growth operator's working desk: crisp white surfaces, disciplined black typography, compact evidence, and one rare amber signal. The product stays calm under information density and becomes emphatic only at a genuine decision point.

The public experience carries editorial scale; the authenticated workspace becomes denser and more operational. Both use the same Geist voice, neutral architecture, compact curvature, and exact signal color. Motion is responsive state feedback, never page-load theatre. Evidence, freshness, permission, and progress sit beside conclusions instead of hiding behind them.

The system explicitly rejects generic glassy AI SaaS, Apollo-style CRM clutter, Clay-like spreadsheet complexity without progressive disclosure, decorative metric-card dashboards, and consumer-data growth hacks that obscure provenance or permission.

**Key Characteristics:**

- Monochrome working surfaces with one scarce amber signal.
- Search-first composition with progressive controls and visible cost.
- Dense, tabular product views that collapse into readable mobile records.
- Evidence, permission, freshness, and confidence next to AI output.
- Flat at rest; structurally elevated only during interaction.

## 2. Colors

The palette is deliberately austere. Neutral surfaces carry the work; amber creates brand memory and marks meaningful action.

### Primary

- **Signal Amber** (`oklch(0.842 0.165 91.3)`): Brand mark, primary marketing action, meaningful progress, and the rare high-value signal. It never becomes a page background.

### Neutral

- **Working White** (`oklch(1 0 0)`): Main canvas, cards, fields, and light overlays.
- **Decision Black** (`oklch(0.145 0.006 91.3)`): Primary ink, product actions, dark marketing surfaces, and decisive selected states.
- **Quiet Layer** (`oklch(0.965 0.003 91.3)`): Sidebars, grouped controls, toolbars, and disabled or secondary surfaces.
- **Quiet Ink** (`oklch(0.42 0.01 91.3)`): Supporting copy and data labels; never primary prose on a dense surface.
- **Boundary** (`oklch(0.9 0.004 91.3)`): One-pixel dividers, table structure, and card outlines.
- **Dark Canvas** (`oklch(0.13 0.004 91.3)`): Dark theme and editorial black sections.

### Secondary

- **Signal Layer** (`oklch(0.945 0.035 91.3)`): Responsible-use callouts and selected signal-adjacent surfaces.
- **Verified Green** (`oklch(0.52 0.13 145)`): Confirmed operational success only.
- **Destructive Red** (`oklch(0.55 0.21 27)`): Irreversible action, validation failure, and blocked state only.

### Named Rules

**The Signal Rarity Rule.** Signal Amber occupies no more than ten percent of a product screen. Its scarcity is the point.

**The Neutral Canvas Rule.** Cream, beige, sand, parchment, and paper-tinted application canvases are prohibited. Warmth belongs to the signal, not the background.

**The Semantic State Rule.** Green and red never decorate. They communicate confirmed success or a concrete problem and always appear with text or icon evidence.

## 3. Typography

**Display Font:** Geist with a system sans fallback

**Body Font:** Geist with a system sans fallback
**Label/Mono Font:** Geist Mono for identifiers, counts, timestamps, and tabular numerals

**Character:** A single technical-humanist voice makes the interface disappear into the task. Scale, weight, and spacing create hierarchy; decorative font switching does not.

### Hierarchy

- **Display** (600, `clamp(3rem, 7.8vw, 5.8rem)`, 0.96): Marketing hero and major brand statement only.
- **Headline** (600, `clamp(2.25rem, 5vw, 3rem)`, 1.03): Marketing sections and major empty states.
- **Page title** (600, `1.5rem–1.7rem`, 1.2): Product route identity, kept compact above dense work.
- **Title** (600, `1rem`, 1.25): Panels, drawers, cards, and row groups.
- **Body** (400, `0.875rem–1rem`, 1.5–1.75): Interface copy; prose is capped near 70 characters per line.
- **Label** (500, `0.75rem`, 1.25): Sentence-case field labels, metadata, and column headings. Routine uppercase tracking is forbidden.

### Named Rules

**The One Working Voice Rule.** Product UI uses one sans family. Geist Mono appears only where fixed-width rhythm materially improves scanning.

**The Compact Product Rule.** Display sizes stop at the app shell. Product hierarchy comes from alignment and weight, not oversized dashboard headings.

## 4. Elevation

Athreix is flat by default. Tonal layers, sticky boundaries, and state changes establish depth. Shadows are structural and appear only when a dialog, drawer, popover, command menu, or mobile navigation panel moves above the document.

### Shadow Vocabulary

- **Overlay lift** (`0 8px 24px oklch(0.145 0.006 91.3 / 0.14)`): Dialogs, command menus, dropdowns, and popovers.
- **Lateral drawer lift** (`-8px 0 24px rgb(0 0 0 / 0.18)`): Right-hand lead detail drawer only.

### Named Rules

**The Earned Elevation Rule.** A surface may cast a shadow only after it has moved above another surface in the interaction model.

**The Hairline Structure Rule.** Resting cards and tables use a one-pixel Boundary outline, never a diffuse ambient shadow.

## 5. Components

Controls are restrained and tactile: compact radii, 44-pixel default targets, clear state changes, and 200-millisecond feedback. Every interactive element has hover, focus, active, disabled, loading, and error behavior where relevant.

### Buttons

- **Shape:** Compact curved rectangle (`0.625rem` radius) with a 44-pixel default minimum height.
- **Signal:** Signal Amber with Decision Black text; reserved for public conversion and rare signal-led action.
- **Product primary:** Decision Black with Working White text; the normal authenticated-workspace action.
- **Secondary / ghost:** Quiet Layer or transparent with a Boundary outline; never compete with the primary action.
- **Hover / focus:** A small tonal shift, a one-pixel active translation, and a visible three-pixel focus outline. Loading replaces the leading icon with a reduced-motion-aware spinner.

### Chips

- **Style:** Pill geometry (`9999px`) with compact horizontal padding and 11–12-pixel sentence-case text.
- **State:** Neutral chips use Quiet Layer. Success, warning, info, and danger variants combine semantic text, background, and optional icon; color is never the only cue.

### Cards / Containers

- **Corner Style:** Restrained large curve (`0.875rem` radius).
- **Background:** Working White on light canvas; the dark-theme equivalent on Dark Canvas.
- **Shadow Strategy:** None at rest; use a Boundary outline.
- **Internal Padding:** Usually `1rem–1.5rem`; dense tables use row rhythm instead of nested cards.

### Inputs / Fields

- **Style:** 44-pixel height, Working White fill, Boundary stroke, `0.625rem` radius, 12-pixel horizontal padding.
- **Focus:** Decisive border plus visible ring; never remove the browser-visible focus state without replacement.
- **Error / disabled:** Red border and pale error layer for invalid input; Quiet Layer and reduced opacity for disabled input. Helper text names the problem.

### Navigation

- **Style:** A quiet persistent sidebar at desktop widths and a modal drawer on mobile. Active product routes invert to Decision Black with Working White text and retain an amber current-page dot.
- **Behavior:** Every item has a 44-pixel target, compact label, keyboard focus, and a text-equivalent icon. The command menu provides the same destinations without becoming a second information architecture.

### Prospect Intelligence Table

The signature data view uses a virtualized desktop table and a semantic compact-card alternative on mobile. Selection, score, verification or permission, location, and the next action remain visible without horizontal page overflow. Scores pair a number with a restrained bar; AI rationale and evidence live in the detail drawer.

### Named Rules

**The One Primary Action Rule.** A working surface has one visually dominant next action. Secondary controls recede until context makes them relevant.

**The Evidence Beside Output Rule.** AI scores, drafts, and recommendations never appear without confidence, provenance, permission, or rationale within the same workflow.

## 6. Do's and Don'ts

### Do:

- **Do** keep search intent, audience mode, result scope, credit cost, and next action visible.
- **Do** use Working White, Decision Black, Quiet Layer, and Boundary for almost all product structure.
- **Do** reserve Signal Amber for at most ten percent of a product screen.
- **Do** pair AI conclusions with evidence, freshness, confidence, provenance, and permission state.
- **Do** keep 44-pixel default targets, full keyboard access, visible focus, reduced-motion behavior, and mobile reflow.
- **Do** expose loading, empty, error, disabled, permission-denied, retention-expired, and suppression states honestly.

### Don't:

- **Don't** build generic glassy AI SaaS interfaces with decorative blur, glowing gradients, or floating translucent cards.
- **Don't** reproduce Apollo-style CRM clutter that exposes every control at once.
- **Don't** reproduce Clay-like spreadsheet complexity without progressive disclosure or excellent defaults.
- **Don't** assemble decorative dashboards from repeated metric cards, empty charts, or ornamental motion.
- **Don't** use consumer-data growth hacks that obscure provenance, permission, sensitive attributes, retention, suppression, or deletion rights.
- **Don't** use cream, beige, sand, parchment, or paper-tinted application backgrounds.
- **Don't** use Signal Amber, Verified Green, or Destructive Red as decoration.
- **Don't** simulate a successful mutation, export, share, retry, or save when no authoritative service completed it.
