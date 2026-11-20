// 一个功能区（docs/07 第四节、docs/09 第 3.2 节）：标题和状态标签、现在的情况、参考数字、这个季度的决定和"改"按钮。
// 只负责摆放，内容由 DecideLayer 按功能区填进来。内边距 16；决定放在最下面，运营区的"零售"和"大单"上下两行（规则包第 13 版，204 高）。
import clsx from "clsx";
import type { ReactNode } from "react";
import { Tag } from "../base/Tag";
import { AreaIcon } from "./AreaIcon";
import type { Area } from "../../store/state";
import { zh } from "../../../text/zh";

export interface AreaRow {
  label: ReactNode;
  value: ReactNode;
}

export interface AreaAction {
  label: string;
  value: ReactNode;
  onChange?: () => void;
  /** 写"以后会用到"或"现在没有要决定的"，不能点 */
  note?: string;
}

export interface AreaPanelProps {
  area: Area;
  state: "notSet" | "set" | "carried";
  rows: AreaRow[];
  reference: ReactNode;
  actions: AreaAction[];
  onOpenDesk: () => void;
  reminder?: ReactNode;
}

export function AreaPanel({ area, state, rows, reference, actions, onOpenDesk, reminder }: AreaPanelProps) {
  const tag = state === "notSet" ? zh.area.stateNotSet : state === "set" ? zh.area.stateSet : zh.area.stateCarried;
  return (
    <section
      data-area={area}
      aria-label={zh.areas[area]}
      className={clsx(
        "relative flex h-area min-w-0 flex-col rounded-control border-2 border-ink p-4 max-md:h-auto max-md:gap-1",
        state === "notSet" ? "bg-paper" : "bg-sea-soft",
      )}
    >
      {reminder && (
        <div data-reminder className="absolute -top-3 left-4 z-15 -translate-y-full max-md:static max-md:mb-1 max-md:translate-y-0">
          {reminder}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onOpenDesk} className="flex min-h-hit-desk items-center gap-2 text-title font-bold hover:underline max-md:min-h-hit">
          <AreaIcon area={area} />
          {zh.areas[area]}
        </button>
        <Tag text={tag} tone={state} />
      </div>
      <dl className="flex flex-col">
        {rows.map((r, i) => (
          <div key={i} className="flex h-row items-baseline justify-between gap-3 text-body">
            <dt className="text-muted">{r.label}</dt>
            <dd className="num text-em">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="text-cap whitespace-nowrap text-muted">{reference}</div>
      <div className="mt-auto flex flex-col gap-1 pt-1">
        {actions.map((a, i) => (
          <div key={i} className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-cap text-muted">{a.label}</span>
              <span className={a.note ? "text-body text-muted" : "num text-em font-bold whitespace-nowrap xl:text-title"}>{a.note ?? a.value}</span>
            </div>
            {a.onChange && !a.note && (
              <button
                type="button"
                onClick={a.onChange}
                aria-label={`${zh.area.change} ${a.label}`}
                className="min-h-hit-desk min-w-hit-desk shrink-0 rounded-control border-2 border-ink bg-paper px-3 text-body font-bold shadow-solid-sm transition-transform hover:bg-sea-soft active:translate-y-1 active:shadow-none max-md:min-h-hit max-md:min-w-hit"
              >
                {zh.area.change}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
