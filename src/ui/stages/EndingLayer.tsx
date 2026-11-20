// 结局（docs/07 第四节"结局"）。这是简版：印章、净资产、再来一局。
// 现金曲线、最关键的一个决定、纪念海报、同一局再试一次在任务 08 加上。
import { useStore } from "../store/store";
import { endingOf } from "../store/selectors";
import { Stamp } from "../components/base/Stamp";
import { Button } from "../components/base/Button";
import { MoneyText } from "../components/base/MoneyText";
import { zh } from "../../text/zh";

export function EndingLayer() {
  const ui = useStore();
  const e = endingOf(ui);
  if (!e) return null;
  const stamp = e.kind === "goal" ? zh.stamps.gold : e.kind === "survived" ? zh.stamps.survived : e.kind === "bankrupt" ? zh.stamps.bankrupt : zh.stamps.banned;
  const tone = e.kind === "goal" ? "gold" : e.kind === "survived" ? "sea" : "hibiscus";
  return (
    <div className="absolute inset-x-6 bottom-4 z-10 mx-auto flex max-w-content items-center gap-8 rounded-dialog border-2 border-ink bg-paper px-8 py-6 max-md:inset-x-4 max-md:flex-col max-md:gap-4 max-md:px-4">
      <Stamp text={stamp} tone={tone} size="lg" animate />
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-cap text-muted">{zh.ending.netWorth}</span>
        <MoneyText kind="yuan" amount={e.netWorthFen} className="num text-big font-bold" money />
      </div>
      <Button variant="primary" size="lg" onClick={() => ui.startNewGame()}>
        {zh.ending.again}
      </Button>
    </div>
  );
}
