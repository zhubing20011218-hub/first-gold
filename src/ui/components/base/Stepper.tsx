// 输入数字，带加减按钮（docs/09 第 3.1 节、第五节）。超出范围时不自动改成边界值，而是显示出错
import clsx from "clsx";
import { useId } from "react";
import { zh } from "../../../text/zh";

export interface StepperProps {
  label: string;
  /** 显示用的值（例如 RM 19.90 显示成 19.90） */
  value: number;
  step: number;
  /** 小数位数（钱用 2） */
  decimals?: number;
  unit?: string;
  error?: string | null;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** 只给展示页用：静态地显示焦点的样子 */
  look?: "focus";
}

export function Stepper({ label, value, step, decimals = 0, unit, error, disabled = false, onChange, look }: StepperProps) {
  const id = useId();
  const round = (x: number): number => Number(x.toFixed(decimals));
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-cap text-muted">
        {label}
      </label>
      <div
        className={clsx(
          // 焦点在输入框里时，整个框有 2 像素的 sea 外框（docs/08 第十节）
          "flex h-12 items-stretch rounded-control border-2 bg-paper focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sea",
          look === "focus" && "outline-2 outline-offset-2 outline-sea",
          error ? "border-hibiscus" : "border-ink",
          disabled && "border-disabled-text bg-disabled-bg",
        )}
      >
        <button type="button" disabled={disabled} aria-label={zh.ui.minus} className="w-hit shrink-0 text-title font-bold disabled:text-disabled-text" onClick={() => onChange(round(value - step))}>
          {zh.ui.minusSign}
        </button>
        <input
          id={id}
          inputMode="decimal"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className="num w-full min-w-0 bg-transparent text-center text-title outline-none"
          value={value.toFixed(decimals)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(round(n));
          }}
        />
        {unit && <span className="self-center pr-2 text-cap text-muted">{unit}</span>}
        <button type="button" disabled={disabled} aria-label={zh.ui.plus} className="w-hit shrink-0 text-title font-bold disabled:text-disabled-text" onClick={() => onChange(round(value + step))}>
          {zh.ui.plusSign}
        </button>
      </div>
      {error && <p className="text-cap text-hibiscus-text">{error}</p>}
    </div>
  );
}
