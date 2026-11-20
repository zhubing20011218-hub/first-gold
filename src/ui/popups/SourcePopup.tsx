// P7 数字从哪来（docs/09 第四节、任务 08 第一节第 8 条）：最上面是 docs/07 第 6.5 节的三句话和"怎么玩"；
// 下面把公开的参数分两组列出来（来自真实经营、设计值）；再下面是算法说明，每个不超过五行加一个例子。
// 参数从参数表里读，例子用模型算，不另外抄一份。
import type { ReactNode } from "react";
import { Popup } from "../components/base/Popup";
import { useStore } from "../store/store";
import { paramGroupsOf, paramValueText, params as P, sourceExamplesOf, formatRM, formatYuan } from "../store/selectors";
import { zh } from "../../text/zh";

function Algo({ title, lines, example }: { title: string; lines: string[]; example: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h4 className="text-body font-bold">{title}</h4>
      <ul className="flex list-disc flex-col gap-1 pl-6 text-body">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="rounded-control bg-sea-soft px-3 py-2 text-cap">
        <span className="font-bold">{zh.source.exampleLabel}</span> {example}
      </p>
    </section>
  );
}

function Group({ title, rows }: { title: string; rows: { name: string; note: string; value: string }[] }): ReactNode {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-em font-bold">{title}</h3>
      {rows.map((r) => (
        <div key={r.name} className="flex items-start justify-between gap-3 border-b border-line py-1 text-cap">
          <span className="min-w-0">{r.note}</span>
          <span className="num shrink-0 font-bold">{r.value}</span>
        </div>
      ))}
    </section>
  );
}

export function SourcePopup() {
  const ui = useStore();
  const goal = formatYuan(P.goalNetWorthFen.value);
  const groups = paramGroupsOf();
  const ex = sourceExamplesOf();
  const v = (p: Parameters<typeof paramValueText>[0]): string => paramValueText(p);
  const t = zh.source;
  const bp = (x: number): string => `${(x / 100).toFixed(0)}%`;
  const pushX = ((P.pushBaseBp.value + 80 * P.pushPerPointBp.value) / 10000).toFixed(2);
  const deposit = formatYuan(Math.floor((100000 * P.bulkDepositBp.value) / 10000));
  const penalty = formatYuan(Math.floor((100000 * P.bulkPenaltyBp.value) / 10000));
  return (
    <Popup open={ui.popup === "source"} title={zh.popups.source.title} description={zh.popups.source.desc} place="side" width="popup-source" testId="source" onClose={() => ui.closePopup()}>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1 rounded-control bg-gold-soft px-4 py-3 text-body">
          {zh.honest.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <section>
          <h3 className="pb-2 text-em font-bold">{zh.howTo.title}</h3>
          <ol className="flex list-decimal flex-col gap-1 pl-6 text-body">
            {zh.howTo.steps(goal).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
        <Group title={t.real} rows={groups.real} />
        <Group title={t.design} rows={groups.design} />
        <section className="flex flex-col gap-3">
          <h3 className="text-em font-bold">{t.algoTitle}</h3>
          <Algo
            title={t.order.title}
            lines={t.order.lines(v(P.crossCommissionBp), v(P.localCommissionBp), v(P.transactionFeeBp), v(P.platformFixedFeeSen), v(P.crossSstBp), v(P.localPlatformShippingBp), String(P.crossSettleDays.value), String(P.localSettleDays.value))}
            example={t.order.example(formatRM(ex.priceSen), formatRM(ex.order.totalFeeSen), formatRM(ex.order.payoutSen), formatYuan(ex.order.payoutFen), formatYuan(ex.costFen), formatYuan(ex.forwarderFen), formatYuan(ex.profitFen))}
          />
          <Algo title={t.push.title} lines={t.push.lines(t.push.times((P.pushBaseBp.value / 10000).toFixed(2)), t.push.times((P.pushPerPointBp.value / 10000).toFixed(2)))} example={t.push.example(pushX)} />
          <Algo title={t.ads.title} lines={t.ads.lines(bp(P.adShareAtMidBp.value))} example={t.ads.example(bp(P.adShareAtMidBp.value))} />
          <Algo title={t.bulk.title} lines={t.bulk.lines(v(P.bulkRepStepBp), v(P.bulkDepositBp), String(P.bulkBalanceDays.value), v(P.bulkPenaltyBp))} example={t.bulk.example(deposit, penalty)} />
          <Algo title={t.storage.title} lines={t.storage.lines(v(P.storageSenPerCbmDay), v(P.agedStorageSenPerCbmDay))} example={t.storage.example(String(ex.volumeCm3), formatYuan(ex.storage.feeFen))} />
          <Algo
            title={t.risk.title}
            lines={t.risk.lines(v(P.riskStartPts), v(P.riskQuarterMinPts), v(P.riskQuarterMaxPts), v(P.riskHighPts), v(P.auditFreezeDays), v(P.complianceCostFen), v(P.compliancePts))}
            example={t.risk.example(v(P.riskHighPts), v(P.complianceCostFen), `${P.riskHighPts.value - P.compliancePts.value} ${P.riskHighPts.unit}`)}
          />
        </section>
      </div>
    </Popup>
  );
}
