// ?debug=1 角落的小面板（docs/13 第四节）：现金等式和页面自检。有不通过的就变红，点开能看到是哪一项、哪个元素。
// 什么时候重新查：换阶段、开关弹窗、窗口大小变化；播放时每秒一次。
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useStore } from "../store/store";
import { debugCashOf, formatYuan } from "../store/selectors";
import { runSelfcheck, type CheckResult } from "./selfcheck";
import { zh } from "../../text/zh";

export function DebugPanel() {
  const ui = useStore();
  const cash = debugCashOf(ui);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const run = (): void => setChecks(runSelfcheck());
    // 等这一帧画完再查
    const t = window.setTimeout(run, 50);
    window.addEventListener("resize", run);
    const timer = ui.stage === "play" ? window.setInterval(run, 1000) : undefined;
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", run);
      if (timer) window.clearInterval(timer);
    };
  }, [ui.stage, ui.popup]);

  const pass = checks.filter((c) => c.pass).length;
  const allOk = (cash?.ok ?? true) && pass === checks.length;
  return (
    <div data-debug className={clsx("fixed bottom-2 left-2 z-50 flex max-w-80 flex-col gap-1 rounded-control border-2 px-3 py-2 text-cap shadow-solid-sm", allOk ? "border-ink bg-paper" : "border-hibiscus bg-paper")}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-h-hit-desk items-center gap-3 text-left font-bold">
        <span className={cash?.ok === false ? "text-hibiscus-text" : ""}>
          {zh.debug.cash} {cash ? (cash.ok ? zh.debug.ok : zh.debug.bad) : "-"}
        </span>
        <span className={pass < checks.length ? "text-hibiscus-text" : ""}>{zh.debug.selfcheck(pass, checks.length)}</span>
      </button>
      {open && cash && (
        <span className="num">
          {formatYuan(cash.startFen)} + {formatYuan(cash.sumFen)} = {formatYuan(cash.startFen + cash.sumFen)} / {formatYuan(cash.cashFen)}
        </span>
      )}
      {open &&
        checks
          .filter((c) => !c.pass)
          .map((c) => (
            <span key={c.id} className="text-hibiscus-text">
              {`${c.id} ${c.offenders.join(" / ")}`}
            </span>
          ))}
    </div>
  );
}
