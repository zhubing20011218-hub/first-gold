// 小标签（docs/09 第 3.1 节）："听采购的""自己定"、季节、风险等级、状态
import clsx from "clsx";

export type TagTone = "sea" | "ink" | "gold" | "hibiscus" | "muted" | "purchase" | "ops" | "finance";

export function Tag({ text, tone = "ink" }: { text: string; tone?: TagTone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 text-cap font-bold whitespace-nowrap",
        tone === "sea" && "bg-sea text-paper",
        tone === "ink" && "bg-ink text-paper",
        tone === "gold" && "bg-gold-soft text-gold-text",
        tone === "hibiscus" && "bg-hibiscus text-paper",
        tone === "muted" && "bg-disabled-bg text-muted",
        tone === "purchase" && "bg-area-purchase text-paper",
        tone === "ops" && "bg-area-ops text-ink",
        tone === "finance" && "bg-area-finance text-paper",
      )}
    >
      {text}
    </span>
  );
}
