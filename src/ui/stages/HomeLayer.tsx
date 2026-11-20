// 首页（docs/07 第三节）：标题、一句话、开始经营、本地最好成绩（任务 08）、页脚三句话
import { Button } from "../components/base/Button";
import { useStore } from "../store/store";
import { useState } from "react";
import { formatYuan } from "../store/selectors";
import { readBest } from "../app/bestScore";
import { zh } from "../../text/zh";

export function HomeLayer() {
  const start = useStore((s) => s.startNewGame);
  // 本地最好成绩：每种商品的最高净资产（读不到就不显示）
  const [best] = useState(() => Object.entries(readBest()).sort((a, b) => b[1] - a[1]));
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-between px-4 py-8">
      <div />
      <div className="flex flex-col items-center gap-6 rounded-dialog border-2 border-ink bg-paper px-12 py-8 text-center max-md:px-6">
        <h1 className="text-hero font-bold">{zh.title}</h1>
        <p className="max-w-popup text-title text-muted">{zh.subtitle}</p>
        <Button variant="primary" size="lg" onClick={start}>
          {zh.startButton}
        </Button>
        {best.length > 0 && (
          <ul className="flex flex-col gap-1 text-body text-muted">
            {best.slice(0, 3).map(([id, fen]) => (
              <li key={id}>{`${zh.products[id]?.name ?? id}${zh.dot}${zh.ui.bestScore(formatYuan(fen))}`}</li>
            ))}
          </ul>
        )}
      </div>
      <ul className="flex flex-col items-center gap-1 rounded-control bg-paper px-4 py-2 text-cap text-muted">
        {zh.honest.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  );
}
