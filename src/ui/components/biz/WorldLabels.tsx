// 世界里的小牌子（docs/10 第五节最后一段）：网页元素，位置由 3D 里的点换算到屏幕上。
// 互相不重叠，也不盖住前排的功能区：被挡住的就不显示。
import type { LabelAnchors } from "../../../scene/world/World";
import { formatYuan } from "../../store/selectors";
import { zh } from "../../../text/zh";

export interface WorldLabelsProps {
  anchors: LabelAnchors | null;
  data: { goodsOnWay: number; moneyOnWayFen: number; stock: number; stockout: boolean } | null;
  /** 小牌子不能低于这条线（前排的顶边） */
  floorY: number;
}

export function WorldLabels({ anchors, data, floorY }: WorldLabelsProps) {
  if (!anchors) return null;
  const items: { key: string; x: number; y: number; text: string; tone: "ink" | "paper" | "gold" | "warn" }[] = [];
  if (data) {
    if (data.goodsOnWay > 0) items.push({ key: "ship", ...anchors.ship, text: zh.world.shipGoods(data.goodsOnWay.toLocaleString("en-US")), tone: "paper" });
    if (data.moneyOnWayFen > 0) items.push({ key: "money", ...anchors.money, text: zh.world.money(formatYuan(data.moneyOnWayFen)), tone: "gold" });
    items.push(data.stockout ? { key: "stockout", ...anchors.stockout, text: zh.world.stockout, tone: "warn" } : { key: "stock", ...anchors.stock, text: zh.world.stock(data.stock.toLocaleString("en-US")), tone: "paper" });
  }
  items.push(
    { key: "supplier", ...anchors.supplier, text: zh.world.supplier, tone: "ink" },
    { key: "warehouse", ...anchors.warehouse, text: zh.world.warehouse, tone: "ink" },
    { key: "buyers", ...anchors.buyers, text: zh.world.buyers, tone: "paper" },
  );
  // 估计每个小牌子的大小（12 像素的字，左右各 12 的边），和已经放下的重叠就不放（docs/10 第五节）
  const placed: { x: number; y: number; w: number }[] = [];
  const shown = items.filter((it) => {
    if (it.y >= floorY - 24 || it.y <= 64) return false;
    const w = [...it.text].length * 12 + 28;
    const hit = placed.some((p) => Math.abs(p.x - it.x) < (p.w + w) / 2 + 4 && Math.abs(p.y - it.y) < 30);
    if (hit) return false;
    placed.push({ x: it.x, y: it.y, w });
    return true;
  });
  return (
    <div className="pointer-events-none absolute inset-0 z-5" aria-hidden="true">
      {shown.map((it) => (
          <span
            key={it.key}
            data-world-label={it.key}
            className={
              it.tone === "ink"
                ? "absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink px-3 py-1 text-cap font-bold whitespace-nowrap text-paper"
                : it.tone === "gold"
                  ? "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold bg-gold-soft px-3 py-1 text-cap font-bold whitespace-nowrap text-gold-text"
                  : it.tone === "warn"
                    ? "absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-hibiscus-text px-3 py-1 text-cap font-bold whitespace-nowrap text-paper"
                    : "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-paper px-3 py-1 text-cap font-bold whitespace-nowrap"
            }
            style={{ left: it.x, top: it.y }}
          >
            {it.text}
          </span>
        ))}
    </div>
  );
}
