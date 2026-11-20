// 播放（docs/07 第四节"播放时"、docs/12 第四节"播放的做法"）：模型已经算好，界面用 6 秒把这些天放出来。
// 三个功能区收起成一行数字，有提醒时在这一块的上方冒出小牌子；右下的主要按钮换成"跳过"（不是金色）。
import { useEffect } from "react";
import clsx from "clsx";
import { useStore } from "../store/store";
import { playNumbersOf, playProgressOf, playRemindersOf, formatYuan } from "../store/selectors";
import { Button } from "../components/base/Button";
import { AreaIcon } from "../components/biz/AreaIcon";
import { ReminderChip } from "../components/biz/ReminderChip";
import { zh } from "../../text/zh";
import type { Area } from "../store/state";

/** 一个季度放 6 秒（docs/07 第四节） */
const QUARTER_MS = 6000;

export function PlayLayer() {
  const ui = useStore();
  const progress = playProgressOf(ui);
  const nums = playNumbersOf(ui);
  const reminders = playRemindersOf(ui);
  const running = ui.stage === "play" && ui.popup === null && !ui.playPaused;
  const total = progress?.total ?? 90;

  // 播放的钟：打开弹窗时自动暂停，关上后继续（docs/09 第四节第 6 条）
  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => useStore.getState().tickPlay(1), Math.round(QUARTER_MS / Math.max(1, total)));
    return () => window.clearInterval(id);
  }, [running, total]);

  if (!progress || !nums) return null;
  const p = zh.play;
  const cells: Record<Area, [string, string][]> = {
    purchase: [
      [p.stock, `${nums.stock.toLocaleString("en-US")} ${zh.status.piece}`],
      [p.goods, `${nums.goods.toLocaleString("en-US")} ${zh.status.piece}`],
    ],
    ops: [
      [p.orders, nums.orders.toLocaleString("en-US")],
      [p.lost, nums.lost.toLocaleString("en-US")],
      [p.ads, formatYuan(nums.adsFen)],
    ],
    finance: [
      [p.cash, formatYuan(nums.cashFen)],
      [p.paid, formatYuan(nums.paidFen)],
    ],
  };
  return (
    <div className="absolute inset-x-6 bottom-4 z-10 mx-auto flex max-w-content flex-col gap-4 max-md:inset-x-4">
      <div data-region="areas" className="grid grid-cols-3 gap-4 max-md:grid-cols-1 max-md:gap-2">
        {(["purchase", "ops", "finance"] as Area[]).map((area) => {
          const r = reminders.find((x) => x.area === area);
          return (
            <section key={area} data-area={area} aria-label={zh.areas[area]} className="relative flex min-w-0 items-center gap-3 rounded-control border-2 border-ink bg-paper px-4 py-3 max-md:py-2">
              {r && (
                <div data-reminder className="absolute -top-3 left-4 z-15 -translate-y-full max-md:hidden">
                  <ReminderChip reminder={r} />
                </div>
              )}
              <span className="flex shrink-0 items-center gap-2 text-em font-bold">
                <AreaIcon area={area} />
                <span className="max-md:sr-only">{zh.areas[area]}</span>
              </span>
              <dl className="flex min-w-0 flex-1 flex-wrap justify-end gap-x-4">
                {cells[area].map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-1">
                    <dt className="text-cap text-muted">{k}</dt>
                    <dd className="num text-em font-bold whitespace-nowrap">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
      <div data-region="plan" className="flex h-bar items-stretch gap-4 max-md:h-auto">
        <div className="flex min-w-0 flex-1 items-center gap-4 rounded-control border-2 border-ink bg-paper px-6 max-md:px-4">
          <span className="text-em font-bold whitespace-nowrap">{p.day(String(progress.day), String(progress.total))}</span>
          <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-ink bg-sea-soft" aria-hidden>
            <div className={clsx("h-full bg-sea")} style={{ width: `${Math.min(100, (progress.day / progress.total) * 100)}%` }} />
          </div>
        </div>
        <div className="flex w-80 flex-col justify-center max-md:w-auto xl:w-popup-short">
          <Button variant="normal" size="lg" onClick={() => ui.skipPlay()}>
            {p.skip}
          </Button>
        </div>
      </div>
    </div>
  );
}
