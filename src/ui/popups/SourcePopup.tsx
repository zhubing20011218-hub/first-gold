// P7 数字从哪来（docs/09 第四节）
import { Popup } from "../components/base/Popup";
import { Tag } from "../components/base/Tag";
import { useStore } from "../store/store";
import { params as P, formatYuan } from "../store/selectors";
import { zh } from "../../text/zh";

export function SourcePopup() {
  const ui = useStore();
  const goal = formatYuan(P.goalNetWorthFen.value);
  const rows = Object.entries(P).filter(([, p]) => p.public);
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
        <section className="flex flex-col gap-1">
          {rows.map(([name, p]) => (
            <div key={name} className="flex items-start justify-between gap-3 border-b border-line py-1 text-cap">
              <span className="min-w-0">{p.note}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="num">{Array.isArray(p.value) ? p.value.join(" / ") : String(p.value)}</span>
                <Tag text={zh.popups.sourceLevel[p.source]} tone={p.source === "C" ? "muted" : "sea"} />
              </span>
            </div>
          ))}
        </section>
      </div>
    </Popup>
  );
}
