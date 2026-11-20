// 本地最好成绩（任务 08 第一节第 9 条）：每种商品的最高净资产存在浏览器本地。读写失败（隐私模式、存储被禁用）时不报错，当作没有。
const KEY = "first-gold.best";

export function readBest(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : {};
    if (!v || typeof v !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) if (typeof n === "number" && Number.isFinite(n)) out[k] = n;
    return out;
  } catch {
    return {};
  }
}

/** 这一局比这种商品以前的最好成绩高时才写进去 */
export function saveBest(productId: string, netWorthFen: number): void {
  try {
    const best = readBest();
    if (best[productId] !== undefined && best[productId] >= netWorthFen) return;
    window.localStorage.setItem(KEY, JSON.stringify({ ...best, [productId]: netWorthFen }));
  } catch {
    // 存不了就算了，不影响游戏
  }
}
