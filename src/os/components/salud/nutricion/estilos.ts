// Nutricion OS — objetos de estilo compartidos (clay, tokens --os-* exclusivamente).
// Mismo patron que os/components/gfit/estilos.ts, propio de este modulo para no
// acoplar Nutricion a otro dominio.
import type { CSSProperties } from 'react';

export const card: CSSProperties = {
  background: 'var(--os-surface)', border: 'none', borderRadius: 'var(--os-r-card)',
  boxShadow: 'var(--os-shadow-card)', padding: '1rem',
};
export const card2: CSSProperties = {
  ...card, background: 'var(--os-surface-2)', boxShadow: 'none', border: '1px solid var(--os-line-soft)',
};
export const input: CSSProperties = {
  background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line)', borderRadius: 'var(--os-r-sm)',
  padding: '9px 11px', fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', fontFamily: 'var(--os-font-body)',
  outline: 'none', width: '100%', minHeight: 40,
};
export const sel: CSSProperties = { ...input };
export const btn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  background: 'var(--os-accent)', color: '#fff', border: 'none', borderRadius: 'var(--os-r-sm)',
  padding: '10px 16px', minHeight: 44, fontSize: 'var(--os-text-sm)', fontFamily: 'var(--os-font-display)', fontWeight: 700,
  cursor: 'pointer', whiteSpace: 'nowrap',
};
export const btnGhost: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  background: 'var(--os-fill-subtle)', color: 'var(--os-text-2)', border: '1px solid var(--os-line)',
  borderRadius: 'var(--os-r-sm)', padding: '9px 13px', minHeight: 40, fontSize: 'var(--os-text-xs)', cursor: 'pointer',
  whiteSpace: 'nowrap',
};
export const btnIcon: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--os-muted)', border: 'none', borderRadius: 'var(--os-r-sm)',
  width: 36, height: 36, cursor: 'pointer', flexShrink: 0,
};
export const btnPlus: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--os-accent)', color: '#fff', border: 'none', borderRadius: 999,
  width: 36, height: 36, cursor: 'pointer', flexShrink: 0, fontSize: 18, lineHeight: 1,
  boxShadow: 'var(--os-shadow-accent)',
};
export const pill = (activo: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  padding: '7px 14px', minHeight: 36, borderRadius: 'var(--os-r-full)',
  fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-xs)', fontWeight: 700, letterSpacing: '0.01em',
  cursor: 'pointer', whiteSpace: 'nowrap', border: 'none', transition: 'background .15s, color .15s',
  background: activo ? 'var(--os-accent)' : 'var(--os-fill-subtle)',
  color: activo ? '#fff' : 'var(--os-text-2)',
  boxShadow: activo ? 'var(--os-shadow-accent)' : 'none',
});
export const chip: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--os-accent-light)',
  background: 'rgba(59,78,217,0.12)', padding: '3px 9px', borderRadius: 'var(--os-r-full)',
  fontFamily: 'var(--os-font-display)', fontWeight: 700, whiteSpace: 'nowrap',
};
export const chipMuted: CSSProperties = {
  ...chip, color: 'var(--os-muted)', background: 'var(--os-fill-subtle)',
};
export const eyebrow: CSSProperties = {
  fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--os-muted)', margin: 0,
};
export const thumb = (size: number): CSSProperties => ({
  width: size, height: size, borderRadius: 14, objectFit: 'cover', flexShrink: 0,
  background: 'var(--os-surface-3)', border: '1px solid var(--os-line-soft)',
});
export const tile = (deshabilitado = false): CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
  padding: '10px 4px', borderRadius: 14, border: '1px solid var(--os-line-soft)',
  background: 'var(--os-surface-2)', cursor: deshabilitado ? 'default' : 'pointer',
  opacity: deshabilitado ? 0.55 : 1, position: 'relative', minHeight: 68,
});
export const tileActivo: CSSProperties = {
  background: 'rgba(59,78,217,0.14)', border: '1px solid var(--os-line-accent)',
};
export const rowItem: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
  borderBottom: '1px solid var(--os-line-soft)',
};
export const numGrande: CSSProperties = {
  fontFamily: 'var(--os-font-rounded)', fontWeight: 800, color: 'var(--os-text)', lineHeight: 1,
};
