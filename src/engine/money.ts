// 钱的换算和显示。仙（sen）和分（fen）之间只能通过这里换算（docs/02 第一节）。

/** 按比例算一项费用。amount 是不小于 0 的整数，bp 是万分之几。正好一半时进位。 */
export function applyBp(amount: number, bp: number): number {
  return Math.floor((amount * bp + 5000) / 10000);
}

/** 仙换成分。对绝对值取整，再加回正负号。 */
export function senToFen(sen: number, cnyPerRmE4: number): number {
  const abs = Math.floor((Math.abs(sen) * cnyPerRmE4 + 5000) / 10000);
  return sen < 0 ? -abs : abs;
}

/** 分换成仙，只用于显示。 */
export function fenToSen(fen: number, cnyPerRmE4: number): number {
  const abs = Math.round((Math.abs(fen) * 10000) / cnyPerRmE4);
  return fen < 0 ? -abs : abs;
}

/** 把 6.9 这样的林吉特数变成仙 */
export function rmToSen(rm: number): number {
  return Math.round(rm * 100);
}

/** 把 12.34 这样的人民币元数变成分 */
export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100);
}

/** 整数的分或仙，显示成 1,234.56 */
function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${whole}.${frac}`;
}

/** 显示成 RM 12.77、RM 3,030.30、-RM 12.65 */
export function formatRM(sen: number): string {
  return `${sen < 0 ? "-" : ""}RM ${formatCents(sen)}`;
}

/** 显示成 ¥1,234.56、-¥20.87 */
export function formatYuan(fen: number): string {
  return `${fen < 0 ? "-" : ""}¥${formatCents(fen)}`;
}
