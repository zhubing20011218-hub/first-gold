// 纪念海报（docs/10 第九节）：1080 × 1350，用 2D Canvas 画。主角是一只桶，桶里装多少金子按最后的净资产画。
// 这里只画图，不做游戏里的计算：所有数字都是算好了传进来的。颜色只来自设计变量。字重只用 500、700（docs/07 第二节）。
import { color, world } from "../../theme/tokens";

export type PosterEnding = "goal" | "survived" | "bankrupt" | "banned";

export interface PosterData {
  ending: PosterEnding;
  /** 已经排好的文字 */
  text: {
    title: string;
    subtitle: string;
    headline: string;
    stamp: string;
    netWorth: string;
    fromTo: string;
    stats: { label: string; value: string }[];
    footer: string;
    seed: string;
    goalLabel: string;
  };
  fillBp: number;
  overflow: number;
  /** 两年每一天的现金（分），画曲线用 */
  cashCurve: number[];
}

export const POSTER_W = 1080;
export const POSTER_H = 1350;

const NUM = '"Barlow Semi Condensed", "PingFang SC", sans-serif';
const SANS = '"PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif';

/** 倒闭时整张图偏灰 */
function tone(c: string, gray: boolean): string {
  if (!gray) return c;
  const n = parseInt(c.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const y = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  const mix = (v: number): number => Math.round(v * 0.25 + y * 0.75);
  const hex = (v: number): string => mix(v).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** 桶的形状：上宽下窄，带一圈桶箍 */
function bucketPath(ctx: CanvasRenderingContext2D, cx: number, top: number, h: number, wTop: number, wBottom: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - wTop / 2, top);
  ctx.lineTo(cx - wBottom / 2, top + h);
  ctx.quadraticCurveTo(cx, top + h + 34, cx + wBottom / 2, top + h);
  ctx.lineTo(cx + wTop / 2, top);
  ctx.closePath();
}

function coin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tilt: number, gray: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = tone(color.gold, gray);
  ctx.strokeStyle = color.ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = tone(color.goldText, gray);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.62, r * 0.56, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function stamp(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, c: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((6 * Math.PI) / 180);
  ctx.font = `700 64px ${SANS}`;
  const w = ctx.measureText(text).width + 56;
  const h = 100;
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 18);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 4);
  ctx.restore();
}

