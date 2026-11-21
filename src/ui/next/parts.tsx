// 新版界面共用的零件：卡片、按钮、商品图、头像、顶部栏、整屏缩放
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { font, nc } from "../theme/tokens";
import { nt } from "../../text/next";
import type { TopView } from "./store/selectors";

export const W = 1440;
export const H = 960;

/** 整个画面按 1440 × 960 画，按窗口大小等比缩放 */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = (): void => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: nc.cream, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: W,
          height: H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center",
          background: nc.cream,
          fontFamily: font.body,
          color: nc.ink,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export const box = (extra: CSSProperties = {}): CSSProperties => ({
  background: nc.paper,
  border: `3px solid ${nc.ink}`,
  borderRadius: 22,
  boxSizing: "border-box",
  ...extra,
});

export const shadow = (n = 4, c: string = nc.ink): string => `0 ${n}px 0 ${c}`;

export const title = (size: number, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: font.title, fontSize: size, fontWeight: 400, lineHeight: 1.15, ...extra });
export const num = (size: number, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: font.num, fontSize: size, fontWeight: 700, ...extra });

export function Btn({
  children,
  onClick,
  kind = "primary",
  style,
  disabled,
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "plain" | "ghost";
  style?: CSSProperties;
  disabled?: boolean;
  label?: string;
}) {
  const bg = disabled ? nc.line : kind === "primary" ? nc.gold : kind === "plain" ? nc.paper : "transparent";
  return (
    <button
      type="button"
      className="nx-press"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: bg,
        border: `3px solid ${nc.ink}`,
        borderRadius: 18,
        boxShadow: kind === "ghost" ? "none" : shadow(5),
        fontFamily: font.title,
        fontSize: 24,
        color: nc.ink,
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "0 18px",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** 小的加减按钮 */
export function Step({ children, onClick, label, gold, size = 38 }: { children: ReactNode; onClick: () => void; label: string; gold?: boolean; size?: number }) {
  return (
    <button
      type="button"
      className="nx-press"
      aria-label={label}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: gold ? nc.gold : nc.paper,
        border: `2.5px solid ${nc.ink}`,
        boxShadow: shadow(3),
        ...num(size > 34 ? 22 : 18),
        color: nc.ink,
        cursor: "pointer",
        lineHeight: 1,
        padding: 0,
        flex: "none",
      }}
    >
      {children}
    </button>
  );
}

export function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, ...box({ borderRadius: 999, padding: "5px 16px 5px 7px", boxShadow: shadow(4) }) }}>
      <svg width="34" height="34" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15" fill={nc.gold} stroke={nc.ink} strokeWidth="3" />
        <circle cx="18" cy="18" r="9" fill="none" stroke={nc.goldDeep} strokeWidth="3" />
        <path d="M14 12 l4 6 l4 -6 M13 19 h10 M18 18 v8" stroke={nc.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </svg>
      <span style={title(24, { lineHeight: 1 })}>{nt.title}</span>
    </div>
  );
}

