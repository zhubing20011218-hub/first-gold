// 不支持 3D 时的静态图（docs/10 第七节）：两块地、海、三个地点（供应商、仓库、买家）的简单图形和名字
import { color, world } from "../../ui/theme/tokens";
import { zh } from "../../text/zh";

export function WorldFallback({ label }: { label: string }) {
  // 地名是盖在图上的网页文字（不是 SVG 里的字），手机上也不会缩到 12 像素以下（docs/08 第四节）
  const names: [string, number, number][] = [
    [zh.world.supplier, 415 / 1440, 150 / 520],
    [zh.world.warehouse, 1040 / 1440, 190 / 520],
    [zh.world.buyers, 1180 / 1440, 300 / 520],
  ];
  return (
    <div className="absolute inset-0 z-0 flex items-start justify-center" role="img" aria-label={label} data-world-fallback>
      {/* 外层按图的比例：宽最多 1362（高 492），名字的百分比位置就和图上的地点对得上 */}
      <div className="relative aspect-fallback w-full max-w-fallback" data-fallback-map>
        <svg viewBox="0 0 1440 520" preserveAspectRatio="xMidYMid meet" className="block h-full w-full" aria-hidden>
          <rect width="1440" height="520" fill={world.season[0].sky} />
          <polygon points="180,300 760,40 1260,260 680,520" fill={world.seaWater} />
          <polygon points="200,250 470,130 640,205 370,325" fill={world.sand} stroke={color.ink} strokeWidth="2" />
          <polygon points="800,300 1100,170 1260,240 960,370" fill={world.myGrass} stroke={color.ink} strokeWidth="2" />
          <rect x="380" y="170" width="70" height="50" fill={world.wall} stroke={color.ink} strokeWidth="2" />
          <rect x="660" y="250" width="90" height="30" rx="6" fill={world.shipHull} />
          <rect x="1000" y="215" width="80" height="45" fill={world.wall} stroke={color.ink} strokeWidth="2" />
          <rect x="1000" y="205" width="80" height="12" fill={world.roof} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={1130 + i * 34} y={268 - i * 14} width="26" height="20" fill={world.wall} stroke={color.ink} strokeWidth="2" />
              <polygon points={`${1127 + i * 34},${268 - i * 14} ${1143 + i * 34},${254 - i * 14} ${1159 + i * 34},${268 - i * 14}`} fill={world.houseRoof[i]} stroke={color.ink} strokeWidth="2" />
            </g>
          ))}
          <path d="M1080 360 Q 700 470 380 330" fill="none" stroke={color.gold} strokeWidth="4" strokeDasharray="10 8" />
        </svg>
        {names.map(([text, x, y]) => (
          <span
            key={text}
            className="absolute -translate-x-1/2 -translate-y-full rounded-full bg-paper px-2 text-cap font-bold whitespace-nowrap"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            data-fx={x}
            data-fy={y}
          >
            {text}
          </span>
        ))}
      </div>
      <p className="sr-only">{zh.world.fallback}</p>
    </div>
  );
}
