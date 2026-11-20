// 展示页里"每一样模型"那一栏：docs/10 第三节清单里的模型一格一样，下面写名字；可以切换四个季节
import { useEffect, useRef, useState } from "react";
import { ModelShelf, SHELF_ITEMS, type ShelfSeason } from "../../scene/world/ModelShelf";
import { webglAvailable } from "../../scene/world/World";
import { Button } from "../components/base/Button";
import { zh } from "../../text/zh";

const TILE_W = 200;
const TILE_H = 150;

export function GalleryShelf() {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const shelfRef = useRef<ModelShelf | null>(null);
  const [season, setSeason] = useState<ShelfSeason>(0);
  // 不能用 WebGL 时不创建渲染器（three.js 会往控制台报错），这一栏只写一句说明（docs/10 第七节）
  const [can3d] = useState(() => webglAvailable());

  useEffect(() => {
    if (!can3d) return undefined;
    try {
      shelfRef.current = new ModelShelf(TILE_W, TILE_H);
    } catch {
      shelfRef.current = null;
    }
    return () => {
      shelfRef.current?.dispose();
      shelfRef.current = null;
    };
  }, [can3d]);

  useEffect(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;
    SHELF_ITEMS.forEach((_, i) => {
      const c = canvases.current[i];
      if (c) shelf.draw(i, c, season);
    });
  }, [season]);

  if (!can3d) return <p className="text-body text-muted">{zh.world.fallback}</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {zh.gallery.seasons.map((s, i) => (
          <Button key={s} variant={season === i ? "confirm" : "normal"} onClick={() => setSeason(i as ShelfSeason)}>
            {s}
          </Button>
        ))}
      </div>
      <ul className="grid grid-cols-6 gap-3 max-md:grid-cols-2" data-gallery-shelf>
        {SHELF_ITEMS.map((item, i) => (
          <li key={item.id} className="flex flex-col items-center gap-1 rounded-control border-2 border-ink bg-paper p-2">
            <canvas
              ref={(el) => {
                canvases.current[i] = el;
              }}
              className="aspect-4/3 w-full rounded-control"
              aria-hidden
            />
            <span className="text-center text-cap font-bold">{zh.gallery.modelNames[item.id] ?? item.id}</span>
            <span className="text-cap text-muted">{item.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
