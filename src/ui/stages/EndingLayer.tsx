// 结局（docs/07 第四节"结局"、任务 08）：世界定格。中间偏左是结果的印章和净资产；
// 右边一栏是现金曲线、最关键的一个决定（和"如果当时"）、两年的几个总数、纪念海报的小图；
// 底部是"同一局再试一次""保存纪念海报""再来一局"，种子编号在角落。只写事实和数字（docs/07 第 6.1 节）。
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "../store/store";
import { endingOf, formatYuan, type EndingKind } from "../store/selectors";
import { Stamp } from "../components/base/Stamp";
import { Button } from "../components/base/Button";
import { MoneyText } from "../components/base/MoneyText";
import { CashCurve } from "../components/biz/CashCurve";
import { PosterCanvas, type PosterHandle } from "../components/biz/PosterCanvas";
import type { PosterData } from "../components/biz/posterDraw";
import { saveBest } from "../app/bestScore";
import { zh } from "../../text/zh";

const STAMP: Record<EndingKind, { text: string; tone: "gold" | "sea" | "hibiscus" }> = {
  goal: { text: zh.stamps.gold, tone: "gold" },
  survived: { text: zh.stamps.survived, tone: "sea" },
  bankrupt: { text: zh.stamps.bankrupt, tone: "hibiscus" },
  banned: { text: zh.stamps.banned, tone: "hibiscus" },
};

export function EndingLayer() {
  const ui = useStore();
  const e = endingOf(ui);
  const poster = useRef<PosterHandle>(null);

  // 本地最好成绩：结局一出来就记下（读写失败不报错）。?demo= 的演示局不算
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).has("demo");
    if (e && !demo) saveBest(e.productId, e.netWorthFen);
  }, [e?.productId, e?.netWorthFen]);

  const t = zh.ending;
  const data = useMemo<PosterData | null>(() => {
    if (!e) return null;
    const h = zh.poster.headline;
    const headline = e.kind === "goal" ? h.goal : e.kind === "survived" ? h.survived(formatYuan(e.goalFen - e.netWorthFen)) : e.kind === "bankrupt" ? h.bankrupt : h.banned;
    return {
      ending: e.kind,
      fillBp: e.poster.fillBp,
      overflow: e.poster.overflow,
      cashCurve: e.curve,
      text: {
        title: zh.title,
        subtitle: `${zh.products[e.productId].name}${zh.dot}${zh.setup.fulfillment[e.fulfillment]}`,
        headline,
        stamp: STAMP[e.kind].text,
        netWorth: formatYuan(e.netWorthFen),
        fromTo: zh.poster.fromTo(formatYuan(e.startFen), formatYuan(e.netWorthFen)) + (e.kind === "goal" ? zh.poster.multiple((e.poster.multipleE1 / 10).toFixed(1)) : ""),
        stats: [
          { label: zh.poster.retail, value: zh.poster.orders(e.totals.retail.toLocaleString("en-US")) },
          { label: zh.poster.bulk, value: zh.poster.bulks(String(e.totals.bulkDelivered)) },
          { label: zh.poster.key, value: e.key ? zh.poster.quarterName(e.key.quarter + 1) : "-" },
        ],
        footer: zh.footer,
        seed: zh.poster.seed(String(e.seed)),
        goalLabel: zh.poster.goalLabel,
      },
    };
  }, [e?.kind, e?.netWorthFen, e?.key, e?.curve]);

  if (!e || !data) return null;
  const line =
    e.kind === "goal" ? t.line.goal(formatYuan(e.startFen), formatYuan(e.netWorthFen)) : e.kind === "survived" ? t.line.survived(formatYuan(e.goalFen - e.netWorthFen)) : t.line[e.kind]();
  const s = STAMP[e.kind];
  return (
    <div className="absolute inset-x-6 top-ending bottom-4 z-10 mx-auto flex max-w-content flex-col gap-4 max-md:inset-x-4 max-md:top-auto max-md:max-h-setup-m">
      <div className="grid min-h-0 flex-1 grid-cols-2 items-end gap-4 max-md:grid-cols-1 max-md:overflow-y-auto">
        {/* 中间偏左：印章、一句话、净资产 */}
        <section className="flex flex-col gap-3 self-end rounded-dialog border-2 border-ink bg-paper px-6 py-6 max-md:px-4">
          <div className="self-start">
            <Stamp text={s.text} tone={s.tone} size="lg" animate />
          </div>
          <p className="text-title font-bold">{line}</p>
          <div className="flex flex-col">
            <span className="text-cap text-muted">{t.netWorth}</span>
            <MoneyText kind="yuan" amount={e.netWorthFen} className="num text-big font-bold" money />
          </div>
        </section>
        {/* 右边一栏 */}
        <section className="flex flex-col gap-3 rounded-dialog border-2 border-ink bg-paper px-6 py-4 max-md:px-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-body font-bold">{t.curve}</h3>
            <CashCurve curve={e.curve} lowIndex={e.low?.index ?? null} keyQuarter={e.key?.quarter ?? null} gray={e.kind === "bankrupt"} className="h-24 w-full" />
            {e.low && <span className="text-cap text-muted">{t.low(String(e.low.index + 1), formatYuan(e.low.cashFen))}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-body font-bold">
              {t.keyTitle}
              {e.key && <span className="ml-2 text-gold-text">{t.key(String(e.key.quarter + 1))}</span>}
            </h3>
            <p className="text-cap text-muted">
              {e.key ? t.ifThen(String(e.key.quarter + 1), formatYuan(e.key.referenceNetWorthFen), formatYuan(e.key.playerNetWorthFen)) : t.noKey}
            </p>
          </div>
          <div className="flex items-end gap-4">
            <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-cap">
              <dt className="text-muted">{t.retail}</dt>
              <dd className="num font-bold">{t.orders(e.totals.retail.toLocaleString("en-US"))}</dd>
              <dt className="text-muted">{t.lost}</dt>
              <dd className="num font-bold">{t.orders(e.totals.lost.toLocaleString("en-US"))}</dd>
              <dt className="text-muted">{t.bulk}</dt>
              <dd className="num font-bold">{t.bulks(String(e.totals.bulkDelivered))}</dd>
              <dt className="text-muted">{t.ads}</dt>
              <dd className="num font-bold">{formatYuan(e.totals.adsFen)}</dd>
              <dt className="text-muted">{t.lowQuarter}</dt>
              <dd className="num font-bold">{t.quarterName(String(e.totals.lowQuarter + 1))}</dd>
            </dl>
            <PosterCanvas ref={poster} data={data} label={t.save} className="w-24 shrink-0 rounded-control border-2 border-ink" />
          </div>
        </section>
      </div>
      <div className="flex items-center gap-3 max-md:flex-col max-md:items-stretch">
        <span className="flex-1 text-cap text-muted">{t.seed(String(e.seed))}</span>
        <Button variant="normal" onClick={() => ui.retrySameSeed()}>
          {t.retry}
        </Button>
        <Button variant="normal" onClick={() => poster.current?.save(`first-gold-${e.seed}.png`)}>
          {t.save}
        </Button>
        <Button variant="primary" size="lg" onClick={() => ui.startNewGame()}>
          {t.again}
        </Button>
      </div>
    </div>
  );
}
