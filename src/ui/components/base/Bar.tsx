// 一条横条（docs/09 第 3.1 节）：推流分五项、商品的五个评分
import clsx from "clsx";

export interface BarProps {
  label: string;
  value: number;
  max: number;
  tone?: "sea" | "gold" | "hibiscus";
  showValue?: boolean;
}

export function Bar({ label, value, max, tone = "sea", showValue = true }: BarProps) {
  const filled = Math.max(0, Math.min(max, value));
  return (
    <div className="flex items-center gap-2" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span className="w-20 shrink-0 text-cap text-muted">{label}</span>
      <span className="flex h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-paper">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={clsx("h-full flex-1", i < filled && (tone === "sea" ? "bg-sea" : tone === "gold" ? "bg-gold" : "bg-hibiscus"))} />
        ))}
      </span>
      {showValue && <span className="num w-6 shrink-0 text-right text-body">{value}</span>}
    </div>
  );
}
