// 进货和运营（示意图第 7 张）
import { font, nc, productColor, productTint, rivalColor } from "../../theme/tokens";
import { nt } from "../../../text/next";
import { nextParams as P } from "../../../params/next";
import { Btn, Face, Fires, Modal, ProductArt, Step, TopBar, box, num, shadow, title } from "../parts";
import { products } from "../../../products/catalog";
import { useNext } from "../store/store";
import { intelLines, shopView, topView, type CardView, type ShopView } from "../store/selectors";
import { BidPanel } from "./BidPanel";

export function ShopScreen() {
  const st = useNext();
  const { game, draft } = st;
  if (!game || !draft) return null;
  const v = shopView(game, draft);
  const top = topView(game);
  const left = v.cashFen - v.usedFen;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <TopBar top={top} onMap={st.openMap} />

      {/* 市场情报一行 */}
      <div style={{ position: "absolute", left: 24, top: 96, width: 880, height: 64, ...box({ borderRadius: 20, background: nc.butter }), display: "flex", alignItems: "center", gap: 14, padding: "0 16px 0 10px" }}>
        <span style={{ flex: "none", width: 44, height: 44, borderRadius: 14, background: nc.paper, border: `2.5px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke={nc.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v5l14 6V6L4 12z" fill={nc.gold} />
            <path d="M18 9c3 1 5 3 5 5.5S21 19 18 20" />
            <path d="M7 17l2 6h3l-1-5" />
          </svg>
        </span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: nc.goldText }}>{nt.intel.title}</span>
          <span style={{ fontSize: 15, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{intelLines(game).slice(0, 3).join(" ")}</span>
        </div>
        <button type="button" onClick={st.openIntel} style={{ flex: "none", fontSize: 13, fontWeight: 700, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: nc.ink, fontFamily: font.body }}>
          {nt.intel.again}
        </button>
      </div>

      <MoneyBar v={v} />

      {/* 6 张商品卡 */}
      <div style={{ position: "absolute", left: 24, top: 312, width: 880, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {v.cards.map((c) => (
          <Card key={c.id} c={c} />
        ))}
      </div>

      <Ops v={v} />

      {/* 预计 */}
      <div style={{ position: "absolute", left: 928, top: 724, width: 488, height: 128, ...box({ background: nc.mintSoft }), padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: nc.mintText }}>{nt.ops.estimate}</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <Stat label={nt.ops.sold} value={nt.ops.ordersUnit(Math.round(v.est.sold / 10) * 10)} />
          <Stat label={nt.ops.earn} value={nt.shop.about(nt.signedMoney(Math.round(v.est.profitFen / 10000) * 10000))} color={v.est.profitFen >= 0 ? nc.mintText : nc.red} />
          <Stat label={nt.ops.endCash} value={nt.shop.about(nt.signedMoney(Math.round(v.est.endCashFen / 10000) * 10000).replace("+", ""))} color={v.est.endCashFen < v.safeFen ? nc.red : nc.ink} />
        </div>
        <span style={{ fontSize: 12, color: v.over ? nc.red : nc.inkSoft }}>{v.over ? nt.ops.estOver : v.est.left > 600 ? nt.ops.estLeft(v.est.left) : nt.ops.estNote}</span>
      </div>
      <Btn onClick={st.start} style={{ position: "absolute", left: 928, top: 870, width: 488, height: 64, fontSize: 28, background: v.over ? nc.orange : nc.gold }}>
        {v.over || left < 0 ? nt.ops.goRisky : nt.ops.go}
      </Btn>

      {st.intelOpen && <IntelModal lines={intelLines(game)} onClose={st.closeIntel} />}
      {st.bidOpen && <BidPanel id={st.bidOpen} />}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 12, color: nc.inkSoft }}>{label}</span>
      <b style={num(21, { color: color ?? nc.ink, whiteSpace: "nowrap" })}>{value}</b>
    </span>
  );
}

function MoneyBar({ v }: { v: ShopView }) {
  const total = Math.max(v.cashFen, v.usedFen, 1);
  const pct = (n: number): string => `${(Math.max(0, n) / total) * 100}%`;
  const colorOf = (id: string): string => (id === "ads" ? nc.slate : id === "comp" ? nc.ink : productColor[id]);
  const nameOf = (id: string): string => (id === "ads" ? nt.ops.tabs[1] : id === "comp" ? nt.ops.tabs[3] : nt.products[id].name);
  const left = v.cashFen - v.usedFen;
  return (
    <div style={{ position: "absolute", left: 24, top: 172, width: 880, height: 126, ...box({ borderRadius: 20, border: `3px solid ${v.over ? nc.red : nc.ink}` }), padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>
          {nt.shop.moneyTitle} <span style={{ fontSize: 12, fontWeight: 500, color: nc.red, marginLeft: 8 }}>{nt.shop.safeLine(v.safeFen)}</span>
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: v.over ? nc.red : left < v.safeFen ? nc.goldText : nc.mintText }}>{v.over ? nt.shop.over(v.usedFen - v.cashFen) : nt.shop.planned(v.usedFen, left)}</span>
      </div>
      <div style={{ position: "relative", height: 26, border: `2.5px solid ${nc.ink}`, borderRadius: 10, overflow: "hidden", display: "flex", background: nc.paper }}>
        {v.segs.map((s) => (
          <div key={s.id} style={{ width: pct(s.fen), height: "100%", background: colorOf(s.id), borderRight: `2px solid ${nc.ink}`, boxSizing: "border-box", transition: "width .25s ease" }} />
        ))}
        {v.cashFen > 0 && <div style={{ position: "absolute", top: -2, bottom: -2, left: pct(v.cashFen - v.safeFen), borderLeft: `3px dashed ${nc.red}` }} />}
        {v.over && <div style={{ position: "absolute", top: -2, bottom: -2, left: pct(v.cashFen), borderLeft: `3px solid ${nc.red}` }} />}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12.5, color: nc.inkSoft }}>
        {v.segs.map((s) => (
          <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: colorOf(s.id), border: `2px solid ${nc.ink}` }} />
            {nameOf(s.id)} <b style={num(13, { color: nc.ink })}>{nt.money(s.fen)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function Card({ c }: { c: CardView }) {
  const setBuy = useNext((s) => s.setBuy);
  const dec = (): void => setBuy(c.id, c.qty - c.step < c.moq ? 0 : c.qty - c.step);
  const inc = (): void => setBuy(c.id, Math.min(c.cap, c.qty === 0 ? Math.max(c.moq, c.step) : c.qty + c.step));
  const willLeft = c.left > 200;
  return (
    <div
      style={{
        position: "relative",
        height: 298,
        ...box({ background: c.qty > 0 ? nc.paper : nc.cream }),
        boxShadow: c.hot && c.qty > 0 ? `0 5px 0 ${nc.ink}, 0 0 0 4px ${nc.coralPale}` : shadow(4),
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: c.active ? 1 : 0.78,
      }}
    >
      {(c.hot || c.cold) && (
        <span style={{ position: "absolute", right: -6, top: -12, background: c.hot ? nc.orange : nc.sky, color: nc.paper, border: `2.5px solid ${nc.ink}`, borderRadius: 999, padding: "1px 10px", fontSize: 12, fontWeight: 700, transform: "rotate(4deg)" }}>
          {c.hot ? nt.shop.hotBadge : nt.shop.coldBadge}
        </span>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ flex: "none", width: 60, height: 60, borderRadius: 18, background: productTint[c.id], border: `2.5px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ProductArt id={c.id} />
        </span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={title(22, { lineHeight: 1 })}>{c.name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, background: productTint[c.id], border: `2px solid ${nc.ink}`, borderRadius: 999, padding: "0 7px" }}>{c.kind}</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Fires n={c.fires} hot={c.hot} />
            <span style={{ fontSize: 12, color: nc.muted }}>{nt.shop.heat}</span>
          </span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.15fr 1fr", border: `2px solid ${nc.line}`, borderRadius: 14, overflow: "hidden" }}>
        <Cell label={nt.shop.cost} value={`¥${(c.costFen / 100).toFixed(2)}`} />
        <Cell label={nt.shop.price} value={nt.rm(c.priceSen)} />
        <Cell label={nt.shop.unit} value={`¥${(c.unitFen / 100).toFixed(1)}`} good />
      </div>
      <span style={{ fontSize: 12, color: nc.inkSoft }}>{c.first ? nt.shop.metaFirst(c.returnPct, c.moq) : nt.shop.meta(c.returnPct, c.moq, c.lead)}</span>
      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 500, background: nc.mist, borderRadius: 999, padding: "1px 9px" }}>{c.tag}</span>
        {(c.stock > 0 || c.transit > 0) && <span style={{ fontSize: 12, fontWeight: 500, background: nc.mist, borderRadius: 999, padding: "1px 9px" }}>{nt.shop.stockNote(c.stock, c.transit)}</span>}
        {c.reserved > 0 && <span style={{ fontSize: 12, fontWeight: 700, background: nc.goldSoft, borderRadius: 999, padding: "1px 9px" }}>{nt.shop.reserveNote(c.reserved)}</span>}
      </span>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <Step label={nt.shop.less} onClick={dec}>
          −
        </Step>
        <span style={{ flex: 1, height: 38, boxSizing: "border-box", border: `2.5px solid ${nc.ink}`, borderRadius: 12, background: c.qty > 0 ? nc.paper : nc.mist, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <b style={num(20)}>{nt.qty(c.qty)}</b>
          <span style={{ fontSize: 12, color: nc.muted }}>{nt.shop.pieces}</span>
        </span>
        <Step label={nt.shop.more} onClick={inc} gold>
          +
        </Step>
      </div>
      <span style={{ fontSize: 12, color: nc.inkSoft, display: "flex", justifyContent: "space-between", gap: 6 }}>
        <span style={{ whiteSpace: "nowrap" }}>{c.qty > 0 ? nt.shop.batch(c.batchFen, c.discountBp) : c.qty >= c.cap ? nt.shop.cap(c.cap) : nt.shop.none}</span>
        <b style={{ color: willLeft ? nc.red : nc.mintText, whiteSpace: "nowrap" }}>{c.qty + c.stock + c.transit > 0 ? (willLeft ? nt.shop.willLeft(c.left) : nt.shop.willSell(c.sold)) : ""}</b>
      </span>
    </div>
  );
}

