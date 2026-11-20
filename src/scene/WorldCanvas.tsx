// 把 three.js 的世界接进 React（docs/12 第二节）。只做三件事：创建画布、把要画的东西交给世界、卸载时释放资源。
import { useEffect, useRef, useState } from "react";
import { World, webglAvailable, type FitRect, type LabelAnchors, type WorldView } from "./world/World";
import { WorldFallback } from "./fallback/WorldFallback";

export interface WorldCanvasProps {
  view: WorldView;
  /** 给世界留的区域，按窗口大小算 */
  fitFor: (width: number, height: number) => FitRect;
  /** 小牌子的位置跟着 3D 里的点 */
  onAnchors?: (a: LabelAnchors) => void;
  label: string;
  /** 放在一个盒子里（展示页），大小跟着盒子，不跟着窗口 */
  contained?: boolean;
}

declare global {
  interface Window {
    __worldReady?: boolean;
    __worldSample?: () => string[];
  }
}

export function WorldCanvas({ view, fitFor, onAnchors, label, contained = false }: WorldCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const [failed, setFailed] = useState(() => !webglAvailable());
  const viewRef = useRef(view);
  viewRef.current = view;
  const fitRef = useRef(fitFor);
  fitRef.current = fitFor;
  const anchorsRef = useRef(onAnchors);
  anchorsRef.current = onAnchors;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || failed) return undefined;
    let world: World;
    try {
      world = new World(canvas, {
        mobile: window.innerWidth < 1024,
        reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
    } catch {
      setFailed(true);
      return undefined;
    }
    worldRef.current = world;
    const size = (): void => {
      const box = contained ? canvas.parentElement : null;
      const w = box ? box.clientWidth : window.innerWidth;
      const h = box ? box.clientHeight : window.innerHeight;
      world.resize(w, h, fitRef.current(w, h));
      world.setView(viewRef.current);
      anchorsRef.current?.(world.labelAnchors());
    };
    size();
    world.start();
    void world.ready.then(() => {
      window.__worldReady = true;
      window.__worldSample = () => world.sampleColors();
    });
    window.addEventListener("resize", size);
    const ro = contained && canvas.parentElement ? new ResizeObserver(size) : null;
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
    return () => {
      window.removeEventListener("resize", size);
      ro?.disconnect();
      world.dispose();
      worldRef.current = null;
      window.__worldReady = false;
    };
  }, [failed, contained]);

  // 只在要画的东西真的变了的时候重画（view 每次都是新对象，按内容比较）
  const viewKey = JSON.stringify(view);
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.setView(viewRef.current);
    anchorsRef.current?.(world.labelAnchors());
  }, [viewKey]);

  useEffect(() => {
    if (failed) window.__worldReady = true;
  }, [failed]);

  if (failed) return <WorldFallback label={label} />;
  return <canvas ref={ref} role="img" aria-label={label} className="absolute inset-0 z-0 block h-full w-full" />;
}
