---
name: Ultramarine v5
colors:
  surface: '#071132'
  surface-dim: '#071132'
  surface-bright: '#2f375a'
  surface-container-lowest: '#030b2d'
  surface-container-low: '#10193a'
  surface-container: '#151d3f'
  surface-container-high: '#1f284a'
  surface-container-highest: '#2a3355'
  on-surface: '#dde1ff'
  on-surface-variant: '#c5c5d7'
  inverse-surface: '#dde1ff'
  inverse-on-surface: '#262e50'
  outline: '#8f8fa0'
  outline-variant: '#454654'
  surface-tint: '#bcc2ff'
  primary: '#bcc2ff'
  on-primary: '#00189a'
  primary-container: '#3b4ed9'
  on-primary-container: '#d4d7ff'
  inverse-primary: '#3a4dd8'
  secondary: '#b8c4ff'
  on-secondary: '#1a2b6b'
  secondary-container: '#324283'
  on-secondary-container: '#a2b1fa'
  tertiary: '#e3c380'
  on-tertiary: '#3f2e00'
  tertiary-container: '#745c24'
  on-tertiary-container: '#f7d692'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dfe0ff'
  primary-fixed-dim: '#bcc2ff'
  on-primary-fixed: '#000b62'
  on-primary-fixed-variant: '#1b31c1'
  secondary-fixed: '#dde1ff'
  secondary-fixed-dim: '#b8c4ff'
  on-secondary-fixed: '#001454'
  on-secondary-fixed-variant: '#324283'
  tertiary-fixed: '#ffdf9d'
  tertiary-fixed-dim: '#e3c380'
  on-tertiary-fixed: '#251a00'
  on-tertiary-fixed-variant: '#59440d'
  background: '#071132'
  on-background: '#dde1ff'
  surface-variant: '#2a3355'
  ink: '#0E1738'
  royal: '#1A2B6B'
  ultramarine: '#3B4ED9'
  champagne: '#B5985A'
  linen: '#FAFAF7'
  slate-light: '#E8EAF0'
  bronze: '#8A6F3D'
  ultralight: '#6B7AE8'
typography:
  hero-metric:
    fontFamily: Montserrat
    fontSize: 60px
    fontWeight: '900'
    lineHeight: 64px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Montserrat
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-eyebrow:
    fontFamily: Montserrat
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.14em
  caption:
    fontFamily: Montserrat
    fontSize: 12px
    fontWeight: '300'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 16px
  margin: 24px
---

## Brand & Style

The design system embodies a "Clinical-Premium" editorial aesthetic. It is designed for high-performance individuals who require a dense, information-rich environment that feels authoritative and bespoke. The brand personality is direct, executive, and unapologetically sophisticated, avoiding "creative agency" tropes like gradients or playful roundness.

The visual direction mixes **Minimalism** with a **Corporate/Modern** structural backbone. Hierarchy is established through extreme typographic weight and deliberate color isolation rather than visual noise. It is an operating system for clarity, treating data and numbers as the ultimate "proof" of progress.

## Colors

The palette is anchored by the tension between **Ink** (deep navy) and **Linen** (off-white). The primary accent, **Ultramarine**, is used surgically for interactive elements and focus states. 

**Champagne** is reserved exclusively for "Proof" — metrics, KPIs, and quantitative data. It must never be used for decoration or CTA buttons to maintain its status as a signifier of achievement.

- **Primary (Ultramarine):** Global accent for CTAs, active states, and links.
- **Secondary (Royal):** Elevation surface for cards and sidebars in dark mode.
- **Tertiary (Champagne):** Quantitative data and high-impact metrics.
- **Neutral (Ink):** The foundational canvas for the dark-mode experience.

## Typography

This system uses a single font family to ensure total cohesion. While Gotham is the intended production font, this system maps those weights to **Montserrat** as the highly capable alternative.

Hierarchy is strictly weight-driven. **Black (900)** is used for impact metrics, **Bold (700)** for structural headers, and **Book (400)** for all body text. "Eyebrow" labels use **Medium (500)** with aggressive 14% tracking to create breathing room in dense layouts. Sentence case is used for all UI labels to maintain a grounded, direct tone.

## Layout & Spacing

The design system utilizes a **Fixed Grid** model for desktop to ensure data density remains manageable and legible. The spacing rhythm is based on a strict 4px baseline, ensuring that even in information-dense views, there is a mathematical harmony to the layout.

- **Desktop:** 12-column grid, 1280px max-width, 24px margins.
- **Tablet:** 8-column grid, fluid width, 24px margins.
- **Mobile:** 4-column grid, fluid width, 16px margins.

Content reflow prioritizes "Metric Cards" first, followed by "Priority Stacks." Dense tables reflow into vertical list-cards on mobile.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** rather than shadows. In dark mode, surfaces move from **Ink** (Level 0) to **Royal** (Level 1) to create depth.

A single, extremely diffused shadow is permitted only for floating Dialogs or Popovers to separate them from the interface stack. Borders are primarily low-contrast, utilizing **Slate-Dark** on dark backgrounds to define container edges without adding visual weight.

## Shapes

The shape language is precise and controlled. 

- **Small Controls (4px):** Checkboxes, radio buttons, and small tags.
- **Default (8px):** Standard buttons, input fields, and MetricCards.
- **Large Containers (14px):** Sidebars and main content area panels.
- **Functional Pills:** Used exclusively for status indicators, switches, and progress bars to provide a visual break from the rigid rectangular grid.

## Components

### Sidebar
The navigation anchor. Uses a fixed width (240px) with a `Royal` background. Active states are indicated with an `Ultramarine` left-accent bar (4px) and White text.

### MetricCard (The "Proof" Component)
The core of the dashboard. Background is `Royal`. Large "Hero Numbers" are rendered in `Champagne` (Black 900). Labels are `Linen` (Medium 500) in Uppercase with 0.14em tracking.

### PriorityStack
A dense vertical list of tasks. Each item uses a 1px `Slate-Dark` bottom border. Typography remains Book 400 for tasks, with Bold 700 used only for high-priority flags.

### HabitChecklist
Uses 2px stroke custom icons. Checkboxes are 20px squares with 4px roundedness. The "checked" state is an `Ultramarine` fill with a white 2px stroke checkmark.

### KnowledgeGraph (Cerebro)
A specialized view using node-link diagrams. Nodes are 8px circles in `Ultramarine` or `Champagne` depending on node type. Links are 1px `Slate-Light` strokes at 20% opacity.

### Buttons & Inputs
Buttons use 8px roundedness and `Ultramarine` background for primary actions. Input fields use `Ink` backgrounds with 1px `Slate-Dark` borders, shifting to `Ultramarine` on focus.