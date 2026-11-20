// 页面自检（docs/13 第四节）。截图脚本和 ?debug=1 的面板共用这一份。
// 任务 06 第一步只有 S1、S3、S4、S7；S12、S13、S14 在第三步加上。
// 只读页面，不改任何东西。

export interface CheckResult {
  id: string;
  pass: boolean;
  /** 不通过的是哪个元素，最多列 5 个 */
  offenders: string[];
}

function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent ?? "").trim().slice(0, 16);
  const mark =
    el.getAttribute("data-region") ?? (el.hasAttribute("data-area") ? `area ${el.getAttribute("data-area")}` : null) ?? el.getAttribute("data-world-label") ?? el.getAttribute("aria-label") ?? "";
  return `${tag}${mark ? `[${mark}]` : ""}${text ? ` "${text}"` : ""}`;
}

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
}

function textElements(): HTMLElement[] {
  const out: HTMLElement[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set<HTMLElement>();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent || n.textContent.trim() === "") continue;
    const el = n.parentElement;
    if (!el || seen.has(el) || el.closest(".sr-only, svg, script, style, [aria-hidden='true']")) continue;
    seen.add(el);
    if (visible(el)) out.push(el);
  }
  return out;
}

/** S1 没有左右滚动 */
export function s1(): CheckResult {
  const pass = document.documentElement.scrollWidth <= window.innerWidth;
  return { id: "S1", pass, offenders: pass ? [] : [`scrollWidth ${document.documentElement.scrollWidth} > ${window.innerWidth}`] };
}

/** S3 没有小于 12 像素的文字 */
export function s3(): CheckResult {
  const bad = textElements().filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12);
  return { id: "S3", pass: bad.length === 0, offenders: bad.slice(0, 5).map(describe) };
}

/** S4 窗口宽度小于 768 时，按钮和输入框的点击区域不小于 44 × 44 */
export function s4(): CheckResult {
  if (window.innerWidth >= 768) return { id: "S4", pass: true, offenders: [] };
  const bad = Array.from(document.querySelectorAll("button, input, [role='button'], [role='radio'], a[href]")).filter((el) => {
    if (!visible(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width < 44 - 0.5 || r.height < 44 - 0.5;
  });
  return { id: "S4", pass: bad.length === 0, offenders: bad.slice(0, 5).map(describe) };
}

/** S7 没有文字超出自己的框 */
export function s7(): CheckResult {
  const bad = textElements().filter((el) => {
    const s = getComputedStyle(el);
    if (s.display === "inline") return false;
    return el.scrollWidth > el.clientWidth + 1 || (s.overflow !== "visible" && el.scrollHeight > el.clientHeight + 1);
  });
  return { id: "S7", pass: bad.length === 0, offenders: bad.slice(0, 5).map(describe) };
}

export function runSelfcheck(): CheckResult[] {
  return [s1(), s3(), s4(), s7()];
}

declare global {
  interface Window {
    __selfcheck?: () => CheckResult[];
  }
}

/** 网址里有 debug、demo、gallery 任何一个参数时，提供 window.__selfcheck() */
export function installSelfcheck(search: string): void {
  const p = new URLSearchParams(search);
  if (p.has("debug") || p.has("demo") || p.has("gallery")) window.__selfcheck = runSelfcheck;
}
