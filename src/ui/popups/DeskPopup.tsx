// P8 工作台（docs/09 第四节）：三个页签，打开时停在点的那个功能区上。只能看，不能改；每一件事带一个状态标签（docs/07 第 6.10 节）。
import type { ReactNode } from "react";
import clsx from "clsx";
import { Popup } from "../components/base/Popup";
import { Tag, type TagTone } from "../components/base/Tag";
import { Button } from "../components/base/Button";
import { ReminderChip } from "../components/biz/ReminderChip";
import { useStore } from "../store/store";
import { deskOf, formatRM, formatYuan } from "../store/selectors";
import { zh } from "../../text/zh";
import type { Area } from "../store/state";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b-2 border-line pb-3">
      <h3 className="text-em font-bold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ text, tag, tone }: { text: string; tag?: string; tone?: TagTone }) {
  return (
    <li className="flex items-center justify-between gap-2 text-body">
      <span className="min-w-0">{text}</span>
      {tag && <Tag text={tag} tone={tone} />}
    </li>
  );
}

function Empty() {
  return <p className="text-cap text-muted">{zh.desk.empty}</p>;
}

export function DeskPopup() {
  const ui = useStore();
  const d = deskOf(ui);
  if (!d) return null;
  const t = zh.desk;
  const s = zh.itemStatus;
  const sec = t.sections;
  const area = ui.deskArea;
  const day = (n: number) => String(n + 1);
  const tabs = (
    <div role="tablist" className="flex gap-2">
      {(["purchase", "ops", "finance"] as Area[]).map((a) => (
        <button
          key={a}
          type="button"
          role="tab"
          aria-selected={area === a}
          onClick={() => ui.openDesk(a)}
          className={clsx("min-h-hit-desk flex-1 rounded-control border-2 border-ink text-body font-bold max-md:min-h-hit", area === a ? "bg-sea-text text-paper" : "bg-paper")}
        >
          {zh.areas[a]}
        </button>
      ))}
    </div>
  );
  return (
    <Popup open={ui.popup === "desk"} title={t.title} description={t.desc} place="side" width="popup" testId="desk" onClose={() => ui.closePopup()}>
      <div className="flex flex-col gap-4">
        {tabs}
        {area === "purchase" && (
          <>
            <Block title={sec.restocks}>
              {d.restocks.length === 0 ? (
                <Empty />
              ) : (
                <ul className="flex flex-col gap-1">
                  {d.restocks.map((r) => (
                    <Row key={r.id} text={t.restockRow(r.id, day(r.day), String(r.qty), formatYuan(r.unitCostFen), day(r.arriveDay))} tag={r.arrived ? s.arrived : s.onWay} tone={r.arrived ? "set" : "gold"} />
                  ))}
                </ul>
              )}
            </Block>
            <Block title={sec.stock}>
              <ul>
                <Row text={t.stockRow(String(d.stock.stock), String(d.stock.reserved), String(d.stock.days))} tag={d.stock.stock === 0 ? s.stockout : undefined} tone="hibiscus" />
              </ul>
            </Block>
            <Block title={sec.bulkPrep}>
              {d.bulkPrep.length === 0 ? (
                <Empty />
              ) : (
                <ul className="flex flex-col gap-1">
                  {d.bulkPrep.map((b, i) => (
                    <Row key={i} text={t.bulkPrepRow(String(b.qty), day(b.shipDay), String(b.short))} tag={b.short > 0 ? s.short : s.preparing} tone={b.short > 0 ? "hibiscus" : "gold"} />
                  ))}
                </ul>
              )}
            </Block>
          </>
        )}
        {area === "ops" && (
          <>
            <Block title={sec.retail}>
              <ul>
                <Row text={t.retailRow(String(d.retail.wanted), String(d.retail.shipped), String(d.retail.lost), String(d.retail.delivered), String(d.retail.returned))} />
              </ul>
            </Block>
            <Block title={sec.orders}>
              {d.orders.length === 0 ? (
                <Empty />
              ) : (
                <ul className="flex flex-col gap-1">
                  {d.orders.map((o, i) => (
                    <Row key={i} text={t.orderRow(day(o.day), String(o.qty), day(o.deliverDay))} tag={s.waitSign} tone="gold" />
                  ))}
                </ul>
              )}
            </Block>
            <Block title={sec.ads}>
              <ul>
                <Row text={t.adsRow(formatYuan(d.ads.bidFen), formatYuan(d.ads.budgetFen), formatYuan(d.ads.spendFen), String(d.ads.clicks), String(d.ads.orders), formatYuan(d.ads.eachFen))} />
              </ul>
            </Block>
            <Block title={sec.quotes}>
              {d.quotes.length === 0 ? (
                <Empty />
              ) : (
                <ul className="flex flex-col gap-1">
                  {d.quotes.map((q) => (
                    <Row key={q.id} text={t.quoteRow(String(q.qty), formatRM(q.priceSen), q.rivalSen === null ? "-" : formatRM(q.rivalSen))} tag={q.won ? zh.stamps.won : s.lost} tone={q.won ? "set" : "muted"} />
                  ))}
                </ul>
              )}
            </Block>
          </>
        )}
        {area === "finance" && (
          <>
            <Block title={sec.bills}>
              {d.bills.length === 0 ? (
                <Empty />
              ) : (
                <ul className="flex flex-col gap-1">
                  {d.bills.map((b) => (
                    <Row key={b.id} text={t.billRow(b.id, day(b.day), formatYuan(b.amountFen))} />
                  ))}
                </ul>
              )}
              {ui.report && (
                <div>
                  <Button variant="text" onClick={() => ui.openPopup("bill")}>
                    {zh.settle.openBill}
                  </Button>
                </div>
              )}
            </Block>
            <Block title={sec.payouts}>
              {d.payouts.length === 0 ? (
                <Empty />
              ) : (
                <ul className="flex flex-col gap-1">
                  {d.payouts.map((p, i) => (
                    <Row key={i} text={t.payoutRow(formatYuan(p.amountFen), p.day === null ? "-" : day(p.day))} tag={p.signed ? s.waitPay : s.waitSign} tone="gold" />
                  ))}
                </ul>
              )}
            </Block>
            <Block title={sec.bulkMoney}>
              {d.bulkMoney.length === 0 ? (
                <Empty />
              ) : (
                <ul className="flex flex-col gap-1">
                  {d.bulkMoney.map((b, i) => (
                    <Row
                      key={i}
                      text={t.bulkMoneyRow(formatYuan(b.depositFen), formatYuan(b.balanceFen), day(b.day))}
                      tag={b.status === "paid" ? s.settled : b.status === "defaulted" ? s.defaulted : b.status === "delivered" ? s.delivered : s.preparing}
                      tone={b.status === "paid" ? "set" : b.status === "defaulted" ? "hibiscus" : "gold"}
                    />
                  ))}
                </ul>
              )}
            </Block>
            <Block title={sec.risk}>
              <ul>
                <Row text={d.risk ? t.riskRow(zh.status.riskLevel[d.risk.level], String(d.risk.compliance), String(d.risk.audits)) : t.riskCross} />
              </ul>
            </Block>
          </>
        )}
        <Block title={sec.reminders}>
          {d.reminders.length === 0 ? (
            <Empty />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {d.reminders
                .filter((r) => r.area === area)
                .map((r, i) => (
                  <li key={i}>
                    <ReminderChip reminder={r} />
                  </li>
                ))}
            </ul>
          )}
        </Block>
      </div>
    </Popup>
  );
}
