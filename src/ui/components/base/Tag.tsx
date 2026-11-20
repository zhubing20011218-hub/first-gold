// 小标签（docs/09 第 3.1 节）：功能区的状态（还没定、已定、沿用上季度）、季节、风险等级、每件事的状态。
// 2 像素 ink 边框的胶囊，12 号字（docs/07 第四节，规则包第 12 版）。小字的底色和字色都满足 4.5 比 1（docs/08 第五节）。
import clsx from "clsx";

export type TagTone =
  | "notSet"
  | "set"
  | "carried"
  | "sea"
  | "ink"
  | "gold"
  | "hibiscus"
  | "muted"
  | "purchase"
  | "ops"
  | "finance";

export function Tag({ text, tone = "ink" }: { text: string; tone?: TagTone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border-2 border-ink px-2 text-cap font-bold whitespace-nowrap",
        (tone === "notSet" || tone === "gold") && "bg-gold-soft text-gold-text",
        (tone === "set" || tone === "sea") && "bg-sea-soft text-sea-text",
        (tone === "carried" || tone === "muted") && "bg-paper text-muted",
        tone === "ink" && "bg-ink text-paper",
        tone === "hibiscus" && "bg-hibiscus-text text-paper",
        tone === "purchase" && "bg-sea-text text-paper",
        tone === "ops" && "bg-area-ops text-ink",
        tone === "finance" && "bg-area-finance text-paper",
      )}
    >
      {text}
    </span>
  );
}
