// 抢单面板（示意图第 8 张）：改报价，排名马上变
import { font, nc, rivalColor } from "../../theme/tokens";
import { nt } from "../../../text/next";
import { nextParams as P } from "../../../params/next";
import { Btn, Face, ShopIcon, Step, box, num, shadow, title } from "../parts";
import { useNext } from "../store/store";
import { bidView } from "../store/selectors";

export function BidPanel({ id }: { id: string }) {
  const st = useNext();
  const { game, draft } = st;
  if (!game || !draft) return null;
  const v = bidView(game, draft, id);
  if (!v) return null;
  const set = (sen: number): void => st.setBid(id, Math.max(v.floorSen - 200, Math.min(v.inq.refSen, Math.round(sen / 10) * 10)));
  const knob = Math.max(0, Math.min(100, ((v.bidSen - v.floorSen) / Math.max(1, v.inq.refSen - v.floorSen)) * 100));
  const medal = [nc.gold, nc.mist, nc.coralPale, nc.paper];
  const won = v.me.qty > 0;
  const retailShort = v.retailLeft < 0;
  return (
    <div className="nx-pop" style={{ position: "absolute", inset: 0, background: nc.cream, zIndex: 40 }}>
      <div style={{ position: "absolute", left: 24, right: 24, top: 18, height: 56, display: "flex", alignItems: "center", gap: 14 }}>
        <span style={title(32)}>{nt.bid.title}</span>
        <span style={{ fontSize: 14, color: nc.muted }}>{nt.bid.sub}</span>
        <span style={{ flex: 1 }} />
        <Btn kind="plain" onClick={st.closeBid} style={{ height: 50, fontSize: 18, fontFamily: font.body, fontWeight: 700, borderRadius: 999 }}>
          {nt.bid.back}
        </Btn>
      </div>

      {/* 询单 */}
      <div style={{ position: "absolute", left: 24, top: 96, width: 664, ...box({ borderRadius: 26, background: nc.goldSoft, boxShadow: shadow(6) }), padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ShopIcon level={0} size={62} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, background: nc.gold, border: `2px solid ${nc.ink}`, borderRadius: 999, padding: "0 9px" }}>{nt.ops.inquiry}</span>
              <span style={{ fontSize: 13, color: nc.goldText, fontWeight: 700 }}>{nt.bid.deadline}</span>
            </span>
            <span style={title(30)}>
              {v.inq.client} · {nt.ops.wants(v.inq.qty, v.productName)}
            </span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: `2px solid ${nc.line}`, borderRadius: 16, overflow: "hidden", background: nc.paper }}>
          {[
            [nt.bid.total, `${nt.qty(v.inq.qty)}`],
            [nt.bid.dueLabel, nt.ops.due(v.inq.dueDays)],
            [nt.bid.refLabel, nt.rm(v.inq.refSen)],
            [nt.bid.breachLabel, nt.bid.breachValue],
          ].map(([k, val], i) => (
            <span key={k} style={{ display: "flex", flexDirection: "column", padding: "8px 12px", borderRight: i < 3 ? `2px solid ${nc.line}` : "none" }}>
              <span style={{ fontSize: 12, color: nc.muted }}>{k}</span>
              <b style={num(20, { color: i === 3 ? nc.red : nc.ink })}>{val}</b>
            </span>
          ))}
        </div>
        <div style={{ background: nc.mistDeep, borderRadius: 14, padding: "8px 12px", fontSize: 13.5, lineHeight: 1.5 }}>
          <b>{nt.bid.ruleLead}</b>
          {nt.bid.rule(P.bidPricePct.value, P.bidCompPct.value)}
        </div>
      </div>

      {/* 你的报价 */}
      <div style={{ position: "absolute", left: 24, top: 362, width: 664, height: 250, ...box({ borderRadius: 26 }), padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={title(24)}>{nt.bid.yours}</span>
          <span style={{ fontSize: 13, color: nc.inkSoft }}>{nt.bid.yoursNote}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Step label={nt.bid.lower} onClick={() => set(v.bidSen - 20)} size={52}>
            −
          </Step>
          <div style={{ flex: 1, height: 64, ...box({ borderRadius: 18, background: nc.goldSoft }), display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, paddingTop: 8 }}>
            <b style={num(40, { lineHeight: 1 })}>{nt.rm(v.bidSen)}</b>
            <span style={{ fontSize: 15, color: nc.muted }}>{nt.bid.perPiece}</span>
          </div>
          <Step label={nt.bid.higher} onClick={() => set(v.bidSen + 20)} size={52} gold>
            +
          </Step>
        </div>
        <div style={{ position: "relative", height: 14, border: `2px solid ${nc.ink}`, borderRadius: 999, background: `linear-gradient(90deg, ${nc.mintPale}, ${nc.butter} 60%, ${nc.coralPale})` }}>
          <span style={{ position: "absolute", top: -9, left: `${knob}%`, width: 26, height: 26, marginLeft: -13, borderRadius: "50%", background: nc.gold, border: `3px solid ${nc.ink}`, boxSizing: "border-box", transition: "left .2s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: nc.muted }}>
          {nt.bid.scale(nt.rm(v.floorSen), nt.rm(v.inq.refSen)).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 14 }}>
          <span style={{ flex: 1, background: nc.mistDeep, borderRadius: 12, padding: "6px 12px" }}>
            {nt.bid.priceScore} <b style={num(18)}>{v.priceScore}</b>
          </span>
          <span style={{ flex: 1, background: nc.mistDeep, borderRadius: 12, padding: "6px 12px" }}>
            {nt.bid.perUnit} <b style={num(18, { color: v.unitFen > 0 ? nc.mintText : nc.red })}>{nt.shop.about(`¥${(v.unitFen / 100).toFixed(1)}`)}</b>
          </span>
        </div>
      </div>

      {/* 店铺综合分 */}
      <div style={{ position: "absolute", left: 24, top: 632, width: 664, height: 304, ...box({ borderRadius: 26 }), padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 62, height: 62, borderRadius: "50%", background: `conic-gradient(${nc.mint} 0 ${v.comp.total}%, ${nc.mist} ${v.comp.total}% 100%)`, border: `3px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <span style={{ width: 44, height: 44, borderRadius: "50%", background: nc.paper, border: `2.5px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center", ...num(19) }}>{v.comp.total}</span>
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={title(24)}>{nt.bid.compTitle}</span>
            <span style={{ fontSize: 13, color: nc.inkSoft }}>{nt.bid.compNote}</span>
          </span>
        </div>
        {[
          { name: nt.bid.parts[0], w: v.comp.push, val: `${v.comp.push} / 100`, note: nt.bid.partNotes[0], color: nc.sky },
          { name: nt.bid.parts[1], w: v.comp.rating, val: `${(game.ratingE1 / 10).toFixed(1)} / 5`, note: nt.bid.partNotes[1], color: nc.gold },
          { name: nt.bid.parts[2], w: v.record, val: `${v.record} / 100`, note: nt.bid.onTime(v.onTime, v.defaults), color: nc.mint },
        ].map((p) => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
            <span style={{ width: 92, fontWeight: 700 }}>{p.name}</span>
            <div style={{ flex: 1, height: 14, border: `2px solid ${nc.ink}`, borderRadius: 999, background: nc.mist, overflow: "hidden" }}>
              <div style={{ width: `${p.w}%`, height: "100%", background: p.color }} />
            </div>
            <b style={num(14, { width: 72, textAlign: "right" })}>{p.val}</b>
            <span style={{ width: 190, fontSize: 12, color: nc.muted }}>{p.note}</span>
          </div>
        ))}
        <span style={{ display: "flex", gap: 10, fontSize: 12, fontWeight: 700 }}>
          {v.comp.bonus > 0 && <span style={{ color: nc.mintText }}>{nt.bid.bonus(v.comp.bonus)}</span>}
          {v.comp.breach > 0 && <span style={{ color: nc.red }}>{nt.bid.breach(v.comp.breach)}</span>}
        </span>
        <span style={{ marginTop: "auto", fontSize: 13, background: nc.mintSoft, borderRadius: 12, padding: "6px 12px", color: nc.mintText, fontWeight: 500 }}>{nt.bid.compFoot}</span>
      </div>

      {/* 排名 */}
      <div style={{ position: "absolute", left: 712, top: 96, width: 704, ...box({ borderRadius: 26, boxShadow: shadow(6) }), padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={title(26)}>{nt.bid.rankTitle}</span>
          <span style={{ fontSize: 12, color: nc.muted }}>{nt.bid.rankNote}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 72px 100px 1.1fr 92px", gap: 8, fontSize: 12, color: nc.muted, padding: "0 10px" }}>
          {nt.bid.cols.map((c, i) => (
            <span key={c} style={{ textAlign: i === 5 ? "right" : "left" }}>
              {c}
            </span>
          ))}
        </div>
        {v.rows.map((r) => {
          const me = r.who === -1;
          return (
            <div
              key={r.who}
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr 72px 100px 1.1fr 92px",
                gap: 8,
                alignItems: "center",
                border: me ? `3px solid ${nc.ink}` : `2px solid ${nc.line}`,
                borderRadius: 16,
                padding: "8px 10px",
                background: me ? nc.goldSoft : nc.paper,
                boxShadow: me ? `0 0 0 4px ${nc.gold}` : "none",
                transition: "all .25s ease",
              }}
            >
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: medal[r.rank - 1], border: `2.5px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center", ...num(16) }}>{r.rank}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Face who={r.who} size={36} bg={me ? nc.gold : rivalColor[r.who]} />
                <b style={{ fontSize: 15, whiteSpace: "nowrap" }}>{r.name}</b>
              </span>
              <b style={num(17)}>{r.comp}</b>
              <b style={num(15)}>{me ? nt.rm(r.bidSen) : nt.bid.about(nt.rm(r.bidSen))}</b>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ flex: 1, height: 12, borderRadius: 999, background: nc.mist, overflow: "hidden", border: `2px solid ${nc.ink}` }}>
                  <span style={{ display: "block", width: `${r.totalE1 / 10}%`, height: "100%", background: me ? nc.gold : nc.ghost, transition: "width .25s ease" }} />
                </span>
                <b style={num(15, { width: 40, textAlign: "right" })}>{(r.totalE1 / 10).toFixed(1)}</b>
              </span>
              <b style={num(18, { textAlign: "right", color: r.qty ? nc.mintText : nc.coralText })}>{r.qty ? nt.qty(r.qty) : nt.bid.none}</b>
            </div>
          );
        })}
      </div>

      {/* 结果预览 */}
      <div style={{ position: "absolute", left: 712, top: 480, width: 704, height: 182, ...box({ borderRadius: 26, background: won ? nc.mintSoft : nc.mist }), padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: won ? nc.mintText : nc.muted }}>{nt.bid.resultLead}</span>
        <span key={`${v.me.rank}-${v.me.qty}`} className="nx-pop" style={title(32)}>
          {won ? nt.bid.resultWin(v.me.rank, v.me.qty, nt.bid.shares[v.me.rank - 1]) : nt.bid.resultLose}
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <span style={{ flex: 1, background: nc.paper, borderRadius: 14, padding: "6px 12px", display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 12, color: nc.inkSoft }}>{nt.bid.profit}</span>
            <b style={num(22)}>{nt.shop.about(nt.money(v.profitFen))}</b>
          </span>
          <span style={{ flex: 1.6, background: nc.paper, borderRadius: 14, padding: "6px 12px", display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 12, color: nc.inkSoft }}>{nt.bid.stockLabel}</span>
            <span style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.45, color: retailShort ? nc.red : nc.ink }}>
              {won ? (retailShort ? nt.bid.stockShort(-v.retailLeft) : nt.bid.stockLine(v.productName, v.have, v.me.qty, v.retailLeft)) : nt.bid.loseHint}
            </span>
          </span>
        </div>
      </div>

      {/* 违约 */}
      <div style={{ position: "absolute", left: 712, top: 682, width: 704, height: 158, ...box({ borderRadius: 26, background: nc.coralSoft }), padding: "14px 20px", display: "flex", gap: 16, alignItems: "center" }}>
        <ShopIcon level={0} size={78} sad />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={title(22, { color: nc.coralText })}>{nt.bid.breachTitle}</span>
          <span style={{ fontSize: 14, lineHeight: 1.6 }}>{nt.bid.breachLine(nt.money(v.penaltyFen), v.comp.total, Math.max(0, v.comp.total - P.breachPenaltyPts.value))}</span>
        </div>
      </div>

      <div style={{ position: "absolute", left: 712, top: 862, width: 704, display: "flex", gap: 14 }}>
        <Btn kind="plain" onClick={() => { st.setBid(id, null); st.closeBid(); }} style={{ width: 200, height: 66 }}>
          {nt.bid.skip}
        </Btn>
        <Btn onClick={st.closeBid} style={{ flex: 1, height: 66, fontSize: 28 }}>
          {nt.bid.confirm(nt.rm(v.bidSen))}
        </Btn>
      </div>
    </div>
  );
}
