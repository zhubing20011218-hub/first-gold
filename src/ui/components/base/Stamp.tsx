// 印章（docs/10 第八节）：圆角矩形，3 像素的边，最粗的字，顺时针转 6 度。可以播放"盖下来"
import clsx from "clsx";
import { motion, useReducedMotion } from "motion/react";

export type StampTone = "gold" | "sea" | "hibiscus";

export interface StampProps {
  text: string;
  tone: StampTone;
  size?: "sm" | "lg";
  animate?: boolean;
}

export function Stamp({ text, tone, size = "sm", animate = false }: StampProps) {
  const reduce = useReducedMotion();
  const cls = clsx(
    "inline-block rotate-6 rounded-control border-3 font-bold whitespace-nowrap",
    size === "lg" ? "px-6 py-2 text-screen" : "px-2 text-em",
    tone === "gold" && "border-gold-text text-gold-text",
    tone === "sea" && "border-sea-text text-sea-text",
    tone === "hibiscus" && "border-hibiscus-text text-hibiscus-text",
  );
  if (!animate || reduce) return <span className={cls}>{text}</span>;
  return (
    <motion.span className={cls} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25 }}>
      {text}
    </motion.span>
  );
}
