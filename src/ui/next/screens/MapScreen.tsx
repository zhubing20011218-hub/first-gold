// 路线树：整棵树淡淡地摆着，走到哪亮到哪。不写路通向哪里，不露出结局。
import { font, nc } from "../../theme/tokens";
import { nt } from "../../../text/next";
import { Btn, Logo, box, num, shadow, title } from "../parts";
import { useNext } from "../store/store";
import { ENDING_IDS, mapView } from "../store/selectors";

export function MapScreen() {
  const st = useNext();
  const v = mapView(st);
  const canClose = v.layer === null;
  const justRevealed = st.screen === "map" && v.layer === null && v.panel.news !== null;
  const nodeColor = (s: string): { bg: string; bc: string; fg: string } => {
    if (s === "chosen") return { bg: nc.orange, bc: nc.ink, fg: nc.paper };
    if (s === "good") return { bg: nc.mint, bc: nc.ink, fg: nc.paper };
    if (s === "bad") return { bg: nc.sky, bc: nc.ink, fg: nc.paper };
    if (s === "option" || s === "mystery") return { bg: nc.goldSoft, bc: nc.goldDeep, fg: nc.goldDeep };
    return { bg: nc.paper, bc: nc.line, fg: nc.paper };
  };
  const picked = v.panel.options.find((o) => o.picked);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width="1100" height="960" viewBox="0 0 1100 960" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0 }}>
        <path d="M0 960 H300 C270 920 230 900 160 905 C90 910 50 880 0 890 Z" fill={nc.sea} opacity="0.6" />
        <path d="M0 0 H300 C260 50 280 100 200 125 C130 145 90 110 0 140 Z" fill={nc.sea} opacity="0.6" />
        <g fill="none" stroke={nc.sun} strokeWidth="2" strokeDasharray="4 10" opacity="0.7">
          {[1, 2, 3, 4, 5].map((i) => (
            <ellipse key={i} cx="560" cy="500" rx={[0, 126, 234, 336, 426, 504][i]} ry={[0, 97, 179, 258, 327, 386][i]} />
          ))}
        </g>
        <g fill={nc.paper} stroke={nc.mist} strokeWidth="2" opacity="0.9">
          <path className="nx-drift" d="M60 330 a26 26 0 0 1 44 -14 a32 32 0 0 1 58 8 a24 24 0 0 1 6 44 h-102 a20 20 0 0 1 -6 -38 z" />
          <path className="nx-drift" d="M930 300 a24 24 0 0 1 40 -13 a30 30 0 0 1 54 7 a22 22 0 0 1 6 40 h-94 a18 18 0 0 1 -6 -34 z" />
          <path className="nx-drift" d="M880 780 a24 24 0 0 1 40 -13 a30 30 0 0 1 54 7 a22 22 0 0 1 6 40 h-94 a18 18 0 0 1 -6 -34 z" />
          <path className="nx-drift" d="M150 760 a26 26 0 0 1 44 -14 a32 32 0 0 1 58 8 a24 24 0 0 1 6 44 h-102 a20 20 0 0 1 -6 -38 z" />
        </g>
        {/* 整棵树的影子 */}
        <g fill="none" stroke={nc.ghost} strokeLinecap="round" strokeDasharray="0.1 11">
          {v.ghostRoads.map((d, i) => (i > 0 ? <path key={i} d={d} strokeWidth={8 - i} opacity={1 - i * 0.12} /> : null))}
        </g>
        <g fill={nc.paper} stroke={nc.ghost} strokeWidth="2.5">
          {v.ghostCircles.slice(1, 5).map((d, i) => (
            <path key={i} d={d} opacity={0.95 - i * 0.13} />
          ))}
        </g>
        <path d={v.ghostCircles[5]} fill={nc.mist} stroke={nc.ghostDeep} strokeWidth="2" opacity="0.8" />
        {/* 走过的路和能选的路 */}
        {v.roads.map((r, i) =>
          r.chosen ? (
            <g key={i}>
              <path d={r.d} fill="none" stroke={nc.goldDeep} strokeWidth="18" strokeLinecap="round" />
              <path d={r.d} fill="none" stroke={nc.sun} strokeWidth="10" strokeLinecap="round" />
              <path className="nx-flow" d={r.d} fill="none" stroke={nc.paper} strokeWidth="4" strokeLinecap="round" strokeDasharray="6 18" opacity="0.9" />
            </g>
          ) : r.open ? (
            <path key={i} className="nx-draw" d={r.d} fill="none" stroke={nc.gold} strokeWidth="6" strokeLinecap="round" />
          ) : (
            <path key={i} d={r.d} fill="none" stroke={nc.line} strokeWidth="5" strokeLinecap="round" strokeDasharray="0.1 12" />
          ),
        )}
      </svg>

      {/* 起点 */}
      <div style={{ position: "absolute", left: 506, top: 448, width: 108, height: 104, ...box({ borderRadius: 28, boxShadow: shadow(6, nc.shade) }), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <svg width="64" height="54" viewBox="-32 -28 64 54" aria-hidden="true">
          <path d="M-30 -2 L0 -24 L30 -2 Z" fill={nc.coral} stroke={nc.ink} strokeWidth="3" strokeLinejoin="round" />
          <rect x="-24" y="-3" width="48" height="28" rx="4" fill={nc.butter} stroke={nc.ink} strokeWidth="3" />
          <rect x="-10" y="6" width="20" height="19" rx="2" fill={nc.sky} stroke={nc.ink} strokeWidth="2.5" />
          <rect x="17" y="14" width="13" height="11" rx="2" fill={nc.gold} stroke={nc.ink} strokeWidth="2.5" />
        </svg>
        <span style={title(14)}>{nt.map.start}</span>
      </div>

      {/* 圆点 */}
      {v.nodes.map((n, i) => {
        const c = nodeColor(n.state);
        const clickable = n.state === "option";
        return (
          <div key={i} style={{ position: "absolute", left: n.x - 60, top: n.y - n.size / 2, width: 120, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: n.state === "other" ? 0.6 : 1 }}>
            <button
              type="button"
              className={n.state === "option" || n.state === "mystery" ? "nx-grow nx-ring" : undefined}
              onClick={clickable ? () => st.pickOnMap(n.key) : undefined}
              aria-label={n.label || n.tag}
              style={
                {
                  "--nx-ring": nc.gold,
                  width: n.size,
                  height: n.size,
                  borderRadius: "50%",
                  background: n.picked ? nc.gold : c.bg,
                  border: `3px solid ${n.picked ? nc.ink : c.bc}`,
                  color: n.picked ? nc.ink : c.fg,
                  fontFamily: font.num,
                  fontWeight: 700,
                  fontSize: n.size > 40 ? 20 : 17,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  cursor: clickable ? "pointer" : "default",
                  animationDelay: `${0.15 + i * 0.05}s`,
                  transform: n.picked ? "scale(1.15)" : undefined,
                  transition: "transform .15s ease",
                } as React.CSSProperties
              }
            >
              {n.label}
            </button>
            {n.tag && <span style={{ whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, ...box({ border: `2px solid ${nc.ink}`, borderRadius: 999, padding: "1px 8px" }) }}>{n.tag}</span>}
          </div>
        );
      })}

      {/* 结局 */}
      {v.ending && (
        <div className="nx-grow" style={{ position: "absolute", left: v.ending.x - 70, top: v.ending.y - 46, width: 140, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <svg width="70" height="70" viewBox="-30 -40 60 70" aria-hidden="true">
            <g stroke={nc.ink} strokeWidth="3" strokeLinejoin="round">
              <path d="M-20 -8 Q0 -36 20 -8" fill="none" />
              <path d="M-20 -8 L20 -8 L15 20 Q0 26 -15 20 Z" fill={v.ending.good ? nc.gold : nc.slate} />
              <ellipse cx="0" cy="-8" rx="22" ry="6" fill={v.ending.good ? nc.sun : nc.mist} />
            </g>
          </svg>
          <span style={{ whiteSpace: "nowrap", ...title(18), background: v.ending.good ? nc.coral : nc.slate, color: nc.paper, border: `3px solid ${nc.ink}`, borderRadius: 999, padding: "2px 14px" }}>{v.ending.name}</span>
        </div>
      )}

      {/* 小店主 */}
      <div style={{ position: "absolute", left: v.walker[0] - 20, top: v.walker[1] - 30, width: 40, height: 52, pointerEvents: "none", transition: "left .8s ease, top .8s ease" }}>
        <svg className="nx-bob" width="40" height="52" viewBox="-20 -22 40 52" aria-hidden="true">
          <g stroke={nc.ink} strokeWidth="2.5" strokeLinejoin="round">
            <path d="M-11 18 Q0 10 11 18 L9 28 H-9 Z" fill={nc.mintDeep} />
            <circle cx="0" cy="0" r="15" fill={nc.skin} />
            <path d="M-15 -3 Q-14 -17 0 -18 Q14 -17 15 -3 Q8 -9 0 -9 Q-8 -9 -15 -3 Z" fill={nc.ink} />
            <path d="M-16 -6 Q0 -22 16 -6 L20 -4 Q0 -14 -14 -4 Z" fill={nc.coral} />
            <circle cx="-5" cy="2" r="2" fill={nc.ink} stroke="none" />
            <circle cx="5" cy="2" r="2" fill={nc.ink} stroke="none" />
            <path d="M-3 8 Q0 11 3 8" fill="none" strokeWidth="2" />
          </g>
        </svg>
      </div>

      {/* 顶部 */}
      <div style={{ position: "absolute", left: 24, top: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <Logo />
        <div style={{ display: "flex", alignItems: "center", gap: 8, ...box({ borderRadius: 999, padding: "8px 16px", boxShadow: shadow(4) }), fontWeight: 700, fontSize: 15 }}>
          {nt.collection} <span style={num(18)}>{nt.collectionCount(st.collection.length, ENDING_IDS.length)}</span>
        </div>
      </div>

      {/* 右边一栏 */}
      <div style={{ position: "absolute", left: 1116, top: 20, width: 300, bottom: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...box({ padding: "10px 16px 12px", boxShadow: shadow(4) }), display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, color: nc.muted, fontWeight: 500 }}>{nt.top.netWorth}</span>
            <span style={num(20)}>{nt.money(v.netWorthFen)}</span>
          </div>
          <div style={{ height: 12, background: nc.mist, border: `2px solid ${nc.ink}`, borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${v.goalPct}%`, height: "100%", background: nc.gold }} />
          </div>
          <span style={{ fontSize: 12, color: nc.muted, textAlign: "right" }}>{nt.top.goal.replace("/ ", "")}</span>
        </div>
        <div style={{ flex: 1, ...box({ borderRadius: 26, boxShadow: shadow(6), padding: 18 }), display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ alignSelf: "flex-start", ...num(13), background: nc.butter, border: `2px solid ${nc.ink}`, borderRadius: 999, padding: "2px 10px" }}>
            {v.panel.when}
          </span>
          {v.panel.news && (
            <div style={{ background: v.panel.newsGood ? nc.mintSoft : nc.skySoft, border: `2.5px solid ${nc.ink}`, borderRadius: 16, padding: "10px 12px", fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>{v.panel.news}</div>
          )}
          <h1 style={title(28, { margin: 0 })}>{v.layer === null ? nt.map.title : v.panel.title}</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: nc.inkSoft }}>{v.layer === 0 ? nt.map.subtitle : nt.map.hint}</p>
          {v.panel.options.map((o) => (
            <button
              key={o.key}
              type="button"
              className="nx-press"
              onClick={() => st.pickOnMap(o.key)}
              style={{
                textAlign: "left",
                cursor: "pointer",
                fontFamily: font.body,
                color: nc.ink,
                background: o.picked ? nc.goldSoft : nc.paper,
                border: `3px solid ${nc.ink}`,
                borderRadius: 16,
                boxShadow: o.picked ? `0 4px 0 ${nc.goldDeep}, 0 0 0 4px ${nc.gold}` : shadow(4),
                padding: "10px 12px",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <span style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", background: nc.goldSoft, border: `2.5px solid ${nc.ink}`, display: "flex", alignItems: "center", justifyContent: "center", ...num(14) }}>{o.letter}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{o.title}</span>
                <span style={{ fontSize: 12, lineHeight: 1.5, color: nc.muted }}>{o.desc}</span>
              </span>
            </button>
          ))}
          <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, fontWeight: 500, color: nc.inkSoft }}>
            {[
              [nc.orange, nc.ink, nt.map.legend[0]],
              [nc.goldSoft, nc.goldDeep, nt.map.legend[1]],
              [nc.mint, nc.ink, nt.map.legend[2]],
              [nc.sky, nc.ink, nt.map.legend[3]],
            ].map(([bg, bc, t]) => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: bg, border: `2.5px solid ${bc}` }} />
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {v.panel.reveal && (
              <Btn onClick={() => {
                st.pickOnMap("reveal");
                st.confirmMap();
              }} style={{ height: 58, fontSize: 22 }}>
                {nt.map.reveal}
              </Btn>
            )}
            {v.layer !== null && !v.panel.reveal && (
              <Btn onClick={st.confirmMap} disabled={!picked} style={{ height: 58, fontSize: 22 }}>
                {picked ? `${nt.map.pick} · ${picked.title}` : nt.map.pick}
              </Btn>
            )}
            {canClose && (
              <Btn kind={justRevealed ? "primary" : "plain"} onClick={st.closeMap} style={{ height: 52, fontSize: 20 }}>
                {justRevealed ? nt.map.goShop : nt.map.back}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
