// 功能区上方的提醒（docs/07 第 6.7 节）
import { type Reminder, formatYuan } from "../../store/selectors";
import { zh } from "../../../text/zh";

/** 把提醒里的数字排成文字要用的样子 */
function textOf(r: Reminder): string {
  const d: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.data)) d[k] = k.endsWith("Fen") ? formatYuan(v) : String(v);
  d.amount = d.amountFen ?? "";
  d.cash = d.cashFen ?? "";
  d.short = d.shortQty ?? "";
  if (r.key === "riskLevel") d.level = r.data.level === 2 ? zh.status.riskLevel.high : zh.status.riskLevel.mid;
  const f = zh.reminders[r.key];
  return f ? f(d) : "";
}

export function ReminderChip({ reminder }: { reminder: Reminder }) {
  return (
    <span role="status" className="inline-block rounded-full border-2 border-ink bg-gold-soft px-3 py-1 text-cap font-bold whitespace-nowrap">
      {textOf(reminder)}
    </span>
  );
}