function drawBucket(ctx: CanvasRenderingContext2D, d: PosterData, gray: boolean): void {
  const cx = POSTER_W / 2;
  const top = 400;
  const h = 400;
  const wTop = 440;
  const wBottom = 330;
  const ink = color.ink;

  // 影子
  ctx.fillStyle = tone(world.gray, gray);
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(cx, top + h + 40, wTop * 0.62, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // 桶身：浅色，金子装到哪里一眼看得出来
  bucketPath(ctx, cx, top, h, wTop, wBottom);
  ctx.fillStyle = tone(color.seaSoft, gray);
  ctx.fill();

  // 桶里的金子：按 fillBp 的高度，裁在桶的形状里
  const fill = d.ending === "bankrupt" ? 0 : d.fillBp;
  if (fill > 0) {
    ctx.save();
    bucketPath(ctx, cx, top, h, wTop, wBottom);
    ctx.clip();
    const level = top + h + 20 - ((h + 20) * fill) / 10000;
    ctx.fillStyle = tone(color.gold, gray);
    ctx.fillRect(cx - wTop, level, wTop * 2, h + 60);
    // 金子表面一层圆圆的金币
    for (let i = 0; i < 9; i++) {
      coin(ctx, cx - wTop / 2 + 40 + i * ((wTop - 80) / 8), level + 6 + (i % 2) * 10, 30, (i % 3) * 0.3, gray);
    }
    ctx.restore();
  }

  // 木条（竖线）、桶箍、外框
  ctx.save();
  bucketPath(ctx, cx, top, h, wTop, wBottom);
  ctx.clip();
  ctx.strokeStyle = tone(color.line, gray);
  ctx.lineWidth = 4;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + (i * wTop) / 8, top);
    ctx.lineTo(cx + (i * wBottom) / 8, top + h + 30);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 6;
  bucketPath(ctx, cx, top, h, wTop, wBottom);
  ctx.stroke();
  for (const t of [0.18, 0.78]) {
    const y = top + h * t;
    const half = (wTop + (wBottom - wTop) * t) / 2;
    ctx.fillStyle = tone(color.sea, gray);
    ctx.fillRect(cx - half, y - 12, half * 2, 24);
    ctx.strokeRect(cx - half, y - 12, half * 2, 24);
  }
  // 桶口
  ctx.fillStyle = tone(fill >= 10000 ? color.gold : world.dock, gray);
  ctx.beginPath();
  ctx.ellipse(cx, top, wTop / 2, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (d.ending === "goal") {
    // 装满了：桶口一堆金币，再按 overflow 从两边溢出来，几道亮光
    for (let i = 0; i < 7; i++) coin(ctx, cx - 150 + i * 50, top - 18 - (i % 2) * 22, 32, i * 0.4, gray);
    for (let i = 0; i < d.overflow; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const k = Math.floor(i / 2);
      coin(ctx, cx + side * (wTop / 2 + 40 + k * 26), top + 70 + k * 72, 30, side * (0.6 + k * 0.1), gray);
    }
    ctx.strokeStyle = color.gold;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    for (const [x1, y1, x2, y2] of [
      [cx - 290, top - 70, cx - 250, top - 40],
      [cx, top - 110, cx, top - 75],
      [cx + 290, top - 70, cx + 250, top - 40],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  if (d.ending === "survived") {
    // 目标的虚线
    ctx.save();
    ctx.setLineDash([18, 14]);
    ctx.strokeStyle = color.goldText;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - wTop / 2 - 50, top - 40);
    ctx.lineTo(cx + wTop / 2 + 50, top - 40);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = color.goldText;
    ctx.font = `700 34px ${SANS}`;
    ctx.textAlign = "left";
    ctx.fillText(d.text.goalLabel, cx + wTop / 2 + 60, top - 30);
  }
  if (d.ending === "bankrupt") {
    // 一道裂缝
    ctx.strokeStyle = ink;
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 40, top + 40);
    ctx.lineTo(cx + 10, top + 140);
    ctx.lineTo(cx - 30, top + 230);
    ctx.lineTo(cx + 30, top + 340);
    ctx.stroke();
  }
  if (d.ending === "banned") {
    // 桶口贴两道封条
    ctx.save();
    ctx.translate(cx, top);
    for (const a of [-0.25, 0.25]) {
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = color.paper;
      ctx.strokeStyle = color.hibiscus;
      ctx.lineWidth = 6;
      ctx.fillRect(-wTop / 2 - 30, -24, wTop + 60, 48);
      ctx.strokeRect(-wTop / 2 - 30, -24, wTop + 60, 48);
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawCurve(ctx: CanvasRenderingContext2D, data: number[], x: number, y: number, w: number, h: number, gray: boolean): void {
  if (data.length < 2) return;
  const min = Math.min(0, ...data);
  const max = Math.max(1, ...data);
  const px = (i: number): number => x + (i / (data.length - 1)) * w;
  const py = (v: number): number => y + h - ((v - min) / (max - min)) * h;
  // 0 的那条线
  ctx.strokeStyle = color.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, py(0));
  ctx.lineTo(x + w, py(0));
  ctx.stroke();
  ctx.strokeStyle = tone(color.sea, gray);
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  data.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v))));
  ctx.stroke();
  // 最低点
  let lo = 0;
  data.forEach((v, i) => {
    if (v < data[lo]) lo = i;
  });
  ctx.fillStyle = data[lo] < 0 ? color.hibiscus : tone(color.gold, gray);
  ctx.strokeStyle = color.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(px(lo), py(data[lo]), 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** 印章斜盖在桶身的右上方，不挡桶口 */
const top0Stamp = 560;

export function drawPoster(ctx: CanvasRenderingContext2D, d: PosterData): void {
  const gray = d.ending === "bankrupt";
  const cx = POSTER_W / 2;
  ctx.clearRect(0, 0, POSTER_W, POSTER_H);
  ctx.fillStyle = tone(d.ending === "goal" ? color.goldSoft : color.seaSoft, gray);
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  // 外框，像界面上的卡片
  ctx.fillStyle = color.paper;
  ctx.strokeStyle = color.ink;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(40, 40, POSTER_W - 80, POSTER_H - 80, 36);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = color.ink;
  ctx.font = `700 104px ${SANS}`;
  ctx.fillText(d.text.title, cx, 190);
  ctx.fillStyle = color.muted;
  ctx.font = `500 36px ${SANS}`;
  ctx.fillText(d.text.subtitle, cx, 250);

  drawBucket(ctx, d, gray);
  const stampColor = d.ending === "goal" ? color.goldText : d.ending === "survived" ? color.sea : color.hibiscus;
  stamp(ctx, d.text.stamp, cx + 300, top0Stamp, stampColor);

  ctx.textAlign = "center";
  ctx.fillStyle = color.ink;
  ctx.font = `700 52px ${SANS}`;
  ctx.fillText(d.text.headline, cx, 920);
  ctx.fillStyle = d.ending === "goal" ? color.goldText : color.ink;
  ctx.font = `700 112px ${NUM}`;
  ctx.fillText(d.text.netWorth, cx, 1030);
  ctx.fillStyle = color.muted;
  ctx.font = `500 36px ${NUM}`;
  ctx.fillText(d.text.fromTo, cx, 1080);

  drawCurve(ctx, d.cashCurve, 120, 1100, POSTER_W - 240, 70, gray);

  const n = d.text.stats.length;
  d.text.stats.forEach((s, i) => {
    const x = 120 + ((POSTER_W - 240) * (i + 0.5)) / n;
    ctx.fillStyle = color.ink;
    ctx.font = `700 44px ${NUM}`;
    ctx.fillText(s.value, x, 1222);
    ctx.fillStyle = color.muted;
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText(s.label, x, 1258);
  });

  ctx.fillStyle = color.muted;
  ctx.font = `400 22px ${SANS}`;
  ctx.fillText(`${d.text.seed} · ${d.text.footer}`, cx, POSTER_H - 52);
}
