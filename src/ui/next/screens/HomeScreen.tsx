// 首页：标题、开始、结局收集
import worldUrl from "../../../assets/next/world.svg";
import { font, nc } from "../../theme/tokens";
import { nt } from "../../../text/next";
import { Btn, box, num, shadow, title } from "../parts";
import { useNext } from "../store/store";
import { ENDING_IDS } from "../store/selectors";

export function HomeScreen() {
  const newGame = useNext((s) => s.newGame);
  const collection = useNext((s) => s.collection);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: 520, top: 150, width: 880, height: 560, ...box({ borderRadius: 32, overflow: "hidden", boxShadow: shadow(8) }) }}>
        <img src={worldUrl} width={880} height={560} alt="" style={{ display: "block" }} />
      </div>
      <div style={{ position: "absolute", left: 64, top: 170, width: 460, display: "flex", flexDirection: "column", gap: 22 }}>
        <span style={{ alignSelf: "flex-start", ...box({ borderRadius: 999, padding: "4px 14px", background: nc.butter }), fontSize: 14, fontWeight: 700 }}>{nt.levels[0]} → {nt.levels[3]}</span>
        <h1 style={title(88, { margin: 0, color: nc.ink, textShadow: `4px 4px 0 ${nc.gold}` })}>{nt.title}</h1>
        <p style={{ margin: 0, fontSize: 20, lineHeight: 1.7, color: nc.inkSoft, maxWidth: 420 }}>{nt.tagline}</p>
        <Btn onClick={newGame} style={{ width: 300, height: 76, fontSize: 34, marginTop: 10 }}>
          {nt.start} ▶
        </Btn>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <svg width="26" height="26" viewBox="-24 -36 48 64" aria-hidden="true">
            <path d="M-20 -8 Q0 -36 20 -8" fill="none" stroke={nc.ink} strokeWidth="4" />
            <path d="M-20 -8 L20 -8 L15 20 Q0 26 -15 20 Z" fill={nc.gold} stroke={nc.ink} strokeWidth="4" />
          </svg>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{nt.collection}</span>
          <span style={num(20)}>{nt.collectionCount(collection.length, ENDING_IDS.length)}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 440 }}>
          {ENDING_IDS.map((id) => {
            const got = collection.includes(id);
            return (
              <span
                key={id}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: `2px solid ${got ? nc.ink : nc.line}`,
                  background: got ? nc.goldSoft : nc.paper,
                  color: got ? nc.ink : nc.faint,
                  fontFamily: font.body,
                }}
              >
                {got ? nt.endings[id].name : nt.unknownEnding}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: 64, bottom: 28, fontSize: 12, color: nc.muted, display: "flex", gap: 18 }}>
        {nt.footer.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}
