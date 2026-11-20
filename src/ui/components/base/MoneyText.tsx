// 显示钱（docs/08 第六节）：人民币、林吉特、售价。负数自动变红，负号放最前面
import clsx from "clsx";
import { zh } from "../../../text/zh";
import { formatRM, formatYuan } from "../../store/selectors";

export interface MoneyTextProps {
  kind: "yuan" | "rm" | "price";
  /** yuan 时是分；rm 和 price 时是仙 */
  amount: number;
  /** price 时，后面用小一号的字写的人民币（分） */
  yuanFen?: number;
  /** 白底上表示钱的文字用 goldText */
  money?: boolean;
  className?: string;
}

export function MoneyText({ kind, amount, yuanFen, money = false, className }: MoneyTextProps) {
  const negative = amount < 0;
  const text = kind === "yuan" ? formatYuan(amount) : formatRM(amount);
  return (
    <span className={clsx("num whitespace-nowrap", negative ? "text-hibiscus-text" : money && "text-gold-text", className)}>
      {text}
      {kind === "price" && yuanFen !== undefined && <span className="ml-1 text-cap text-muted">{zh.paren(formatYuan(yuanFen))}</span>}
    </span>
  );
}
