import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

const variantClass: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={cn(variantClass[variant], className)} {...props} />;
}
