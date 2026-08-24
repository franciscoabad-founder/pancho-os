export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "metric";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}
