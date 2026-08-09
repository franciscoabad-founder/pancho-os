// Field — label + control (input / select / textarea) con estilos os-input.
// Area tactil: la clase .os-input aplica min-height 36px / 44px (coarse).
import type {
  CSSProperties, InputHTMLAttributes, ReactNode,
  SelectHTMLAttributes, TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';

const labelStyle: CSSProperties = {
  display: 'block', marginBottom: 5,
  fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-xs)', fontWeight: 600,
  letterSpacing: '0.04em', color: 'var(--os-muted)',
};
const hintStyle: CSSProperties = {
  margin: '4px 0 0', fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', lineHeight: 1.4,
};
const errorStyle: CSSProperties = { ...hintStyle, color: 'var(--os-error)' };
const controlBase: CSSProperties = { width: '100%' };

interface FieldBase {
  label: string;
  hint?: string;
  error?: string;
  children?: ReactNode;
}

function FieldShell({ label, hint, error, htmlFor, children }: FieldBase & { htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} style={labelStyle}>{label}</label>
      {children}
      {error ? <p style={errorStyle}>{error}</p> : hint ? <p style={hintStyle}>{hint}</p> : null}
    </div>
  );
}

export interface FieldInputProps extends FieldBase, Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {}
export interface FieldSelectProps extends FieldBase, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  children: ReactNode; // <option> elements
}
export interface FieldTextareaProps extends FieldBase, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> {}

export function FieldInput({ label, hint, error, style, ...rest }: FieldInputProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <input id={id} className="os-input" style={{ ...controlBase, ...style }} {...rest} />
    </FieldShell>
  );
}

export function FieldSelect({ label, hint, error, style, children, ...rest }: FieldSelectProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <select id={id} className="os-input" style={{ ...controlBase, ...style }} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

export function FieldTextarea({ label, hint, error, style, ...rest }: FieldTextareaProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <textarea id={id} className="os-input" rows={4} style={{ ...controlBase, resize: 'vertical', ...style }} {...rest} />
    </FieldShell>
  );
}

export default FieldInput;
