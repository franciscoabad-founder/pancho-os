Button for actions and navigation. Use `primary` (Ultramarine) for the one primary action per view; `secondary`/`ghost` for lower-emphasis actions on dark surfaces; `metric` (Champagne) only when the button itself represents committing/confirming a number, never as a general CTA color.

```jsx
<Button variant="primary" size="md">Guardar</Button>
<Button variant="ghost" size="sm">Cancelar</Button>
```

Variants: primary, secondary, ghost, metric. Sizes: sm, md, lg. `disabled` fades to 45% opacity, no color change.
