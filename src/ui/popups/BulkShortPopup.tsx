// P9 大单货不够（docs/07 第 6.8 节、docs/04 第十六节）：播放停在这一天，必须选一项才继续，不能直接关掉。
import { Popup } from "../components/base/Popup";
import { useStore } from "../store/store";
import { bulkShortOf, formatYuan } from "../store/selectors";
import { zh } from "../../text/zh";

export function BulkShortPopup() {
  const ui = useStore();
  const d = bulkShortOf(ui);
  if (!d) return null;
  const t = zh.bulkShort;
  const option = (label: string, note: string, extra: string | null, onClick: () => void, testId: string) => (
    <button
      type="button"
      data-option={testId}
      onClick={onClick}
      className="flex flex-col gap-1 rounded-control border-2 border-ink bg-paper px-4 py-3 text-left shadow-solid-sm transition-transform hover:bg-sea-soft active:translate-y-1 active:shadow-none"
    >
      <span className="text-em font-bold">{label}</span>
      <span className="text-cap text-muted">{note}</span>
      {extra && <span className="text-cap font-bold text-hibiscus-text">{extra}</span>}
    </button>
  );
  return (
    <Popup
      open={ui.popup === "bulkShort"}
      title={t.title}
      description={t.desc(String(d.day + 1), String(d.qty), String(d.short))}
      place="center"
      width="popup-short"
      dismissible={false}
      testId="bulkShort"
      onClose={() => undefined}
    >
      <div className="flex flex-col gap-3">
        {option(
          t.rush(String(d.rush.qty)),
          t.rushNote(formatYuan(d.rush.unitCostFen), formatYuan(d.rush.totalFen), String(d.rush.leadDays)),
          d.cashAfterFen < 0 ? t.rushCash(formatYuan(d.cashAfterFen)) : null,
          () => ui.answerBulkShort("rush"),
          "rush",
        )}
        {option(t.ignore, t.ignoreNote(formatYuan(d.depositFen), formatYuan(d.penaltyFen)), null, () => ui.answerBulkShort("ignore"), "ignore")}
      </div>
    </Popup>
  );
}