function Cell({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", padding: "5px 8px", borderRight: good ? "none" : `2px solid ${nc.line}`, background: good ? nc.mintSoft : "transparent" }}>
      <span style={{ fontSize: 11, color: good ? nc.mintText : nc.muted, fontWeight: good ? 700 : 400 }}>{label}</span>
      <span style={num(15, { whiteSpace: "nowrap", color: good ? nc.mintText : nc.ink })}>{value}</span>
    </span>
  );
}

function Ops({ v }: { v: ShopView }) {
  const st = useNext();
  const draft = st.draft;
  if (!draft) return null;
  return (
    <div style={{ position: "absolute", left: 928, top: 96, width: 488, height: 608, ...box({ borderRadius: 26, boxShadow: shadow(6) }), padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={title(26)}>{nt.ops.title}</span>
        <span style={{ fontSize: 12, color: nc.muted }}>{nt.ops.note}</span>
      </div>
      <div role="tablist" style={{ display: "flex", gap: 6, background: nc.mist, borderRadius: 16, padding: 5 }}>
        {nt.ops.tabs.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={st.tab === i}
            onClick={() => st.setTab(i)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 12,
              border: `2.5px solid ${st.tab === i ? nc.ink : "transparent"}`,
              background: st.tab === i ? nc.paper : "transparent",
              fontFamily: font.body,
              fontSize: 15,
              fontWeight: 700,
              color: nc.ink,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            {label}
            {i === 3 && v.local && v.riskPts >= P.riskMidPts.value && (
              <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: nc.red, color: nc.paper, ...num(11), display: "flex", alignItems: "center", justifyContent: "center" }}>!</span>
            )}
            {i === 2 && v.inquiries.length > 0 && (
              <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: nc.coral, color: nc.paper, ...num(11), display: "flex", alignItems: "center", justifyContent: "center" }}>{v.inquiries.length}</span>
            )}
          </button>
        ))}
      </div>
      {st.tab === 0 && <PriceTab v={v} />}
      {st.tab === 1 && <AdTab v={v} />}
      {st.tab === 2 && <BidTab v={v} />}
      {st.tab === 3 && <CompTab v={v} />}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: nc.muted }}>{nt.ops.rivalsTitle}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {nt.rivals.map((name, i) => (
            <div key={name} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: `2px solid ${nc.line}`, borderRadius: 14, padding: "6px 8px", minWidth: 0 }}>
              <Face who={i} bg={rivalColor[i]} />
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.3 }}>
                <b style={{ fontSize: 13 }}>{name}</b>
                <span style={{ fontSize: 12, color: i === 1 ? nc.red : nc.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rivalLine(i, v)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function rivalLine(i: number, v: ShopView): string {
  const hot = v.cards.find((c) => c.hot);
  if (i === 0) return hot ? nt.ops.rivalShort.hoard(hot.name) : nt.ops.rivalShort.quiet;
  if (i === 1) return nt.ops.rivalShort.cut;
  return nt.ops.rivalShort.bulk;
}

function PriceTab({ v }: { v: ShopView }) {
  const setPrice = useNext((s) => s.setPrice);
  const rows = v.cards.filter((c) => c.active);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 13, color: nc.inkSoft, lineHeight: 1.5 }}>{nt.ops.priceIntro}</span>
      {rows.map((c) => {
        const p = P.priceStepSen.value;
        const rival = c.rivalSen;
        const d = c.priceSen - rival;
        return (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `2px solid ${nc.line}`, borderRadius: 14, padding: "6px 10px" }}>
            <span style={{ width: 12, height: 32, borderRadius: 6, background: productColor[c.id], border: `2px solid ${nc.ink}` }} />
            <span style={{ width: 70, fontWeight: 700, fontSize: 15 }}>{c.name}</span>
            <Step label={nt.ops.lower} onClick={() => setPrice(c.id, Math.max(minOf(c.id), c.priceSen - p))} size={30}>
              −
            </Step>
            <b style={num(18, { width: 82, textAlign: "center" })}>{nt.rm(c.priceSen)}</b>
            <Step label={nt.ops.higher} onClick={() => setPrice(c.id, Math.min(maxOf(c.id), c.priceSen + p))} size={30}>
              +
            </Step>
            <span style={{ flex: 1, textAlign: "right", fontSize: 12, lineHeight: 1.35, color: nc.inkSoft }}>
              {nt.ops.rival(nt.rm(rival))}
              <br />
              <b style={{ color: d < 0 ? nc.mintText : d === 0 ? nc.inkSoft : nc.red }}>{d < 0 ? nt.ops.cheaper(nt.rm(-d)) : d === 0 ? nt.ops.same : nt.ops.pricier(nt.rm(d))}</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const minOf = (id: string): number => products.find((p) => p.id === id)?.minPriceSen ?? 0;
const maxOf = (id: string): number => products.find((p) => p.id === id)?.maxPriceSen ?? 0;

function AdTab({ v }: { v: ShopView }) {
  const st = useNext();
  const d = st.draft;
  if (!d) return null;
  const active = v.cards.filter((c) => c.qty + c.stock + c.transit > 0);
  const totalQty = active.reduce((a, c) => a + c.qty + c.stock + c.transit, 0) || 1;
  const step = 200000;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Row title={nt.ops.adBudget} note={nt.ops.adBudgetNote} value={nt.money(d.adBudgetFen)} onDec={() => st.setAd(d.adBudgetFen - step, d.adBidBp)} onInc={() => st.setAd(d.adBudgetFen + step, d.adBidBp)} />
      <Row title={nt.ops.adBid} note={nt.ops.adBidNote} value={nt.ops.adBidValue(d.adBidBp)} onDec={() => st.setAd(d.adBudgetFen, Math.max(5000, d.adBidBp - 1000))} onInc={() => st.setAd(d.adBudgetFen, Math.min(20000, d.adBidBp + 1000))} small />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, background: nc.mistDeep, borderRadius: 14, padding: "10px 12px" }}>
        <span style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <b>{nt.ops.adShare}</b>
          <b style={num(15)}>{Math.round(v.est.adShareBp / 100)}%</b>
        </span>
        <div style={{ height: 14, border: `2px solid ${nc.ink}`, borderRadius: 999, background: nc.paper, overflow: "hidden" }}>
          <div style={{ width: `${v.est.adShareBp / 100}%`, height: "100%", background: nc.sky, transition: "width .25s ease" }} />
        </div>
        <span style={{ fontSize: 12, color: nc.inkSoft }}>{nt.ops.adOrders(v.est.adOrders)}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{nt.ops.adSplit}</span>
      {active.map((c) => {
        const share = (c.qty + c.stock + c.transit) / totalQty;
        return (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ width: 64 }}>{c.name}</span>
            <div style={{ flex: 1, height: 12, borderRadius: 999, background: nc.mist, overflow: "hidden" }}>
              <div style={{ width: `${share * 100}%`, height: "100%", background: productColor[c.id] }} />
            </div>
            <b style={num(13, { width: 70, textAlign: "right" })}>{nt.money(d.adBudgetFen * share)}</b>
          </div>
        );
      })}
    </div>
  );
}

