// 四个决定弹窗（P1 到 P4）共用的外壳（docs/09 第四节）：说明、参考数字、输入、改了之后的现金计划、提示、"取消"和"就这样定"。
import type { ReactNode } from "react";
import clsx from "clsx";
import { Popup } from "../../components/base/Popup";
import { Button } from "../../components/base/Button";
import { useStore } from "../../store/store";
import { draftPlanOf, type Check, formatRM, formatYuan, type QuarterDecision } from "../../store/selectors";
import { zh } from "../../../text/zh";
import type { Area, PopupName } from "../../store/state";

export function errorText(c: Check): string | null {
  if (!c.error) return null;
  const d = c.error.data;
  const i = zh.input;
  switch (c.error.key) {
    case "restockZeroOrMoq":
      return i.restockZeroOrMoq(String(d.moq));
    case "restockCap":
      return i.restockCap(String(d.cap));
    case "priceRange":
      return i.priceRange(formatRM(d.minSen), formatRM(d.maxSen));
    case "budgetMax":
      return i.budgetMax;
    case "max":
      return i.max(d.fen !== undefined ? formatYuan(d.fen) : formatRM(d.sen));
    case "min":
      return i.min(d.fen !== undefined ? formatYuan(d.fen) : formatRM(d.sen));
    default:
      return null;
  }
}

export function hintTexts(c: Check): string[] {
  return c.hints.map((h) => {
    if (h.key === "hintBid") return zh.input.hintBid;
    if (h.key === "hintQuote") return zh.input.hintQuote;
    if (h.key === "hintBulkShort") return zh.input.hintBulkShort(String(h.data.day), String(h.data.qty), String(h.data.short));
    return "";
  });
}

/** 弹窗的外框：改了之后的现金计划、提示、底部两个按钮 */

export function DecisionShell({
  name,
  area,
  draft,
  checks,
  children,
}: {
  name: Exclude<PopupName, "push" | "bill" | "source" | "desk" | "bulkShort">;
  area: Area;
  draft: Partial<QuarterDecision>;
  checks: Check[];
  children: ReactNode;
}) {
  const ui = useStore();
  const plan = draftPlanOf(ui, draft);
  const hasError = checks.some((c) => c.error);
  const hints = checks.flatMap(hintTexts);
  const worst = plan?.worstEndFen ?? 0;
  const t = zh.popups[name];
  return (
    <Popup
      open={ui.popup === name}
      title={t.title}
      description={t.desc}
      place="mid"
      width="popup"
      testId={name}
      onClose={() => ui.closePopup()}
      footer={
        <>
          <Button onClick={() => ui.closePopup()}>{zh.ui.cancel}</Button>
          <Button variant="confirm" disabled={hasError} onClick={() => ui.setDecision(area, draft)}>
            {zh.ui.confirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {children}
        {plan && (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-control bg-sea-soft px-4 py-2 text-body">
            <span className="text-cap text-muted">{zh.popups.afterChange}</span>
            <span>
              {zh.plan.sureOut} <span className="num font-bold">{formatYuan(plan.sureOutFen)}</span>
            </span>
            <span>
              {zh.plan.worstEnd} <span className={clsx("num font-bold", worst < 0 && "text-hibiscus-text")}>{formatYuan(worst)}</span>
            </span>
          </div>
        )}
        {worst < 0 && <p className="rounded-control bg-gold-soft px-4 py-2 text-body">{zh.plan.warn(formatYuan(-worst))}</p>}
        {hints.map((h) => (
          <p key={h} className="rounded-control bg-gold-soft px-4 py-2 text-body">
            {h}
          </p>
        ))}
      </div>
    </Popup>
  );
}
