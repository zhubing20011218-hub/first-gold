// 三个功能区的小图标（docs/10 第一节）：纸箱、手机、计算器。自己画的 SVG
import { areaColor, color } from "../../theme/tokens";
import type { Area } from "../../store/state";

const tint: Record<Area, string> = { purchase: areaColor.purchase, ops: areaColor.ops, finance: areaColor.finance };

export function AreaIcon({ area }: { area: Area }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6" fill={tint[area]} stroke={color.ink} strokeWidth="2" />
      {area === "purchase" && (
        <g fill={color.paper} stroke={color.ink} strokeWidth="1.5">
          <rect x="6" y="8" width="12" height="9" />
          <path d="M6 8 l3 -3 h6 l3 3 M12 5 v3" fill="none" />
        </g>
      )}
      {area === "ops" && (
        <g fill={color.paper} stroke={color.ink} strokeWidth="1.5">
          <rect x="8" y="5" width="8" height="14" rx="1.5" />
          <path d="M10 14 l2 -3 l1.5 1.5 l2 -3" fill="none" />
        </g>
      )}
      {area === "finance" && (
        <g fill={color.paper} stroke={color.ink} strokeWidth="1.5">
          <rect x="7" y="5" width="10" height="14" rx="1.5" />
          <rect x="9" y="7" width="6" height="3" fill={color.seaSoft} />
          <path d="M9.5 13 h1 M13.5 13 h1 M9.5 16 h1 M13.5 16 h1" />
        </g>
      )}
    </svg>
  );
}
