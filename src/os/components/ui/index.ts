// Libreria UI compartida del OS. Fase 1 del rediseño: los modulos migran a
// estos componentes en fase 2. Solo tokens --os-*, sin dependencias nuevas.
export { default as PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

export { default as Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { default as Card } from './Card';
export type { CardProps } from './Card';

export { default as EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { default as Spinner } from './Spinner';
export type { SpinnerProps } from './Spinner';

export { FieldInput, FieldSelect, FieldTextarea } from './Field';
export type { FieldInputProps, FieldSelectProps, FieldTextareaProps } from './Field';

export { default as Tabs } from './Tabs';
export type { TabsProps, TabItem } from './Tabs';

export { default as Sheet } from './Sheet';
export type { SheetProps } from './Sheet';

export { default as ConfirmSheet, useConfirm } from './ConfirmSheet';
export type { ConfirmSheetProps, ConfirmOptions } from './ConfirmSheet';

export { ToastProvider, useToast } from './Toast';
export type { ToastKind } from './Toast';

export { default as useResource } from './useResource';
export type { Resource } from './useResource';
