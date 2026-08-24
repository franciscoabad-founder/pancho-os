# Pancho OS Design System

## Context

Pancho OS is Francisco Abad's personal operating cockpit: a web (desktop + PWA) system where he manages tasks, agenda, health, habits, finances, content, and his second brain, with real data and AI agents (Hermes) reading and writing through MCP. Brand territory: "el constructor con pruebas" — he builds and operates the systems himself, from the inside.

**No codebase, Figma file, or slide deck was attached for this run.** This design system was built from the brand brief given in chat plus Francisco Abad's existing personal-brand guidelines (Ultramarine v5 palette, already in use and confirmed correct in the brief). If a Pancho OS codebase or Figma file exists, attach it and ask for a resync — the component inventory and UI kit here are original, brand-guidelines-only constructions, not a copy of a real product screen.

**Sources used:**
- Chat brief (this conversation): palette, typography direction, tone, "editorial/premium/no glassmorphism" direction.
- Francisco Abad's personal brand guidelines skill (Ultramarine v5): same 11-token palette, logo system, voice rules — reused here as-is since the brief confirmed the palette is already correct.

## Direction

Editorial, deep, premium. Never playful, never "creative agency," never glassmorphism or generic AI gradients. Hierarchy comes from type weight, not color noise. Numbers get their own color (Champagne) so real proof stands out from decoration.

## Content fundamentals

- **Language:** Spanish by default.
- **Voice:** directa, ejecutiva, sin relleno. Primera persona activa cuando hay copy narrativo ("construí", "diseñé", "operé").
- **No emoji.** No em dashes — use periods, commas, colons, or "·".
- **No "no es X, es Y" pattern.** State things affirmatively.
- **Casing:** sentence case for UI labels and headings, not Title Case. Eyebrows/labels use uppercase + letter-spacing, never full sentences.
- **Numbers are proof, not decoration.** A metric ("78%", "+18.000", "12 días") is written with its real unit, never rounded for punch.
- Example, dashboard copy: "Hoy" / "Racha hábitos · 12 días" / "Última sincronización hace 4 minutos vía MCP."

## Visual foundations

- **Color:** Ink (#0E1738) is the default surface, Royal (#1A2B6B) for elevated cards. Ultramarine is the only general accent — CTAs, links, active nav, focus rings. Champagne is reserved exclusively for numbers (metrics, KPIs, credentials); never used decoratively or as a CTA color. Linen, never pure white, as the light-mode base.
- **Type:** Montserrat stands in for Gotham (see Typography note below). Hierarchy by weight: Black 900 for hero impact numbers, Bold 700 for H1/section headers, Medium 500 for labels/eyebrows/nav, Book 400 for body, Light 300 italic for captions/taglines. No serif anywhere.
- **Backgrounds:** flat color only. No photography, no illustration, no texture, no gradients. Full-bleed flat Ink/Royal/Linen fields.
- **Animation:** fast and restrained. 120–200ms, ease-standard cubic-bezier(.4,0,.2,1). Hover shifts color only (Ultramarine → Ultra-light, Champagne → Bronze). No bounce, no scale-on-hover, no glow.
- **Press states:** same color shift, no shrink/scale.
- **Borders:** 0.5–1px, low-opacity white on dark (`rgba(232,234,240,.12)`) or Slate-light on light. Never a colored accent border.
- **Shadows:** soft and infrequent — a single diffuse drop shadow plus a 1px inner highlight on dark cards (`--shadow-card-dark`). No neumorphism, no colored glow shadows.
- **Corner radii:** 4px small controls, 8px default (buttons, inputs, cards), 14px large containers, full pill for tags/switches/progress bars.
- **Transparency/blur:** transparency used only for muted text (45–55% white) and subtle borders. No backdrop-blur, no glassmorphism, anywhere.
- **Layout:** generous whitespace over density. Sidebar navigation with a persistent left rail on app surfaces; content in a single scrolling column with card grids, never packed edge-to-edge.
- **Cards:** flat elevated surface (Royal on Ink, or White on Linen), 8–14px radius, soft shadow, 1px low-opacity border. No colored left-border accent stripe.

## Typography

Gotham is wired and self-hosted from `fonts/` via `tokens/fonts.css` (weights 100–900, roman + italic). Montserrat remains loaded from Google Fonts as the documented fallback only — it is not the primary family.


## Iconography

No icon assets, icon font, or SVG set were provided in the brief. **No CDN icon set has been linked yet** — the UI kit avoids icons entirely rather than hand-drawing them or guessing a system. If Pancho OS uses a specific icon library (Lucide, Phosphor, Material Symbols, a custom SVG set), tell me which and I'll wire it in and document exact usage here. Emoji are never used per brand voice rules.

## Logo

No logo file was provided in this project. The wordmark is rendered typographically wherever a mark would go: "FRANCISCO" in ExtraLight 200 at low opacity next to "ABAD" in Black 900 in Ultramarine — matching the construction spec in Francisco Abad's personal brand guidelines. If logo PNGs exist (`assets/logos/` per the personal-brand skill), attach them here and I'll swap the typographic wordmark for the real files.

## Index

- `styles.css` — root entry, imports all tokens.
- `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css` — CSS custom properties.
- `guidelines/*.card.html` — foundation specimens (Colors, Type, Spacing, Brand groups) shown in the Design System tab.
- `components/forms/` — Button, Input, Select, Checkbox, Switch.
- `components/feedback/` — Badge, Tooltip, Dialog.
- `components/navigation/` — Tabs.
- `components/data/` — Card, MetricCard, ProgressBar.
- `ui_kits/pancho-os/` — click-through recreation of the Pancho OS cockpit (Hoy / Tareas / Hábitos & Salud / Finanzas).
- `thumbnail.html` — project tile.
- `SKILL.md` — Claude Code-compatible skill wrapper.

### Intentional additions

No source enumerated a component inventory (no codebase/Figma attached), so the set above is the standard primitive set sized to Pancho OS's stated modules (tasks, habits, finance, agenda). `MetricCard` and `ProgressBar` were added beyond a bare-minimum set because KPI/habit-percentage display is central to the product's premise.

## Caveats — please help me iterate

1. **No codebase or Figma was attached.** Everything here — the component set and the UI kit — is an original construction from the brand brief, not a copy of a real Pancho OS screen. If a real codebase/Figma exists, attach it and I'll rebuild the UI kit to match it exactly.
2. **No icon system was specified** — the kit currently ships with zero icons rather than guessing. Tell me which icon library (or attach the app's own icon set) and I'll wire it in.
3. **No logo file was provided** — the wordmark is typographic only. Attach the real logo PNGs if they exist.
