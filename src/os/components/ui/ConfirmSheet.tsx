// ConfirmSheet — reemplazo de window.confirm() nativo. Construido sobre Sheet:
// mismo overlay/cierre por Escape/click fuera, footer con Button ghost (cancelar)
// y Button primary/danger (confirmar). Usar via el hook useConfirm() de abajo:
// no instanciar ConfirmSheet directo en cada pantalla, evita repetir el estado open/onConfirm.
import { useCallback, useRef, useState } from 'react';
import Sheet from './Sheet';
import Button from './Button';

export interface ConfirmSheetProps {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo coral (#D4537E) para el boton de confirmar; usar en acciones irreversibles. */
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmSheet({
  open,
  title,
  text,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      maxWidth={420}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {text && (
        <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', margin: 0, lineHeight: 1.5 }}>
          {text}
        </p>
      )}
    </Sheet>
  );
}

export interface ConfirmOptions {
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/**
 * Hook de conveniencia: reemplaza `if (!window.confirm(...)) return;` por
 * `if (!(await confirm({ title, text, danger }))) return;`. Renderizar `{sheet}`
 * una vez en la raiz del componente (o del componente hijo donde se llama confirm,
 * ver FilaComida.tsx: Sheet ya trae su propio overlay/z-index, no requiere estar
 * en la raiz de la isla).
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOptions(null);
    resolverRef.current?.(true);
    resolverRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    setOptions(null);
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  const sheet = (
    <ConfirmSheet
      open={options !== null}
      title={options?.title ?? ''}
      text={options?.text}
      confirmLabel={options?.confirmLabel}
      cancelLabel={options?.cancelLabel}
      danger={options?.danger}
      onConfirm={handleConfirm}
      onClose={handleClose}
    />
  );

  return { confirm, sheet };
}
