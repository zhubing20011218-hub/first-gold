// 展示页里世界的那一栏：切换四个季节、跨境直发和本土店、库存的少中多
import { useCallback, useState } from "react";
import { WorldCanvas } from "../../scene/WorldCanvas";
import type { Season, WorldView } from "../../scene/world/World";
import { Button } from "../components/base/Button";
import { Segmented } from "../components/base/Segmented";
import { zh } from "../../text/zh";

const TIERS: { crates: WorldView["crates"]; ship: WorldView["shipContainers"]; coins: number }[] = [
  { crates: 1, ship: 0, coins: 1 },
  { crates: 3, ship: 3, coins: 3 },
  { crates: 6, ship: 7, coins: 6 },
];

export function GalleryWorld() {
  const [season, setSeason] = useState<Season>(0);
  const [fulfillment, setFulfillment] = useState<"cross" | "local">("local");
  const [tier, setTier] = useState(1);
  const view: WorldView = {
    season,
    year: 0,
    fulfillment,
    crates: TIERS[tier].crates,
    shipContainers: TIERS[tier].ship,
    coins: TIERS[tier].coins,
    frozen: false,
    gray: "none",
  };
  const fitFor = useCallback((w: number, h: number) => ({ left: 0, top: 0, width: w, height: h }), []);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {zh.gallery.seasons.map((s, i) => (
          <Button key={s} variant={season === i ? "confirm" : "normal"} onClick={() => setSeason(i as Season)}>
            {s}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <Segmented
          label={zh.setup.step2}
          value={fulfillment}
          onChange={setFulfillment}
          options={[
            { value: "cross", label: zh.setup.fulfillment.cross },
            { value: "local", label: zh.setup.fulfillment.local },
          ]}
        />
        <Segmented
          label={zh.status.stock}
          value={String(tier) as "0" | "1" | "2"}
          onChange={(v) => setTier(Number(v))}
          options={zh.gallery.stockTiers.map((t, i) => ({ value: String(i) as "0" | "1" | "2", label: t }))}
        />
      </div>
      <div className="relative h-gallery-world overflow-hidden rounded-control border-2 border-ink">
        <WorldCanvas view={view} fitFor={fitFor} label={zh.gallery.world} contained />
      </div>
    </div>
  );
}
