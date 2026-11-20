// 显示件数、单数、天数、分数（docs/08 第六节）。可以带变化量，放在括号里
import clsx from "clsx";
import { zh } from "../../../text/zh";

export interface NumberTextProps {
  value: number;
  unit?: string;
  delta?: number;
  warn?: boolean;
  className?: string;
  /** 变化量的额外样式（例如手机上不显示） */
  deltaClassName?: string;
}

export function NumberText({ value, unit, delta, warn = false, className, deltaClassName }: NumberTextProps) {
  return (
    <span className={clsx("num whitespace-nowrap", warn && "text-hibiscus-text", className)}>
      {value.toLocaleString("en-US")}
      {unit && <span className="ml-1 font-sans text-cap text-muted">{unit}</span>}
      {delta !== undefined && delta !== 0 && (
        <span className={clsx("ml-1 text-cap", delta < 0 ? "text-hibiscus-text" : "text-sea-text", deltaClassName)}>
          {zh.paren(`${delta > 0 ? "+" : "-"}${Math.abs(delta)}`)}
        </span>
      )}
    </span>
  );
}
