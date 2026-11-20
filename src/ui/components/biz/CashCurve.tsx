// 两年的现金曲线（任务 08 第一节第 2 条）：每一天一个点，用 SVG 画，不引入图表库。
// 标出最低点和最关键的那个决定所在的季度。SVG 里不放字（字放在下面，用网页文字）。
import clsx from "clsx";

export interface CashCurveProps {
  curve: number[];
  lowIndex: number | null;
  keyQuarter: number | null;
  gray?: boolean;
  className?: string;
}

const W = 600;
const H = 140;

export function CashCurve({ curve, lowIndex, keyQuarter, gray = false, className }: CashCurveProps) {
  if (curve.length < 2) return <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden />;
  const max = Math.max(0, ...curve);
  const min = Math.min(0, ...curve);
  const span = Math.max(1, max - min);
  // 横轴按两年 720 天算，倒闭和封店的局曲线在中途结束
  const days = Math.max(720, curve.length);
  const x = (i: number): number => (i / (days - 1)) * W;
  const y = (v: number): number => H - 8 - ((v - min) / span) * (H - 16);
  const points = curve.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      {keyQuarter !== null && <rect x={x(keyQuarter * 90)} y={0} width={x(89)} height={H} className="fill-gold-soft" />}
      {[1, 2, 3, 4, 5, 6, 7].map((q) => (
        <line key={q} x1={x(q * 90)} x2={x(q * 90)} y1={0} y2={H} className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-muted" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <polyline points={points} fill="none" className={clsx(gray ? "stroke-muted" : "stroke-sea")} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {lowIndex !== null && <circle cx={x(lowIndex)} cy={y(curve[lowIndex])} r={5} className="fill-hibiscus" />}
    </svg>
  );
}
