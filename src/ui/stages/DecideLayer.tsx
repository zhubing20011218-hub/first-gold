// 做决定（docs/07 第四节）：三个功能区和底部的现金计划。每个决定只有一个入口：功能区里的"改"。
import { useState } from "react";
import clsx from "clsx";
import { useStore } from "../store/store";
import { areaStatesOf, canProceed, financeOf, lastQuarterOf, planOf, productOf, referenceOf, stockOf, timelineOf, formatRM, formatYuan } from "../store/selectors";
import { AreaPanel } from "../components/biz/AreaPanel";
import { CashPlanBar } from "../components/biz/CashPlanBar";
import { MoneyText } from "../components/base/MoneyText";
import { Explain } from "../components/base/Explain";
import { ReminderChip } from "../components/biz/ReminderChip";
import { CoachMark } from "../components/base/CoachMark";
import { zh } from "../../text/zh";
import type { Area } from "../store/state";

export function DecideLayer() {
  const ui = useStore();
  const [tab, setTab] = useState<Area>("purchase");
  const product = productOf(ui);
  const ref = referenceOf(ui);
  const stock = stockOf(ui);
  const fin = financeOf(ui);
  const last = lastQuarterOf(ui);
  const plan = planOf(ui);
  const states = areaStatesOf(ui);
  const q = timelineOf(ui).quarter;
  if (!product || !ref || !stock || !fin || !ui.game) return null;
  const d = ui.decision;
  const a = zh.area;
  const stateOf = (area: Area) => states.find((s) => s.area === area) ?? { area, state: "notSet" as const, later: false };
  const reminderFor = (area: Area) => {
    const r = ui.reminders.find((x) => x.area === area);
    return r ? <ReminderChip reminder={r} /> : undefined;
  };
  const quotes = d.bulkQuotes;
  const hasInquiry = ui.game.schedule.inquiries.some((i) => i.quarter === q);
  const local = ui.game.fulfillment === "local";
  const riskValue = local ? (d.buyCompliance ? a.riskValue.compliance : a.riskValue.none) : d.upgradeToLocal ? a.riskValue.upgrade : a.riskValue.noUpgrade;
  const blocked = canProceed(ui) ? null : zh.plan.blocked;
  const coach = q === 0 && !ui.popup ? ui.coachStep : 0;

  return (
    <div className="absolute inset-x-6 bottom-4 z-10 mx-auto flex max-w-content flex-col gap-4 max-md:inset-x-4">
      <div role="tablist" className="hidden gap-2 max-md:flex">
        {(["purchase", "ops", "finance"] as Area[]).map((ar) => (
          <button key={ar} type="button" role="tab" aria-selected={tab === ar} onClick={() => setTab(ar)} className={clsx("min-h-hit flex-1 rounded-control border-2 border-ink text-em font-bold", tab === ar ? "bg-sea-text text-paper" : "bg-paper")}>
            {zh.areas[ar]}
          </button>
        ))}
      </div>
      {/* 新手提示（docs/07 第 6.6 节）：只在第一个季度出现，第 1 条指向世界，第 2 条指向三个功能区，第 3 条指向底部的现金计划 */}
      <CoachMark open={coach === 1} text={zh.coach.tips[0]} step={1} total={3} onNext={() => ui.nextCoach()} side="top">
        <span className="pointer-events-none absolute -top-12 left-1/2 h-px w-px" aria-hidden />
      </CoachMark>
      <CoachMark open={coach === 2} text={zh.coach.tips[1]} step={2} total={3} onNext={() => ui.nextCoach()} side="top">
      <div data-region="areas" className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <div className={clsx(tab !== "purchase" && "max-md:hidden")}>
          <AreaPanel
            area="purchase"
            state={stateOf("purchase").state}
            reminder={reminderFor("purchase")}
            onOpenDesk={() => ui.openDesk("purchase")}
            rows={[
              { label: a.stock, value: `${stock.stock.toLocaleString("en-US")} ${zh.status.piece}${stock.reserved > 0 ? zh.paren(a.reserved(String(stock.reserved))) : ""}` },
              { label: a.restockOnWay, value: `${stock.restockOnWay.toLocaleString("en-US")} ${zh.status.piece}` },
            ]}
            reference={
              <Explain text={zh.explain.expMonthly}>
                {a.expMonthly(String(ref.expMonthly))}
                {zh.dot}
                {a.stockDays(String(ref.stockDays))}
              </Explain>
            }
            actions={[{ label: zh.popups.restockQty, value: d.monthlyRestockQty === 0 ? a.noRestock : a.restockValue(String(d.monthlyRestockQty)), onChange: () => ui.openPopup("stock") }]}
          />
        </div>
        <div className={clsx(tab !== "ops" && "max-md:hidden")}>
          <AreaPanel
            area="ops"
            state={stateOf("ops").state}
            reminder={reminderFor("ops")}
            onOpenDesk={() => ui.openDesk("ops")}
            rows={[
              { label: a.lastQuarter, value: last ? a.lastQuarterValue(String(last.wanted), String(last.lost)) : a.noData },
              {
                label: a.refPrice,
                value: (
                  <>
                    {formatRM(ref.refPriceSen)}
                    {zh.dot}
                    <Explain text={zh.explain.rivalBid}>{`${a.rivalBid} ${formatYuan(ref.refBidFen)}`}</Explain>
                  </>
                ),
              },
            ]}
            reference={null}
            actions={[
              {
                label: a.retail,
                value: a.retailValue(formatRM(d.priceSen), formatYuan(d.adBidFen), formatYuan(d.adDailyBudgetFen)),
                onChange: () => ui.openPopup("retail"),
              },
              {
                label: a.bulk,
                value: quotes.length === 0 ? a.bulkNone : a.bulkValue(String(quotes.length), formatRM(quotes[0].unitPriceSen)),
                onChange: () => ui.openPopup("bulk"),
                note: q === 0 ? a.later : hasInquiry ? undefined : a.noInquiry,
              },
            ]}
          />
        </div>
        <div className={clsx(tab !== "finance" && "max-md:hidden")}>
          <AreaPanel
            area="finance"
            state={stateOf("finance").state}
            reminder={reminderFor("finance")}
            onOpenDesk={() => ui.openDesk("finance")}
            rows={[
              { label: <Explain text={zh.explain.moneyOnWay}>{a.moneyOnWay}</Explain>, value: <MoneyText kind="yuan" amount={fin.moneyOnWayFen} money /> },
              { label: a.sureIn, value: <MoneyText kind="yuan" amount={fin.sureInFen} money /> },
            ]}
            reference={local ? `${a.riskLabel} ${zh.status.riskLevel[fin.risk ?? "low"]}` : `${a.upgradeCost} ${formatYuan(ref.upgradeCostFen)}`}
            actions={[{ label: zh.popups.risk.title, value: riskValue, onChange: () => ui.openPopup("risk"), note: stateOf("finance").later ? a.later : undefined }]}
          />
        </div>
      </div>
      </CoachMark>
      <CoachMark open={coach === 3} text={zh.coach.tips[2]} step={3} total={3} onNext={() => ui.nextCoach()} side="top">
      <div>
      <CashPlanBar
        plan={plan}
        canProceed={canProceed(ui)}
        blockedReason={blocked}
        label={zh.plan.next}
        primary
        onNext={() => ui.startQuarterPlay()}
      />
      </div>
      </CoachMark>
    </div>
  );
}
