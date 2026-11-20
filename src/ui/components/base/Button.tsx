// 按钮（docs/09 第 3.1 节）：主要（金色，全屏只有一个）、确认（青色）、普通（白色）、文字
import clsx from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "confirm" | "normal" | "text";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "lg";
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "normal", size = "md", className, disabled, children, ...rest },
  ref,
) {
  const solid = variant !== "text";
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      data-primary={variant === "primary" && !disabled ? "" : undefined}
      className={clsx(
        "inline-flex min-h-hit items-center justify-center gap-2 font-bold whitespace-nowrap select-none md:min-h-hit-desk",
        size === "lg" ? "px-6 py-3 text-title" : "px-4 py-2 text-em",
        solid && "rounded-control border-2",
        solid && !disabled && "border-ink shadow-solid transition-transform duration-100 active:translate-y-1 active:shadow-none",
        disabled && solid && "border-disabled-text bg-disabled-bg text-disabled-text shadow-none",
        !disabled && variant === "primary" && "bg-gold text-ink hover:brightness-105",
        !disabled && variant === "confirm" && "bg-sea text-paper hover:brightness-110",
        !disabled && variant === "normal" && "bg-paper text-ink hover:bg-sea-soft",
        variant === "text" && "rounded-control px-2 text-sea underline-offset-4 hover:underline disabled:text-disabled-text",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
