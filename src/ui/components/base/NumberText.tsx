// 显示件数、单数、天数、分数（docs/08 第六节）。可以带变化量，放在括号里
import clsx from "clsx";
import { zh } from "../../../text/zh";

export interface NumberTextProps {
  value: number;
  unit?: string;
  delta?: number;
  warn?: boolean;
  className?: string;
}

export function NumberText({ value, unit, delta, warn = false, className }: NumberTextProps) {
  return (
    <span className={clsx("num whitespace-nowrap", warn && "text-hibiscus", className)}>
      {value.toLocaleString("en-US")}
      {unit && <span className="ml-1 font-sans text-cap text-muted">{unit}</span>}
      {delta !== undefined && delta !== 0 && (
        <span className={clsx("ml-1 text-cap", delta < 0 ? "text-hibiscus" : "text-sea")}>
          {zh.paren(`${delta > 0 ? "+" : "-"}${Math.abs(delta)}`)}
        </span>
      )}
    </span>
  );
}
