// 播放：小世界动起来，订单一单单飞出来；遇到大事停下来让你选；双 11 打包小游戏
import { useEffect, useState } from "react";
import worldUrl from "../../../assets/next/world.svg";
import { font, nc, productTint } from "../../theme/tokens";
import { nt } from "../../../text/next";
import { nextParams as P } from "../../../params/next";
import { Btn, Modal, ProductArt, TopBar, box, num, shadow, title } from "../parts";
import { useNext } from "../store/store";
import { PRODUCT_IDS, playView, rushCostFen, topView } from "../store/selectors";

const BUBBLE_SPOTS = [
  [560, 250],
  [640, 220],
  [720, 300],
  [600, 330],
  [700, 240],
  [530, 300],
];

export function PlayScreen() {
  const st = useNext();
  const { game } = st;
  const pending = game?.pending ?? null;
  const paused = pending !== null || st.notice !== null;
  useEffect(() => {
    if (!st.playing || paused) return;
    const t = window.setInterval(() => useNext.getState().tick(1), 1000 / st.speed);
    return () => window.clearInterval(t);
  }, [st.playing, paused, st.speed]);
  if (!game) return null;
  const v = playView(game, st.log);
  const top = topView(game);
  const year = Math.floor(Math.max(0, game.day - 1) / 360) + 1;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <TopBar top={top} />

      {/* 小世界 */}
      <div style={{ position: "absolute", left: 24, top: 96, width: 880, height: 560, ...box({ borderRadius: 28, overflow: "hidden", boxShadow: shadow(6), background: nc.sea }) }}>
        <img src={worldUrl} width={880} height={560} alt="" style={{ display: "block" }} />
        <div style={{ position: "absolute", left: 20, top: 16, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ ...box({ borderRadius: 999, padding: "6px 14px", border: `2.5px solid ${nc.ink}` }), ...title(20) }}>
            {nt.top.quarter(year, "")}
            {nt.play.day(v.month, v.dayOfMonth)}
          </span>
          {v.frozen && <span style={{ ...box({ borderRadius: 999, padding: "6px 14px", background: nc.coralSoft, border: `2.5px solid ${nc.ink}` }), fontSize: 14, fontWeight: 700, color: nc.coralText }}>{nt.play.frozen}</span>}
        </div>
        <div style={{ position: "absolute", left: 20, right: 20, bottom: 16, height: 14, background: nc.paper, border: `2.5px solid ${nc.ink}`, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${v.progress * 100}%`, height: "100%", background: nc.gold, transition: "width .1s linear" }} />
        </div>
        {/* 地名 */}
        <span style={{ position: "absolute", left: 168, top: 388, ...box({ borderRadius: 999, border: `2.5px solid ${nc.ink}`, padding: "2px 12px" }), ...title(15) }}>{nt.play.placeFactory}</span>
        <span style={{ position: "absolute", left: 600, top: 474, ...box({ borderRadius: 999, border: `2.5px solid ${nc.ink}`, padding: "2px 12px" }), ...title(15) }}>{nt.play.placeShop}</span>
        {/* 今天的订单 */}
        {v.todaySales
          .filter((s) => s.n > 0)
          .map((s, i) => {
            const [x, y] = BUBBLE_SPOTS[PRODUCT_IDS.indexOf(s.productId) % BUBBLE_SPOTS.length];
            return (
              <span key={`${game.day}-${s.productId}`} className="nx-rise" style={{ position: "absolute", left: x + (i % 2) * 14, top: y, display: "flex", alignItems: "center", gap: 4, ...box({ borderRadius: 999, padding: "2px 10px 2px 4px", border: `2.5px solid ${nc.ink}`, background: productTint[s.productId] }), pointerEvents: "none" }}>
                <ProductArt id={s.productId} size={24} />
                <b style={num(14, { color: nc.goldText })}>{nt.play.orders(s.n)}</b>
              </span>
            );
          })}
      </div>

      {/* 每种货卖了多少 */}
      <div style={{ position: "absolute", left: 24, top: 680, width: 880, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        {PRODUCT_IDS.map((id) => {
          const sold = v.soldBy[id] ?? 0;
          const stock = game.stock[id] ?? 0;
          const lost = game.quarterStats.lostBy[id] ?? 0;
          return (
            <div key={id} style={{ ...box({ borderRadius: 18, background: productTint[id] }), padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: 150 }}>
              <ProductArt id={id} size={40} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{nt.products[id].name}</span>
              <b style={num(24, { color: nc.ink })}>{nt.qty(sold)}</b>
              <span style={{ fontSize: 11, color: stock === 0 && sold > 0 ? nc.red : nc.muted }}>{nt.play.stockLeft(stock)}</span>
              {lost > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: nc.red, textAlign: "center", lineHeight: 1.2 }}>{nt.play.lost(lost)}</span>}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 24, top: 846, width: 880, height: 90, ...box({ borderRadius: 20 }), display: "flex", alignItems: "center", gap: 20, padding: "0 20px" }}>
        <span style={{ fontSize: 14, color: nc.muted }}>{nt.play.sold}</span>
        <b style={num(36)}>{nt.qty(v.soldTotal)}</b>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 14, color: nc.muted }}>{nt.play.cash}</span>
        <b className="nx-num" style={num(30, { color: game.cashFen < 0 ? nc.red : nc.ink })}>{nt.signedMoney(game.cashFen).replace("+", "")}</b>
      </div>

      {/* 右边：发生的事、快进 */}
      <div style={{ position: "absolute", left: 928, top: 96, width: 488, height: 640, ...box({ borderRadius: 26, boxShadow: shadow(6) }), padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={title(26)}>{nt.play.feedTitle}</span>
        {v.feed.length === 0 && <span style={{ fontSize: 14, color: nc.muted }}>{nt.play.quiet}</span>}
        {v.feed
          .slice()
          .reverse()
          .map((f) => (
            <div key={f.key} className="nx-pop" style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 14, padding: "10px 12px", border: `2px solid ${nc.line}`, background: f.tone === "good" ? nc.mintSoft : f.tone === "bad" ? nc.coralSoft : f.tone === "money" ? nc.goldSoft : nc.paper }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", flex: "none", background: f.tone === "good" ? nc.mint : f.tone === "bad" ? nc.coral : f.tone === "money" ? nc.gold : nc.sky, border: `2px solid ${nc.ink}` }} />
              <span style={{ fontSize: 15, fontWeight: 500 }}>{f.text}</span>
            </div>
          ))}
      </div>
      <div style={{ position: "absolute", left: 928, top: 760, width: 488, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          {[15, 45].map((sp) => (
            <Btn key={sp} kind={st.speed === sp ? "primary" : "plain"} onClick={() => st.setSpeed(sp)} style={{ flex: 1, height: 54, fontSize: 20 }}>
              {sp === 15 ? nt.play.normal : nt.play.speed}
            </Btn>
          ))}
        </div>
        <Btn kind="plain" onClick={() => st.tick(90)} style={{ height: 60, fontSize: 22 }} disabled={paused}>
          {nt.play.skip}
        </Btn>
      </div>

      {st.notice && <NoticeCard />}
      {pending?.kind === "event" && <EventCard />}
      {pending?.kind === "bulk_short" && <BulkShortCard />}
      {pending?.kind === "pack" && <PackGame />}
    </div>
  );
}

function CardShell({ tone, badge, children }: { tone: "good" | "bad"; badge: string; children: React.ReactNode }) {
  return (
    <Modal>
      <div style={{ width: 640, ...box({ borderRadius: 34, boxShadow: shadow(10), background: tone === "good" ? nc.mintSoft : nc.skySoft, border: `4px solid ${nc.ink}` }), padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
        <span style={{ position: "absolute", top: -18, left: 28, ...title(20), background: tone === "good" ? nc.mint : nc.sky, color: nc.paper, border: `3px solid ${nc.ink}`, borderRadius: 999, padding: "2px 16px" }}>{badge}</span>
        {children}
      </div>
    </Modal>
  );
}

function NoticeCard() {
  const st = useNext();
  const n = st.notice;
  if (!n) return null;
  const ev = nt.events[n.kind as "viral"] as { title: string; desc: (name: string) => string };
  const name = n.productId ? nt.products[n.productId].name : "";
  return (
    <CardShell tone="good" badge={n.card ? nt.events.goodCard : nt.play.goodNews}>
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        {n.productId ? (
          <span style={{ width: 96, height: 96, borderRadius: 26, background: productTint[n.productId], border: `3px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }} className="nx-bob">
            <ProductArt id={n.productId} size={72} />
          </span>
        ) : (
          <span style={{ width: 96, height: 96, borderRadius: 26, background: nc.gold, border: `3px solid ${nc.ink}`, ...title(44), display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>★</span>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={title(38)}>{ev.title}</span>
          <span style={{ fontSize: 17, lineHeight: 1.6, color: nc.inkSoft }}>{ev.desc(name)}</span>
        </div>
      </div>
      <Btn onClick={st.dismissNotice} style={{ alignSelf: "flex-end", width: 220, height: 60 }}>
        {nt.events.ok}
      </Btn>
    </CardShell>
  );
}

function EventCard() {
  const st = useNext();
  const p = st.game?.pending;
  if (!p || p.kind !== "event") return null;
  const k = p.event as "typhoon" | "pricewar" | "audit" | "malicious";
  const ev = nt.events[k];
  const name = p.productId ? nt.products[p.productId].name : "";
  const costA = k === "typhoon" ? P.typhoonAirFen.value : k === "audit" ? P.auditFastFen.value : k === "malicious" ? P.appealFen.value : 0;
  const aText = typeof ev.a === "function" ? ev.a(costA) : ev.a;
  return (
    <CardShell tone="bad" badge={p.card ? nt.events.badCard : nt.play.badNews}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={title(40)}>{ev.title}</span>
        <span style={{ fontSize: 17, lineHeight: 1.6, color: nc.inkSoft }}>{ev.desc(name)}</span>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {[
          { c: "a" as const, t: aText, h: ev.aHint },
          { c: "b" as const, t: ev.b, h: ev.bHint },
        ].map((o) => (
          <button
            key={o.c}
            type="button"
            className="nx-press"
            onClick={() => st.answer({ kind: "event", choice: o.c })}
            style={{ flex: 1, textAlign: "left", ...box({ borderRadius: 20, boxShadow: shadow(5) }), padding: "14px 16px", cursor: "pointer", fontFamily: font.body, color: nc.ink, display: "flex", flexDirection: "column", gap: 6 }}
          >
            <span style={title(24)}>{o.t}</span>
            <span style={{ fontSize: 14, color: nc.inkSoft, lineHeight: 1.5 }}>{o.h}</span>
          </button>
        ))}
      </div>
    </CardShell>
  );
}

function BulkShortCard() {
  const st = useNext();
  const g = st.game;
  const p = g?.pending;
  if (!g || !p || p.kind !== "bulk_short") return null;
  const order = g.bulkOrders.find((b) => b.inquiryId === p.inquiryId);
  const inq = g.schedule.inquiries.find((i) => i.id === p.inquiryId);
  const cost = rushCostFen(g, p.productId, p.shortQty);
  const e = nt.events.bulkShort;
  return (
    <CardShell tone="bad" badge={nt.ops.inquiry}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={title(40)}>{e.title}</span>
        <span style={{ fontSize: 17, lineHeight: 1.6, color: nc.inkSoft }}>{e.desc(inq ? nt.clients[inq.clientNo] : "", nt.products[p.productId].name, p.shortQty, order ? order.shipDay - g.day : 0)}</span>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {[
          { c: "rush" as const, t: e.a(cost), h: e.aHint },
          { c: "ignore" as const, t: e.b, h: e.bHint },
        ].map((o) => (
          <button
            key={o.c}
            type="button"
            className="nx-press"
            onClick={() => st.answer({ kind: "bulk_short", choice: o.c })}
            style={{ flex: 1, textAlign: "left", ...box({ borderRadius: 20, boxShadow: shadow(5) }), padding: "14px 16px", cursor: "pointer", fontFamily: font.body, color: nc.ink, display: "flex", flexDirection: "column", gap: 6 }}
          >
            <span style={title(24)}>{o.t}</span>
            <span style={{ fontSize: 14, color: nc.inkSoft, lineHeight: 1.5 }}>{o.h}</span>
          </button>
        ))}
      </div>
    </CardShell>
  );
}

function PackGame() {
  const st = useNext();
  const p = st.game?.pending;
  const pack = st.pack;
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!pack?.running) return;
    const t = window.setInterval(() => {
      const n = performance.now();
      setNow(n);
      if (n >= pack.endsAt) useNext.getState().packFinish();
    }, 100);
    return () => window.clearInterval(t);
  }, [pack?.running, pack?.endsAt]);
  if (!p || p.kind !== "pack") return null;
  const wanted = Object.values(p.wanted).reduce((a, b) => a + b, 0);
  const left = pack?.running ? Math.max(0, Math.ceil((pack.endsAt - now) / 1000)) : 12;
  return (
    <Modal>
      <div style={{ width: 720, ...box({ borderRadius: 34, boxShadow: shadow(10), background: nc.butter, border: `4px solid ${nc.ink}` }), padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
        <span style={title(46, { color: nc.coral, textShadow: `3px 3px 0 ${nc.ink}` })}>{nt.double11.title}</span>
        <span style={{ fontSize: 18, color: nc.inkSoft }}>{nt.double11.desc(wanted)}</span>
        {!pack?.running && !pack?.done && (
          <Btn onClick={() => st.packStart(performance.now())} style={{ width: 300, height: 72, fontSize: 30 }}>
            {nt.double11.start}
          </Btn>
        )}
        {pack?.running && (
          <>
            <span style={num(28)}>{nt.double11.left(left)}</span>
            <button
              type="button"
              key={pack.taps}
              className="nx-press nx-shake"
              onClick={st.packTap}
              style={{ width: 260, height: 200, ...box({ borderRadius: 30, background: nc.peach, boxShadow: shadow(8) }), cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: font.title, fontSize: 26, color: nc.ink }}
            >
              <svg width="110" height="90" viewBox="0 0 64 52" aria-hidden="true">
                <g stroke={nc.ink} strokeWidth="2.6" strokeLinejoin="round">
                  <polygon points="6,16 32,4 58,16 32,28" fill={nc.butter} />
                  <polygon points="6,16 32,28 32,50 6,38" fill={nc.sun} />
                  <polygon points="32,28 58,16 58,38 32,50" fill={nc.gold} />
                  <path d="M19 10 L45 22 V30" fill="none" />
                </g>
              </svg>
              {nt.double11.tap}
            </button>
            <span style={num(22)}>{nt.double11.packed(pack.taps)}</span>
          </>
        )}
        {pack?.done && (
          <>
            <span className="nx-pop" style={title(40)}>{nt.double11.result(Math.round(pack.resultBp / 100))}</span>
            <Btn onClick={() => st.answer({ kind: "pack", packBp: pack.resultBp })} style={{ width: 240, height: 64 }}>
              {nt.double11.done}
            </Btn>
          </>
        )}
      </div>
    </Modal>
  );
}
