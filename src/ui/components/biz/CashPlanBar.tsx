// 底部的现金计划和主要按钮（docs/07 第四节、docs/06 第三节）
import clsx from "clsx";
import { type CashPlan, formatYuan } from "../../store/selectors";
import { Button } from "../base/Button";
import { MoneyText } from "../base/MoneyText";
import { Explain } from "../base/Explain";
import { zh } from "../../../text/zh";

export interface CashPlanBarProps {
  plan: CashPlan | null;
  canProceed: boolean;
  blockedReason: string | null;
  label: string;
  onNext: () => void;
  primary: boolean;
}

export function CashPlanBar({ plan, canProceed, blockedReason, label, onNext, primary }: CashPlanBarProps) {
  const p = zh.plan;
  const items: { label: string; fen: number; sign: string; explain?: string }[] = plan
    ? [
        { label: p.start, fen: plan.startFen, sign: "" },
        { label: p.sureOut, fen: plan.sureOutFen, sign: "−" },
        { label: p.adsMax, fen: plan.adsMaxFen, sign: "−" },
        { label: p.sureIn, fen: plan.sureInFen, sign: "+", explain: zh.explain.sureIn },
      ]
    : [];
  const worst = plan?.worstEndFen ?? 0;
  return (
    <div data-region="plan" className="flex h-bar items-stretch gap-4 max-md:h-auto max-md:flex-col max-md:gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-4 rounded-control border-2 border-ink bg-paper px-4 max-md:py-1 xl:gap-6 xl:px-6">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col max-md:hidden">
            <span className="text-cap text-muted">
              {it.explain ? <Explain text={it.explain}>{it.label}</Explain> : it.label}
            </span>
            <span className="num text-em font-bold xl:text-title">
              {it.sign}
              <MoneyText kind="yuan" amount={it.fen} />
            </span>
          </div>
        ))}
        {plan && (
          <div className="flex min-w-0 flex-1 flex-col border-l-2 border-line pl-4 max-md:border-l-0 max-md:pl-0 xl:pl-6">
            <span className="text-cap text-muted">
              <Explain text={zh.explain.worstEnd}>{p.worstEnd}</Explain>
            </span>
            {/* 付不起时的那句提示在决定弹窗里（docs/09 第五节），这里只把数字标红 */}
            <span className={clsx("num text-em font-bold xl:text-title", worst < 0 && "text-hibiscus-text")}>{formatYuan(worst)}</span>
          </div>
        )}
      </div>
      <div className="flex w-80 flex-col items-stretch justify-center max-md:w-auto xl:w-popup-short">
        <Button variant={primary ? "primary" : "normal"} size="lg" disabled={!canProceed} onClick={onNext}>
          {label}
        </Button>
        <span className="text-center text-cap text-muted">{canProceed ? (plan ? p.expected(formatYuan(plan.sureOutFen)) : "") : blockedReason}</span>
      </div>
    </div>
  );
}
