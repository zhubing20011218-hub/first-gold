// 成绩卡（示意图第 9 张）
import { nc, productColor, productTint, rivalColor } from "../../theme/tokens";
import { nt } from "../../../text/next";
import { Btn, Face, ProductArt, ShopIcon, box, num, shadow, title } from "../parts";
import { useNext } from "../store/store";
import { reportView } from "../store/selectors";

const CONFETTI = [
  [70, nc.coral, -1],
  [120, nc.sky, -3.5],
  [1330, nc.mint, -2],
  [1380, nc.lavender, -4.5],
  [40, nc.gold, -5.2],
  [1400, nc.orange, -0.4],
] as const;

export function ReportScreen() {
  const st = useNext();
  const v = reportView(st);
  if (!v) return null;
  const good = v.gainFen >= 0;
  const max = Math.max(1, ...v.lines.map((l) => Math.abs(l.profitFen)), Math.abs(v.bulkProfitFen));
  const bars = [...v.lines.map((l) => ({ id: l.id, name: nt.products[l.id].name, fen: l.profitFen, sold: l.sold, color: productColor[l.id] }))];
  return (
    <div style={{ position: "absolute", inset: 0, background: good ? nc.butter : nc.mist }}>
      <svg width="1440" height="960" viewBox="0 0 1440 960" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0 }}>
        <g fill={good ? nc.sun : nc.paper} opacity="0.7">
          <path d="M720 480 L560 -40 H880 Z" />
          <path d="M720 480 L1500 120 V420 Z" />
          <path d="M720 480 L1500 760 V1040 Z" />
          <path d="M720 480 L-60 120 V420 Z" />
          <path d="M720 480 L-60 760 V1040 Z" />
          <path d="M720 480 L560 1000 H880 Z" />
        </g>
      </svg>
      {good &&
        CONFETTI.map(([x, c, d]) => (
          <span key={x} className="nx-fall" style={{ position: "absolute", top: -30, left: x, width: 12, height: 18, border: `2px solid ${nc.ink}`, borderRadius: 3, background: c, animationDelay: `${d}s` }} />
        ))}

      <div style={{ position: "absolute", left: 160, top: 40, width: 1120, height: 880, ...box({ borderRadius: 34, background: nc.cream, border: `4px solid ${nc.ink}`, boxShadow: shadow(10) }), padding: "22px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, ...box({ borderRadius: 999, border: `2.5px solid ${nc.ink}`, padding: "3px 14px" }) }}>{v.quarterLabel}</span>
          <span style={title(34)}>{nt.report.title}</span>
          <span style={{ flex: 1 }} />
          {v.levelTo > v.levelFrom && (
            <div className="nx-pop" style={{ display: "flex", alignItems: "center", gap: 10, ...box({ borderRadius: 18, boxShadow: `0 4px 0 ${nc.goldDeep}, 0 0 0 4px ${nc.gold}` }), padding: "6px 14px 6px 8px" }}>
              <ShopIcon level={v.levelTo} size={54} />
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <span style={{ fontSize: 12, color: nc.goldText, fontWeight: 700 }}>{nt.report.levelUp}</span>
                <span style={title(22)}>
                  {nt.levels[v.levelFrom]} → {nt.levels[v.levelTo]}
                </span>
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1.25, ...box({ borderRadius: 24 }), padding: "14px 20px", display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="84" height="84" viewBox="-42 -42 84 84" aria-hidden="true" style={{ flex: "none" }}>
              <g stroke={nc.ink} strokeWidth="3">
                <ellipse cx="6" cy="12" rx="28" ry="9" fill={nc.goldDeep} />
                <ellipse cx="6" cy="4" rx="28" ry="9" fill={nc.gold} />
                <ellipse cx="-4" cy="-6" rx="28" ry="9" fill={nc.goldDeep} />
                <ellipse cx="-4" cy="-14" rx="28" ry="9" fill={nc.gold} />
              </g>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 14, color: nc.inkSoft, fontWeight: 500 }}>{good ? nt.report.earned : nt.report.lost}</span>
              <span className="nx-pop" style={num(56, { lineHeight: 1, color: good ? nc.mintText : nc.red })}>{nt.signedMoney(v.gainFen)}</span>
              {v.lastGainFen !== null && <span style={{ fontSize: 13, color: v.gainFen >= v.lastGainFen ? nc.mintText : nc.red, fontWeight: 700 }}>{nt.report.vsLast(v.gainFen - v.lastGainFen)}</span>}
            </div>
          </div>
          <div style={{ flex: 1, ...box({ borderRadius: 24 }), padding: "14px 20px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 14, color: nc.inkSoft, fontWeight: 500 }}>{nt.report.netWorth}</span>
              <span style={num(18, { color: nc.muted, fontWeight: 600 })}>
                {nt.money(v.nwFrom)} → <b style={{ fontSize: 26, color: nc.ink }}>{nt.money(v.nwTo)}</b>
              </span>
            </span>
            <div style={{ position: "relative", height: 20, border: `2.5px solid ${nc.ink}`, borderRadius: 999, background: nc.mist, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${v.goalPct}%`, background: nc.gold }} />
              <div className="nx-bar" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(v.fromPct, v.goalPct)}%`, background: nc.goldDeep }} />
            </div>
            <span style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: nc.inkSoft }}>
              <span>{nt.report.toGoal(1e8 - v.nwTo)}</span>
              <span>{nt.report.quartersLeft(v.quartersLeft)}</span>
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <Medal bg={nc.mintSoft} label={nt.report.best} labelColor={nc.mintText} art={v.best ? <ProductArt id={v.best.id} size={44} /> : null} tint={v.best ? productTint[v.best.id] : nc.mist}
            big={v.best ? nt.products[v.best.id].name : nt.report.nothingWorst} amount={v.best ? nt.signedMoney(v.best.profitFen) : ""} amountColor={nc.mintText}
            small={v.best ? nt.report.bestLine(v.best.sold) : ""} />
          <Medal bg={nc.coralSoft} label={nt.report.worst} labelColor={nc.coralText} art={v.worst ? <ProductArt id={v.worst.id} size={44} /> : <span style={title(28, { color: nc.mintText })}>✓</span>} tint={v.worst ? productTint[v.worst.id] : nc.mist}
            big={v.worst ? nt.products[v.worst.id].name : nt.report.nothingWorst} small={v.worst ? nt.report.worstLine(v.worst.left, v.worst.valueFen) : nt.report.nothingWorstLine} />
          <Medal bg={nc.goldSoft} label={nt.report.bulk} labelColor={nc.goldText} art={<ShopIcon level={1} size={44} />} tint={nc.butter}
            big={v.bulk ? nt.report.bulkLine(v.bulk.rank, v.bulk.qty) : v.bulkTried ? nt.report.bulkLost : nt.report.bulkNone} small="" />
        </div>

        <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0, position: "relative" }}>
          <div style={{ flex: 1.25, ...box({ borderRadius: 24 }), padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <b style={{ fontSize: 16 }}>{nt.report.perProduct}</b>
              <span style={{ fontSize: 12, color: nc.muted }}>{nt.report.perProductNote}</span>
            </span>
            {bars.map((b) => (
              <div key={b.id} style={{ display: "grid", gridTemplateColumns: "76px 70px 1fr 96px", alignItems: "center", fontSize: 15, height: 30 }}>
                <span style={{ fontWeight: 700 }}>{b.name}</span>
                <span style={{ display: "flex", justifyContent: "flex-end", height: 22, borderRight: `2px solid ${nc.ink}` }}>
                  <span className="nx-bar" style={{ display: "block", width: b.fen < 0 ? Math.round((-b.fen / max) * 70) : 0, height: "100%", background: nc.coral, borderRadius: "6px 0 0 6px" }} />
                </span>
                <span style={{ display: "flex", height: 22 }}>
                  <span className="nx-bar" style={{ display: "block", width: b.fen > 0 ? Math.round((b.fen / max) * 290) : 0, height: "100%", background: b.color, borderRadius: "0 6px 6px 0", border: b.fen > 0 ? `2px solid ${nc.ink}` : "none", boxSizing: "border-box" }} />
                </span>
                <b style={num(14, { textAlign: "right", color: b.sold === 0 ? nc.faint : b.fen >= 0 ? nc.mintText : nc.coralText })}>{b.sold === 0 ? nt.report.notSold : nt.signedMoney(b.fen)}</b>
              </div>
            ))}
            <div style={{ marginTop: "auto", borderTop: `2px dashed ${nc.line}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              <b style={{ fontSize: 14 }}>{nt.report.happened}</b>
              <div style={{ display: "flex", gap: 8 }}>
                {v.happened.length === 0 && <span style={{ fontSize: 13, color: nc.muted }}>{nt.report.nothingHappened}</span>}
                {v.happened.map((e, i) => (
                  <span key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, background: e.tone === "good" ? nc.mintSoft : e.tone === "bad" ? nc.coralSoft : nc.goldSoft, border: `2px solid ${nc.ink}`, borderRadius: 12, padding: "5px 10px" }}>
                    <span style={{ fontSize: 11, color: nc.muted }}>{e.when}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{e.text}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...box({ borderRadius: 24 }), padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ width: 70, height: 70, borderRadius: "50%", background: `conic-gradient(${nc.mint} 0 ${v.compTo}%, ${nc.mist} ${v.compTo}% 100%)`, border: `3px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <span style={{ width: 50, height: 50, borderRadius: "50%", background: nc.paper, border: `2.5px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center", ...num(21) }}>{v.compTo}</span>
              </span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>
                {nt.report.composite(v.compFrom, v.compTo)}{" "}
                <span style={{ color: v.compTo >= v.compFrom ? nc.mintText : nc.red }}>
                  {v.compTo >= v.compFrom ? "↑" : "↓"}
                  {Math.abs(v.compTo - v.compFrom)}
                </span>
              </span>
            </div>
            <div style={{ flex: 1, ...box({ borderRadius: 24 }), padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <b style={{ fontSize: 15 }}>{nt.report.shops}</b>
              {v.shops.map((s, i) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, background: s.me ? nc.goldSoft : "transparent", borderRadius: 12, padding: "7px 10px" }}>
                  <b style={num(15, { width: 20 })}>{i + 1}</b>
                  <Face who={s.me ? -1 : nt.rivals.indexOf(s.name)} size={30} bg={s.me ? nc.gold : rivalColor[nt.rivals.indexOf(s.name)] ?? nc.mist} />
                  <span style={{ flex: 1, fontWeight: s.me ? 700 : 500 }}>{s.name}</span>
                  <b style={num(15, { color: s.fen >= 0 ? nc.mintText : nc.coralText })}>{nt.signedMoney(s.fen)}</b>
                </div>
              ))}
            </div>
          </div>

          {st.showDetail && (
            <div className="nx-pop" style={{ position: "absolute", inset: 0, ...box({ borderRadius: 24, boxShadow: shadow(6) }), padding: "14px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <b style={{ fontSize: 16 }}>{nt.report.detailTitle}</b>
                <span style={{ fontSize: 12, color: nc.muted }}>{nt.report.detailNote}</span>
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 40, rowGap: 10, marginTop: 6 }}>
                {v.money.map((m) => (
                  <span key={m.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 15, borderBottom: `2px dotted ${nc.line}`, padding: "3px 0" }}>
                    <span>{nt.report.lines[m.key]}</span>
                    <b style={num(15, { color: m.fen >= 0 ? nc.mintText : nc.coralText })}>{nt.signedMoney(m.fen)}</b>
                  </span>
                ))}
              </div>
              <span style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, borderTop: `3px solid ${nc.ink}`, paddingTop: 6 }}>
                <span>{nt.report.cashChange}</span>
                <span style={num(18)}>
                  {nt.money(v.cashFrom)} → {nt.signedMoney(v.cashTo).replace("+", "")}
                </span>
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ flex: 1, fontSize: 14, color: nc.inkSoft }}>{v.nextIsMap ? nt.report.nextFork : ""}</span>
          <Btn kind="plain" onClick={st.toggleDetail} style={{ height: 60, fontSize: 18, fontWeight: 700 }}>
            {st.showDetail ? nt.report.hideDetail : nt.report.detail}
          </Btn>
          <Btn onClick={st.afterReport} style={{ width: 280, height: 60, fontSize: 28 }}>
            {v.ended ? nt.report.toEnding : v.nextIsMap ? nt.report.toMap : nt.report.next}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function Medal({ bg, label, labelColor, art, tint, big, small, amount, amountColor }: { bg: string; label: string; labelColor: string; art: React.ReactNode; tint: string; big: string; small: string; amount?: string; amountColor?: string }) {
  return (
    <div style={{ ...box({ borderRadius: 22, background: bg }), padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", minHeight: 88 }}>
      <span style={{ flex: "none", width: 58, height: 58, borderRadius: 18, background: tint, border: `2.5px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{art}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: labelColor }}>{label}</span>
        <b style={title(21)}>
          {big} {amount && <span style={num(20, { color: amountColor })}>{amount}</span>}
        </b>
        {small && <span style={{ fontSize: 12, color: nc.inkSoft }}>{small}</span>}
      </span>
    </div>
  );
}
