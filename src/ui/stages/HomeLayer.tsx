// 首页（docs/07 第三节）：标题、一句话、开始经营、页脚三句话
import { Button } from "../components/base/Button";
import { useStore } from "../store/store";
import { zh } from "../../text/zh";

export function HomeLayer() {
  const start = useStore((s) => s.startNewGame);
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-between px-4 py-8">
      <div />
      <div className="flex flex-col items-center gap-6 rounded-dialog border-2 border-ink bg-paper px-12 py-8 text-center max-md:px-6">
        <h1 className="text-hero font-bold">{zh.title}</h1>
        <p className="max-w-popup text-title text-muted">{zh.subtitle}</p>
        <Button variant="primary" size="lg" onClick={start}>
          {zh.startButton}
        </Button>
      </div>
      <ul className="flex flex-col items-center gap-1 rounded-control bg-paper px-4 py-2 text-cap text-muted">
        {zh.honest.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  );
}
