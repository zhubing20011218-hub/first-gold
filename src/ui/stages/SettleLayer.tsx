// 结算（docs/07 第四节"结算时"）：播放结束后自动打开季度报表（P6）。确认报表之后，功能区重新展开，
// "这个季度的决定"一行换成"计划和实际"；右下的主要按钮亮起来。
// 确认之后要再看报表，从财务的工作台（P8）里打开（docs/09 第四节）。
import { useState } from "react";
import clsx from "clsx";
import { useStore } from "../store/store";
import { financeOf, reportOf, stockOf, formatYuan } from "../store/selectors";
import { AreaPanel } from "../components/biz/AreaPanel";
import { CashPlanBar } from "../components/biz/CashPlanBar";
import { MoneyText } from "../components/base/MoneyText";
import { zh } from "../../text/zh";
import type { Area } from "../store/state";

export function SettleLayer() {
  const ui = useStore();
  const [tab, setTab] = useState<Area>("purchase");
  const report = reportOf(ui);
  const stock = stockOf(ui);
  const fin = financeOf(ui);
  if (!report || !stock || !fin) return null;
  const pva = report.planVsActual;
  const s = zh.settle;
  const a = zh.area;
  const plan = (text: string) => [{ label: s.planVsActual, value: null, note: text }];
  const blocked = ui.billConfirmed ? null : zh.plan.billFirst;
  return (
    <div className="absolute inset-x-6 bottom-4 z-10 mx-auto flex max-w-content flex-col gap-4 max-md:inset-x-4">
      <div role="tablist" className="hidden gap-2 max-md:flex">
        {(["purchase", "ops", "finance"] as Area[]).map((ar) => (
          <button key={ar} type="button" role="tab" aria-selected={tab === ar} onClick={() => setTab(ar)} className={clsx("min-h-hit flex-1 rounded-control border-2 border-ink text-em font-bold", tab === ar ? "bg-sea-text text-paper" : "bg-paper")}>
            {zh.areas[ar]}
          </button>
        ))}
      </div>
      <div data-region="areas" className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <div className={clsx(tab !== "purchase" && "max-md:hidden")}>
          <AreaPanel
            area="purchase"
            state="set"
            onOpenDesk={() => ui.openDesk("purchase")}
            rows={[
              { label: a.stock, value: `${stock.stock.toLocaleString("en-US")} ${zh.status.piece}` },
              { label: a.restockOnWay, value: `${stock.restockOnWay.toLocaleString("en-US")} ${zh.status.piece}` },
            ]}
            reference={null}
            actions={plan(s.planOut(formatYuan(pva.planOutFen), formatYuan(pva.actualOutFen)))}
          />
        </div>
        <div className={clsx(tab !== "ops" && "max-md:hidden")}>
          <AreaPanel
            area="ops"
            state="set"
            onOpenDesk={() => ui.openDesk("ops")}
            rows={[
              { label: zh.play.orders, value: report.result.retailShipped.toLocaleString("en-US") },
              { label: zh.play.lost, value: report.result.lost.toLocaleString("en-US") },
            ]}
            reference={null}
            actions={plan(s.ads(formatYuan(pva.adsMaxFen), formatYuan(pva.actualAdsFen)))}
          />
        </div>
        <div className={clsx(tab !== "finance" && "max-md:hidden")}>
          <AreaPanel
            area="finance"
            state="set"
            onOpenDesk={() => ui.openDesk("finance")}
            rows={[
              { label: a.moneyOnWay, value: <MoneyText kind="yuan" amount={fin.moneyOnWayFen} money /> },
              { label: zh.play.cash, value: <MoneyText kind="yuan" amount={report.endCashFen} money /> },
            ]}
            reference={null}
            actions={plan(s.worst(formatYuan(pva.worstEndFen), formatYuan(pva.actualEndFen)))}
          />
        </div>
      </div>
      <CashPlanBar plan={ui.plan} canProceed={ui.billConfirmed} blockedReason={blocked} label={zh.plan.next} primary={ui.billConfirmed} onNext={() => ui.nextQuarter()} />
    </div>
  );
}