export function TopBar({ top, onMap }: { top: TopView; onMap?: () => void }) {
  return (
    <div style={{ position: "absolute", left: 24, right: 24, top: 18, height: 56, display: "flex", alignItems: "center", gap: 14 }}>
      <Logo />
      <div style={{ display: "flex", alignItems: "center", gap: 10, ...box({ borderRadius: 999, padding: "6px 14px", boxShadow: shadow(4) }) }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{top.quarterLabel}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              style={{
                width: i === top.quarter ? 30 : 14,
                height: 14,
                borderRadius: 999,
                background: i < top.quarter ? nc.gold : i === top.quarter ? nc.orange : nc.paper,
                border: `2px solid ${i <= top.quarter ? nc.ink : nc.ghost}`,
                marginLeft: i === 4 ? 8 : 0,
                boxSizing: "border-box",
              }}
            />
          ))}
        </span>
      </div>
      <div style={{ flex: 1, ...box({ borderRadius: 20, padding: "6px 16px 8px", boxShadow: shadow(4), display: "flex", flexDirection: "column", gap: 4 }) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 13, color: nc.muted, fontWeight: 500 }}>
            {nt.top.netWorth} · {nt.levels[top.level]}
          </span>
          <span style={num(19)}>
            {nt.money(top.netWorthFen)} <span style={{ fontSize: 13, color: nc.muted, fontWeight: 500 }}>{nt.top.goal}</span>
          </span>
        </div>
        <div style={{ height: 12, background: nc.mist, border: `2px solid ${nc.ink}`, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${top.goalPct}%`, height: "100%", background: nc.gold, transition: "width .6s ease" }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", ...box({ borderRadius: 20, padding: "6px 16px", boxShadow: shadow(4) }), lineHeight: 1.15 }}>
        <span style={{ fontSize: 12, color: nc.muted, fontWeight: 500 }}>{nt.top.cash}</span>
        <span className="nx-num" style={num(21, { color: top.cashFen < 0 ? nc.red : nc.ink })}>
          {nt.signedMoney(top.cashFen).replace("+", "")}
        </span>
      </div>
      {onMap && (
        <button
          type="button"
          className="nx-press"
          onClick={onMap}
          style={{ height: 50, padding: "0 16px", ...box({ borderRadius: 999, boxShadow: shadow(4) }), display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 700, color: nc.ink, cursor: "pointer", fontFamily: font.body }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={nc.ink} strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" />
          </svg>
          {nt.top.map}
        </button>
      )}
    </div>
  );
}

/** 每种货的小图 */
export function ProductArt({ id, size = 46 }: { id: string; size?: number }) {
  const s = { stroke: nc.ink, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" aria-hidden="true" {...s}>
      {id === "phone_case" && (
        <>
          <rect x="12" y="4" width="22" height="38" rx="6" fill={nc.sky} />
          <circle cx="19" cy="11" r="3" fill={nc.paper} />
          <circle cx="27" cy="11" r="2" fill={nc.ink} stroke="none" />
          <path d="M18 30 q5 4 10 0" fill="none" stroke={nc.paper} />
        </>
      )}
      {id === "arm_sleeve" && (
        <>
          <path d="M8 8 h11 l3 32 h-11 z" fill={nc.mint} />
          <path d="M24 6 h11 l3 32 h-11 z" fill={nc.mintPale} />
          <path d="M9 14 h10.5 M25 12 h10.5" fill="none" />
        </>
      )}
      {id === "hijab" && (
        <>
          <path d="M23 4 C10 4 6 16 7 28 L4 42 H42 L39 28 C40 16 36 4 23 4 Z" fill={nc.lavender} />
          <ellipse cx="23" cy="20" rx="9" ry="10" fill={nc.skin} />
          <circle cx="19.5" cy="20" r="1.6" fill={nc.ink} stroke="none" />
          <circle cx="26.5" cy="20" r="1.6" fill={nc.ink} stroke="none" />
          <path d="M20 25 q3 2 6 0" fill="none" />
        </>
      )}
      {id === "mini_fan" && (
        <>
          <circle cx="23" cy="17" r="13" fill={nc.paper} />
          <path d="M23 17 C23 8 30 7 30 12 Z M23 17 C31 20 28 27 24 24 Z M23 17 C16 23 12 17 16 14 Z" fill={nc.orange} />
          <circle cx="23" cy="17" r="2.5" fill={nc.ink} stroke="none" />
          <rect x="20" y="30" width="6" height="13" rx="3" fill={nc.orange} />
        </>
      )}
      {id === "blouse" && (
        <>
          <path d="M16 5 L6 11 L3 30 L10 31 L12 18 L12 42 H34 L34 18 L36 31 L43 30 L40 11 L30 5 Q23 11 16 5 Z" fill={nc.coral} />
          <path d="M23 10 v30" fill="none" strokeDasharray="0.1 5" />
        </>
      )}
      {id === "earbuds" && (
        <>
          <rect x="7" y="22" width="32" height="20" rx="10" fill={nc.paper} />
          <path d="M7 31 h32" fill="none" />
          <path d="M14 4 a6 6 0 0 1 6 6 v12 h-5 v-8 a6 6 0 0 1 -1 -10 z" fill={nc.gold} />
          <path d="M32 4 a6 6 0 0 0 -6 6 v12 h5 v-8 a6 6 0 0 0 1 -10 z" fill={nc.gold} />
        </>
      )}
    </svg>
  );
}

const HAIR = [
  "M-10 0 Q-10 -12 0 -12 Q10 -12 10 0 Q6 -6 0 -6 Q-6 -6 -10 0 Z",
  "M-9 -3 Q-6 -13 0 -12 Q7 -13 9 -3 L6 -6 L3 -4 L0 -7 L-3 -4 L-6 -6 Z",
  "M-10 -1 Q-9 -12 0 -12 Q9 -12 10 -1 L10 -5 Q0 -9 -10 -5 Z",
];
const MY_HAIR = "M-10 -1 Q-10 -13 0 -12 Q10 -13 10 -1 Q4 -8 0 -5 Q-5 -9 -10 -1 Z";

/** 店主的头像：who = -1 是玩家，0 到 2 是对手 */
export function Face({ who, size = 34, bg }: { who: number; size?: number; bg: string }) {
  return (
    <svg width={size} height={size} viewBox="-17 -17 34 34" aria-hidden="true" style={{ flex: "none" }}>
      <g stroke={nc.ink} strokeWidth="2">
        <circle r="15" fill={bg} />
        <circle cy="3" r="10" fill={nc.skin} />
        <path d={who === -1 ? MY_HAIR : HAIR[who]} fill={nc.ink} />
        <circle cx="-3.5" cy="3" r="1.4" fill={nc.ink} stroke="none" />
        <circle cx="3.5" cy="3" r="1.4" fill={nc.ink} stroke="none" />
        <path d={who === 1 ? "M-3 9 L3 9" : "M-2.5 8 Q0 10 2.5 8"} fill="none" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** 店铺的小房子（等级越高越大越亮） */
export function ShopIcon({ level, size = 54, sad }: { level: number; size?: number; sad?: boolean }) {
  const roof = sad ? nc.coral : [nc.mint, nc.sky, nc.gold, nc.orange][level] ?? nc.gold;
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 64 58" aria-hidden="true">
      <g stroke={nc.ink} strokeWidth="2.6" strokeLinejoin="round">
        <rect x="6" y="20" width="52" height="36" rx="4" fill={nc.paper} />
        <path d="M2 22 L8 6 H56 L62 22 Z" fill={roof} />
        <path d="M2 22 q7.5 8 15 0 q7.5 8 15 0 q7.5 8 15 0 q7.5 8 15 0" fill={nc.paper} />
        {sad ? (
          <>
            <circle cx="24" cy="36" r="2.4" fill={nc.ink} stroke="none" />
            <circle cx="40" cy="36" r="2.4" fill={nc.ink} stroke="none" />
            <path d="M25 48 q7 -6 14 0" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <rect x="24" y="36" width="16" height="20" fill={nc.gold} />
            <rect x="10" y="34" width="10" height="9" fill={nc.sea} />
            <rect x="44" y="34" width="10" height="9" fill={nc.sea} />
          </>
        )}
      </g>
    </svg>
  );
}

/** 1 到 5 颗火 */
export function Fires({ n, hot }: { n: number; hot?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={hot && i <= n ? "nx-flick" : undefined} width="15" height="17" viewBox="0 0 14 16" aria-hidden="true">
          <path
            d="M7 1 C8 4 12 6 12 10 a5 5 0 0 1 -10 0 C2 7 4 6 5 3 C6 5 7 5 7 1 Z"
            fill={i <= n ? nc.coral : nc.mist}
            stroke={i <= n ? nc.ink : nc.line}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

/** 一个弹出的遮罩层 */
export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "absolute", inset: 0, background: nc.shade, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="nx-pop">
        {children}
      </div>
    </div>
  );
}