function Row({ title: t, note, value, onDec, onInc, small }: { title: string; note: string; value: string; onDec: () => void; onInc: () => void; small?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, border: `2px solid ${nc.line}`, borderRadius: 14, padding: "10px 12px" }}>
      <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <b style={{ fontSize: 15 }}>{t}</b>
        <span style={{ fontSize: 12, color: nc.muted }}>{note}</span>
      </span>
      <Step label="−" onClick={onDec} size={34}>
        −
      </Step>
      <b style={{ ...(small ? { fontSize: 14, fontWeight: 700 } : num(21)), width: 110, textAlign: "center" }}>{value}</b>
      <Step label="+" onClick={onInc} size={34} gold>
        +
      </Step>
    </div>
  );
}

function BidTab({ v }: { v: ShopView }) {
  const st = useNext();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: nc.mistDeep, borderRadius: 14, padding: "10px 12px" }}>
        <span style={{ width: 54, height: 54, borderRadius: "50%", background: `conic-gradient(${nc.mint} 0 ${v.composite}%, ${nc.paper} ${v.composite}% 100%)`, border: `2.5px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <span style={{ width: 38, height: 38, borderRadius: "50%", background: nc.paper, border: `2px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center", ...num(16) }}>{v.composite}</span>
        </span>
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <b style={{ fontSize: 15 }}>{nt.ops.composite}</b>
          <span style={{ fontSize: 12, color: nc.inkSoft, lineHeight: 1.45 }}>{nt.ops.compositeNote}</span>
        </span>
      </div>
      {v.inquiries.length === 0 && <span style={{ fontSize: 14, color: nc.muted, padding: "20px 0", textAlign: "center" }}>{nt.ops.noInquiry}</span>}
      {v.inquiries.map((q, i) => (
        <div key={q.id} style={{ border: `3px solid ${nc.ink}`, borderRadius: 18, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 5, background: q.bidSen ? nc.goldSoft : nc.paper }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, background: i === 0 ? nc.gold : nc.lavender, border: `2px solid ${nc.ink}`, borderRadius: 999, padding: "0 8px" }}>{nt.ops.inquiry}</span>
            <b style={{ fontSize: 15 }}>{q.client}</b>
            <span style={{ marginLeft: "auto", fontSize: 12, color: nc.muted }}>{nt.ops.due(q.dueDays)}</span>
          </span>
          <span style={{ fontSize: 15 }}>
            {nt.ops.wants(q.qty, nt.products[q.productId].name)} · {nt.ops.refPrice(nt.rm(q.refSen))}
          </span>
          <span style={{ fontSize: 13, color: q.myQty > 0 ? nc.mintText : nc.inkSoft, fontWeight: 700 }}>{q.bidSen ? nt.ops.yourBid(nt.rm(q.bidSen), q.rank, q.myQty) : nt.ops.notBid}</span>
          <span style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <button type="button" className="nx-press" onClick={() => st.openBid(q.id)} style={{ height: 34, padding: "0 16px", borderRadius: 12, background: q.bidSen ? nc.paper : nc.gold, border: `2.5px solid ${nc.ink}`, boxShadow: shadow(3), fontFamily: font.body, fontSize: 14, fontWeight: 700, color: nc.ink, cursor: "pointer" }}>
              {q.bidSen ? nt.ops.changeBid : nt.ops.goBid}
            </button>
            {q.bidSen && (
              <button type="button" className="nx-press" onClick={() => st.setBid(q.id, null)} style={{ height: 34, padding: "0 12px", borderRadius: 12, background: nc.paper, border: `2px solid ${nc.line}`, fontFamily: font.body, fontSize: 13, color: nc.muted, cursor: "pointer" }}>
                {nt.ops.cancelBid}
              </button>
            )}
          </span>
        </div>
      ))}
      {v.inquiries.length > 0 && <span style={{ fontSize: 12, color: nc.red, fontWeight: 500 }}>{nt.ops.breachWarn}</span>}
    </div>
  );
}

