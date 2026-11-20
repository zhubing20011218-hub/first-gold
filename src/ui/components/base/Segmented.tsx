// 二选一（docs/09 第 3.1 节），例如"不报 / 报价"
import clsx from "clsx";

export interface SegmentedProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function Segmented<T extends string>({ label, options, value, onChange, disabled = false }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-control border-2 border-ink bg-paper p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={clsx(
            "min-h-hit-desk rounded-control px-4 text-body font-bold whitespace-nowrap max-md:min-h-hit",
            o.value === value ? "bg-sea-text text-paper" : "text-ink hover:bg-sea-soft",
            disabled && "text-disabled-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
