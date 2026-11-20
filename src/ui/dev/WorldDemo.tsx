// 任务 06 第二步的季节演示 ?demo=season-0 到 season-3：整个窗口只放世界（docs/10 第四节）。
// 第三步换成 Stage 里真正的一局（docs/09 第九节的 demo 状态）。
import { useCallback } from "react";
import { WorldCanvas } from "../../scene/WorldCanvas";
import type { Season, WorldView } from "../../scene/world/World";
import { zh } from "../../text/zh";

export function WorldDemo({ season }: { season: Season }) {
  const view: WorldView = {
    season,
    year: 0,
    fulfillment: "local",
    crates: 3,
    shipContainers: 3,
    coins: 3,
    frozen: false,
    gray: "none",
  };
  const fitFor = useCallback((w: number, h: number) => ({ left: 0, top: 0, width: w, height: h }), []);
  return (
    <div className="relative h-full overflow-hidden bg-sea-soft">
      <WorldCanvas view={view} fitFor={fitFor} label={zh.gallery.seasons[season]} />
    </div>
  );
}
