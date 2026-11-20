// 顶部的胶囊（docs/09 第 3.1 节）：可以点的有厚度，只显示的没有
import clsx from "clsx";
import type { ReactNode } from "react";

export interface PillProps {
  children: ReactNode;
  onClick?: () => void;
  tone?: "paper" | "soft" | "warn";
  label?: string;
  className?: string;
}

export function Pill({ children, onClick, tone = "paper", label, className }: PillProps) {
  const cls = clsx(
    "inline-flex h-topbar items-center gap-2 rounded-full border-2 border-ink px-4 whitespace-nowrap",
    tone === "paper" && "bg-paper",
    tone === "soft" && "bg-gold-soft",
    tone === "warn" && "bg-paper text-hibiscus-text",
    className,
  );
  if (onClick) {
    return (
      <button type="button" aria-label={label} onClick={onClick} className={clsx(cls, "shadow-solid-sm transition-transform active:translate-y-1 active:shadow-none hover:bg-sea-soft")}>
        {children}
      </button>
    );
  }
  return (
    <div className={cls} aria-label={label}>
      {children}
    </div>
  );
}
