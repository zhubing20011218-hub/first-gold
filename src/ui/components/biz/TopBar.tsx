// 左上的时间线、右上的状态、询价（docs/07 第四节）
import clsx from "clsx";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "../base/Button";
import { Pill } from "../base/Pill";
import { MoneyText } from "../base/MoneyText";
import { NumberText } from "../base/NumberText";
import { zh } from "../../../text/zh";
import { type StatusView, formatRM } from "../../store/selectors";

export function Timeline({ quarter, year, season }: { quarter: number; year: number; season: number }) {
  const t = zh.timeline;
  return (
    <div data-region="timeline" className="flex h-topbar items-center gap-3 rounded-full border-2 border-ink bg-gold-soft px-4 shadow-solid-sm" aria-label={t.dots(quarter + 1)}>
      <span className="text-em font-bold whitespace-nowrap">{t.label(t.year[year] ?? t.year[1], t.quarter[quarter % 4])}</span>
      <span className="text-cap whitespace-nowrap text-muted max-md:hidden">{t.season[season]}</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className={clsx(
              "h-3 w-3 rounded-full border-2 border-ink",
              i < quarter && "bg-ink",
              i === quarter && "bg-gold",
              i > quarter && "bg-paper",
              i === 4 && "ml-2",
            )}
          />
        ))}
      </span>
    </div>
  );
}

export function StatusBar({ s, onPush, onSource }: { s: StatusView; onPush: () => void; onSource: () => void }) {
  const st = zh.status;
  return (
    <div data-region="status" className="flex items-center gap-2 max-md:gap-1">
      <Pill label={st.cash}>
        <span className="text-cap text-muted max-md:sr-only">{st.cash}</span>
        <MoneyText kind="yuan" amount={s.cashFen} className="text-title font-bold max-md:text-em" />
      </Pill>
      <Pill label={st.stock} tone={s.stock === 0 ? "warn" : "paper"}>
        <span className="text-cap text-muted">{st.stock}</span>
        <NumberText value={s.stock} unit={st.piece} warn={s.stock === 0} className="text-title font-bold max-md:text-em" />
      </Pill>
      <Pill label={st.push} onClick={onPush}>
        <span className="text-cap text-muted">{st.push}</span>
        <NumberText value={s.push} delta={s.pushDelta ?? undefined} className="text-title font-bold max-md:text-em" deltaClassName="max-md:hidden" />
      </Pill>
      {s.risk && (
        <Pill label={st.risk} tone="soft" className="max-md:hidden">
          <span className="text-cap text-muted">{st.risk}</span>
          <span className={clsx("text-em font-bold", s.risk === "high" && "text-hibiscus-text")}>{st.riskLevel[s.risk]}</span>
        </Pill>
      )}
      <Pill label={st.source} onClick={onSource} className="max-md:hidden">
        <span className="text-em font-bold">{st.sourceSign}</span>
      </Pill>
      {/* 手机上状态只留现金、库存、推流分，风险和"数字从哪来"收进"更多"（docs/07 第五节） */}
      <Popover.Root>
        <Popover.Trigger className="inline-flex h-hit min-w-hit items-center justify-center rounded-full border-2 border-ink bg-paper px-2 text-cap font-bold shadow-solid-sm md:hidden" aria-label={zh.ui.more}>
          {zh.ui.more}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={8} collisionPadding={16} className="z-40 flex flex-col gap-2 rounded-control border-2 border-ink bg-paper px-4 py-3 shadow-solid-sm">
            {s.risk && (
              <span className="text-body">
                {st.risk} <span className={clsx("font-bold", s.risk === "high" && "text-hibiscus-text")}>{st.riskLevel[s.risk]}</span>
              </span>
            )}
            <Button variant="normal" onClick={onSource}>
              {st.source}
            </Button>
            <Popover.Arrow className="fill-ink" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

export function InquiryNote({ items, refPriceSen, onOpen, firstTime }: { items: { id: string; qty: number; dueDay: number }[]; refPriceSen: number; onOpen: () => void; firstTime: boolean }) {
  if (items.length === 0) return null;
  const q = zh.inquiry;
  return (
    <button
      type="button"
      data-region="inquiry"
      onClick={onOpen}
      className="flex w-inquiry flex-col gap-1 rounded-control border-2 border-ink bg-paper px-4 py-3 text-left shadow-solid-sm hover:bg-sea-soft max-md:min-h-hit max-md:w-auto max-md:py-2"
    >
      <span className="text-cap text-muted">{q.title(items.length)}</span>
      {/* 手机上只留一行"询价 N 张"，不盖住世界 */}
      {items.map((i) => (
        <span key={i.id} className="flex items-baseline justify-between max-md:hidden">
          <span className="num text-title font-bold">
            {i.qty}
            <span className="ml-1 font-sans text-cap text-muted">{q.piece}</span>
          </span>
          <span className="text-cap text-muted">{q.due(i.dueDay)}</span>
        </span>
      ))}
      <span className="text-cap text-muted max-md:hidden">
        {q.refPrice} <span className="num font-bold text-ink">{formatRM(refPriceSen)}</span>
      </span>
      {firstTime && <span className="text-cap text-gold-text max-md:hidden">{q.firstTime}</span>}
    </button>
  );
}