function CompTab({ v }: { v: ShopView }) {
  const st = useNext();
  const d = st.draft;
  if (!d) return null;
  if (!v.local) return <span style={{ fontSize: 14, color: nc.muted, lineHeight: 1.6, padding: "24px 8px" }}>{nt.ops.compOnlyLocal}</span>;
  const after = Math.max(0, v.riskPts - P.complianceTierPts.value[d.compTier]);
  const word = after >= 65 ? nt.ops.riskWords[2] : after >= 35 ? nt.ops.riskWords[1] : nt.ops.riskWords[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, background: nc.mistDeep, borderRadius: 14, padding: "12px 14px" }}>
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <b style={{ fontSize: 15 }}>{nt.ops.risk}</b>
          <b style={num(22, { color: after >= 35 ? nc.goldText : nc.mintText })}>
            {after} <span style={{ fontSize: 13 }}>/ 100 · {word}</span>
          </b>
        </span>
        <div style={{ height: 16, border: `2px solid ${nc.ink}`, borderRadius: 999, overflow: "hidden", position: "relative", background: `linear-gradient(90deg, ${nc.mintPale} 0 35%, ${nc.sun} 35% 65%, ${nc.coralPale} 65% 100%)` }}>
          <div style={{ position: "absolute", top: -2, bottom: -2, left: `calc(${after}% - 2px)`, width: 4, background: nc.ink, transition: "left .25s ease" }} />
        </div>
        <span style={{ fontSize: 13, color: nc.inkSoft, lineHeight: 1.5 }}>{nt.ops.riskIntro}</span>
      </div>
      {nt.ops.compTiers.map((t, i) => {
        const pts = Math.max(0, v.riskPts - P.complianceTierPts.value[i]);
        const on = d.compTier === i;
        return (
          <button key={t.title} type="button" onClick={() => st.setComp(i)} style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 12, border: `3px solid ${nc.ink}`, borderRadius: 16, padding: "10px 14px", background: on ? nc.goldSoft : nc.paper, boxShadow: on ? `0 4px 0 ${nc.goldDeep}, 0 0 0 3px ${nc.gold}` : shadow(3), fontFamily: font.body, color: nc.ink, cursor: "pointer" }}>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <b style={{ fontSize: 15 }}>{t.title}</b>
              <span style={{ fontSize: 12, color: nc.inkSoft }}>{t.desc(pts)}</span>
            </span>
            <b style={num(17)}>{nt.money(P.complianceTierCostFen.value[i])}</b>
          </button>
        );
      })}
    </div>
  );
}

function IntelModal({ lines, onClose }: { lines: string[]; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div style={{ width: 620, ...box({ borderRadius: 30, boxShadow: shadow(8), background: nc.butter }), padding: "26px 30px", display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="48" height="48" viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke={nc.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v5l14 6V6L4 12z" fill={nc.gold} />
            <path d="M18 9c3 1 5 3 5 5.5S21 19 18 20" />
            <path d="M7 17l2 6h3l-1-5" />
          </svg>
          <span style={title(34)}>{nt.intel.title}</span>
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, ...box({ borderRadius: 20 }), padding: "16px 18px" }}>
          {lines.map((l, i) => (
            <span key={i} style={{ display: "flex", gap: 10, fontSize: 17, lineHeight: 1.5 }}>
              <span style={{ flex: "none", width: 10, height: 10, marginTop: 9, borderRadius: "50%", background: i === 0 ? nc.orange : nc.goldDeep }} />
              {l}
            </span>
          ))}
        </div>
        <Btn onClick={onClose} style={{ alignSelf: "flex-end", width: 200, height: 58, fontSize: 24 }}>
          {nt.intel.close}
        </Btn>
      </div>
    </Modal>
  );
}
