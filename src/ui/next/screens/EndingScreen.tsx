// 结局：走到了哪个桶、净资产、你这一路、解法、结局收集
import { nc } from "../../theme/tokens";
import { nt } from "../../../text/next";
import { Btn, box, num, shadow, title } from "../parts";
import { useNext } from "../store/store";
import { endingView } from "../store/selectors";

export function EndingScreen() {
  const st = useNext();
  const v = endingView(st);
  if (!v) return null;
  const got = v.collection.filter((c) => c.got).length;
  return (
    <div style={{ position: "absolute", inset: 0, background: v.good ? nc.butter : nc.mist }}>
      <svg width="1440" height="960" viewBox="0 0 1440 960" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0 }}>
        <g fill={v.good ? nc.sun : nc.paper} opacity="0.6">
          <path d="M440 470 L300 -40 H580 Z" />
          <path d="M440 470 L-60 140 V420 Z" />
          <path d="M440 470 L-60 760 V1040 Z" />
          <path d="M440 470 L300 1000 H580 Z" />
          <path d="M440 470 L900 120 V420 Z" />
        </g>
      </svg>

      {/* 左：桶和名字 */}
      <div style={{ position: "absolute", left: 60, top: 70, width: 760, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <span style={{ ...title(22), ...box({ borderRadius: 999, padding: "4px 18px" }) }}>{st.game?.phase === "finished" ? nt.ending.title : nt.ending.titleEarly}</span>
        <svg className="nx-grow" width="260" height="250" viewBox="-60 -64 120 116" aria-hidden="true">
          <g stroke={nc.ink} strokeWidth="4" strokeLinejoin="round">
            <path d="M-40 -16 Q0 -72 40 -16" fill="none" />
            <path d="M-40 -16 L40 -16 L30 40 Q0 52 -30 40 Z" fill={v.good ? nc.gold : nc.slate} />
            <path d="M-36 8 L36 8" stroke={v.good ? nc.goldDeep : nc.ghost} strokeWidth="6" />
            <ellipse cx="0" cy="-16" rx="44" ry="12" fill={v.good ? nc.sun : nc.line} />
            {v.good && (
              <>
                <circle cx="-16" cy="-24" r="10" fill={nc.gold} strokeWidth="3" />
                <circle cx="6" cy="-28" r="10" fill={nc.gold} strokeWidth="3" />
                <circle cx="22" cy="-20" r="10" fill={nc.gold} strokeWidth="3" />
              </>
            )}
          </g>
        </svg>
        {v.hidden && <span style={{ ...title(20), color: nc.paper, background: nc.lavender, border: `3px solid ${nc.ink}`, borderRadius: 999, padding: "2px 14px" }}>{nt.ending.hidden}</span>}
        {st.newEnding && <span className="nx-pop" style={{ ...title(20), color: nc.paper, background: nc.coral, border: `3px solid ${nc.ink}`, borderRadius: 999, padding: "2px 14px" }}>{nt.ending.newFound}</span>}
        <h1 className="nx-pop" style={title(72, { margin: 0, textShadow: `4px 4px 0 ${v.good ? nc.gold : nc.ghost}` })}>{v.name}</h1>
        <span style={{ fontSize: 20, color: nc.inkSoft }}>{v.line}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, ...box({ borderRadius: 22, boxShadow: shadow(5) }), padding: "10px 26px" }}>
          <span style={{ fontSize: 16, color: nc.muted }}>{nt.ending.netWorth}</span>
          <b style={num(46, { color: v.nwFen >= 1e8 ? nc.mintText : nc.ink })}>{nt.money(v.nwFen)}</b>
        </div>
      </div>

      {/* 右：这一路、解法、收集 */}
      <div style={{ position: "absolute", left: 860, top: 40, width: 540, bottom: 40, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...box({ borderRadius: 26, boxShadow: shadow(6) }), padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={title(24)}>{nt.ending.path}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {v.path.map((p, i) => (
              <span key={p.layer} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, background: p.key === "good" ? nc.mintSoft : p.key === "bad" ? nc.skySoft : nc.orangeSoft, border: `2.5px solid ${nc.ink}`, borderRadius: 999, padding: "4px 12px 4px 4px" }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: p.key === "good" ? nc.mint : p.key === "bad" ? nc.sky : nc.orange, border: `2px solid ${nc.ink}`, color: nc.paper, ...num(13), display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <b style={{ fontSize: 15 }}>{p.title}</b>
                </span>
                {i < v.path.length - 1 && <span style={{ color: nc.goldDeep, fontWeight: 700 }}>→</span>}
              </span>
            ))}
          </div>
          {v.highlight && (
            <span style={{ fontSize: 14, color: nc.inkSoft }}>
              {nt.ending.keyStepLead}
              <b style={{ color: nc.ink }}>{v.highlight}</b>
            </span>
          )}
        </div>
        <div style={{ ...box({ borderRadius: 26, background: nc.mintSoft }), padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={title(22)}>{nt.ending.how}</span>
          <span style={{ fontSize: 16, lineHeight: 1.6 }}>{v.how}</span>
        </div>
        <div style={{ flex: 1, ...box({ borderRadius: 26 }), padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={title(22)}>{nt.ending.collection}</span>
            <b style={num(20)}>{nt.collectionCount(got, v.collection.length)}</b>
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {v.collection.map((c) => (
              <span
                key={c.id}
                style={{
                  height: 46,
                  borderRadius: 14,
                  border: `2.5px solid ${c.id === v.id ? nc.ink : c.got ? nc.ink : nc.line}`,
                  background: c.id === v.id ? nc.gold : c.got ? nc.goldSoft : nc.mist,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: c.got ? nc.ink : nc.faint,
                }}
              >
                {c.got ? c.name : nt.unknownEnding}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Btn kind="plain" onClick={st.toHome} style={{ flex: 1, height: 64 }}>
            {nt.ending.home}
          </Btn>
          <Btn onClick={st.newGame} style={{ flex: 1.4, height: 64, fontSize: 28 }}>
            {nt.ending.again}
          </Btn>
        </div>
      </div>
    </div>
  );
}
