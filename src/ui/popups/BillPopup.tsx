// P6 季度报表（docs/09 第四节、docs/06 第五节、docs/07 第 6.9 节）。
// 结论是 bankrupt 时不能关掉，只有"申请破产"一个按钮。
import type { ReactNode } from "react";
import { Popup } from "../components/base/Popup";
import { Button } from "../components/base/Button";
import { Stamp } from "../components/base/Stamp";
import { MoneyText } from "../components/base/MoneyText";
import { AreaIcon } from "../components/biz/AreaIcon";
import { useStore } from "../store/store";
import { billGroupsOf, billLabel, billTotalsOf, closingOf, reportOf, formatYuan, type Bill, type Cause } from "../store/selectors";
import { zh } from "../../text/zh";

/** "为什么"的一句话：数字里以 Fen 结尾的是钱，pctBp 是百分比 */
function causeText(c: Cause): string {
  const d: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.data)) {
    if (k.endsWith("Fen")) d[k.slice(0, -3)] = formatYuan(v);
    else if (k === "pctBp") d.pct = `${(v / 100).toFixed(1)}%`;
    else d[k] = String(v);
  }
  const f = zh.causes[c.key];
  return f ? f(d) : "";
}

function kindName(kind: string, local: boolean): string {
  return zh.bill.kinds[kind === "order_fee" && local ? "order_fee_local" : kind] ?? kind;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b-2 border-line pb-4">
      <h3 className="text-em font-bold">{title}</h3>
      {children}
    </section>
  );
}

export function BillPopup() {
  const ui = useStore();
  const r = reportOf(ui);
  if (!r || !ui.game) return null;
  const b = zh.bill;
  const local = ui.game.fulfillment === "local";
  const totals = billTotalsOf(r);
  const pva = r.planVsActual;
  const year = zh.timeline.year[Math.floor(r.quarter / 4)] ?? zh.timeline.year[1];
  const quarter = zh.timeline.quarter[r.quarter % 4];
  const bankrupt = r.verdict === "bankrupt";
  const closing = closingOf(r, ui.game);
  const carryGoods = r.carry.restockInTransit.reduce((s, x) => s + x.qty, 0);
  const footer =
    r.verdict === "continue" ? (
      <Button variant="confirm" disabled={!r.verified} onClick={() => ui.confirmBill()}>
        {b.confirm}
      </Button>
    ) : bankrupt ? (
      <Button variant="confirm" onClick={() => ui.declareBankruptcy()}>
        {b.declare}
      </Button>
    ) : (
      <Button variant="confirm" onClick={() => ui.seeResult()}>
        {b.see}
      </Button>
    );
  const verdictText =
    r.verdict === "continue" ? b.continue(formatYuan(r.endCashFen)) : bankrupt ? b.bankrupt(formatYuan(r.endCashFen)) : r.verdict === "banned" ? b.banned : b.finished;
  return (
    <Popup
      open={ui.popup === "bill"}
      title={b.title(year, quarter)}
      description={r.quarter === 0 ? b.firstTime : undefined}
      place="center"
      width="popup-bill"
      dismissible={!bankrupt}
      testId="bill"
      onClose={() => ui.closePopup()}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <Section title={b.sections.money}>
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            {billGroupsOf(r).map((g) => (
              <div key={g.area} className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-body font-bold">
                  <AreaIcon area={g.area} />
                  {zh.areas[g.area]}
                </span>
                {g.rows.length === 0 && <span className="text-cap text-muted">{zh.desk.empty}</span>}
                {g.rows.map((row) => (
                  <details key={row.kind} className="text-body">
                    <summary className="flex min-h-hit-desk cursor-pointer items-center justify-between gap-2 max-md:min-h-hit">
                      <span>
                        {kindName(row.kind, local)} <span className="text-cap text-muted">{b.count(String(row.count))}</span>
                      </span>
                      <MoneyText kind="yuan" amount={row.totalFen} />
                    </summary>
                    <ul className="flex flex-col pl-2 text-cap text-muted">
                      {row.items.map((it: Bill) => (
                        <li key={it.id} className="flex justify-between gap-2">
                          <span>
                            {billLabel(it, kindName(row.kind, local))} · {b.rowDay(String(it.day + 1))}
                          </span>
                          <MoneyText kind="yuan" amount={it.amountFen} />
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </Section>
        <Section title={b.sections.check}>
          <div className="flex items-center gap-4">
            <p className="flex-1 text-body">
              {r.verified
                ? b.verify(formatYuan(r.startCashFen), formatYuan(totals.incomeFen), formatYuan(totals.expenseFen), formatYuan(r.endCashFen), String(totals.count))
                : b.mismatch}
            </p>
            <Stamp text={r.verified ? zh.stamps.checked : zh.stamps.mismatch} tone={r.verified ? "gold" : "hibiscus"} animate />
          </div>
        </Section>
        <Section title={b.sections.plan}>
          <p className="text-body">
            {b.planVsActual(formatYuan(pva.planOutFen), formatYuan(pva.actualOutFen), formatYuan(pva.adsMaxFen), formatYuan(pva.actualAdsFen), formatYuan(pva.worstEndFen), formatYuan(pva.actualEndFen))}
          </p>
        </Section>
        <Section title={b.sections.carry}>
          <dl className="grid grid-cols-4 gap-2 text-body max-md:grid-cols-2">
            <div>
              <dt className="text-cap text-muted">{b.carry.reserved}</dt>
              <dd className="num font-bold">{`${r.carry.reservedQty.toLocaleString("en-US")} ${zh.status.piece}`}</dd>
            </div>
            <div>
              <dt className="text-cap text-muted">{b.carry.goods}</dt>
              <dd className="num font-bold">{`${carryGoods.toLocaleString("en-US")} ${zh.status.piece}`}</dd>
            </div>
            <div>
              <dt className="text-cap text-muted">{b.carry.money}</dt>
              <dd className="num font-bold">
                <MoneyText kind="yuan" amount={r.carry.payoutInTransit.amountFen} />
              </dd>
              {r.carry.payoutInTransit.frozenUntilDay !== null && (
                <dd className="text-cap font-bold text-hibiscus-text">{b.frozenUntil(String(r.carry.payoutInTransit.frozenUntilDay + 1))}</dd>
              )}
            </div>
            <div>
              <dt className="text-cap text-muted">{b.carry.bulk}</dt>
              <dd className="num font-bold">{r.carry.openBulks.length}</dd>
            </div>
          </dl>
        </Section>
        {closing && (
          <Section title={b.sections.closing}>
            <p className="text-body">
              {closing.count > 0 ? b.closing(String(closing.days), formatYuan(closing.incomeFen), String(closing.count)) : b.closingNone}
            </p>
          </Section>
        )}
        <Section title={b.sections.result}>
          <p className="text-body">
            {b.result(
              r.result.retailShipped.toLocaleString("en-US"),
              r.result.lost.toLocaleString("en-US"),
              String(r.result.bulkWon),
              String(r.result.bulkDelivered),
              String(r.result.push),
              `${r.result.pushDelta >= 0 ? "+" : "-"}${Math.abs(r.result.pushDelta)}`,
            )}
          </p>
          {r.causes.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 pl-6 text-body">
              {r.causes.map((c) => (
                <li key={c.key}>{causeText(c)}</li>
              ))}
            </ul>
          )}
        </Section>
        <section className="flex flex-col gap-2">
          <h3 className="text-em font-bold">{b.sections.verdict}</h3>
          <p className={bankrupt ? "text-em font-bold text-hibiscus-text" : "text-em font-bold"}>{verdictText}</p>
        </section>
      </div>
    </Popup>
  );
}
