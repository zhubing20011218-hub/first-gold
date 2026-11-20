// P5 推流分：五项和变化（docs/09 第四节）
import { Popup } from "../components/base/Popup";
import { Bar } from "../components/base/Bar";
import { useStore } from "../store/store";
import { pushOf } from "../store/selectors";
import { zh } from "../../text/zh";

export function PushPopup() {
  const ui = useStore();
  if (!ui.game) return null;
  const push = pushOf(ui.game);
  const parts = [push.sales, push.stock, push.price, push.complete, push.speed];
  return (
    <Popup open={ui.popup === "push"} title={zh.popups.push.title} description={zh.popups.push.desc} place="top-right" width="popup-push" testId="push" onClose={() => ui.closePopup()}>
      <div className="flex flex-col gap-2">
        {Object.entries(zh.popups.pushItems).map(([k, label], i) => (
          <Bar key={k} label={label} value={parts[i]} max={20} />
        ))}
        <p className="pt-2 text-em font-bold">{zh.popups.pushTotal(String(push.total))}</p>
        <p className="text-body text-muted">{zh.popups.pushFactor((push.pushBp / 10000).toFixed(2))}</p>
      </div>
    </Popup>
  );
}
