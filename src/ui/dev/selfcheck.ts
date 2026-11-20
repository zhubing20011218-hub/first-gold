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

/** 弹窗打开时只查弹窗里面的东西（docs/11 S1） */
function scope(): Element {
  const dialogs = Array.from(document.querySelectorAll("[role='dialog']")).filter(visible);
  return dialogs[dialogs.length - 1] ?? document.body;
}

/** S1 没有左右滚动，也没有东西跑出窗口：每个看得见的元素左边不小于 0、右边不大于窗口宽；页面和每个可以滚动的区域都没有左右滚动 */
export function s1(): CheckResult {
  const bad: string[] = [];
  const w = window.innerWidth;
  if (document.documentElement.scrollWidth > w) bad.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${w}`);
  for (const el of Array.from(scope().querySelectorAll("*"))) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.left < -0.5 || r.right > w + 0.5) bad.push(`${describe(el)} ${Math.round(r.left)}..${Math.round(r.right)}`);
    const st = getComputedStyle(el);
    if ((st.overflowX === "auto" || st.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) bad.push(`${describe(el)} scrollWidth ${el.scrollWidth} > ${el.clientWidth}`);
  }
  return { id: "S1", pass: bad.length === 0, offenders: bad.slice(0, 5) };
}

/** S3 没有小于 12 像素的文字（包括输入框里的字和 ::before、::after 里的字） */
export function s3(): CheckResult {
  const small = (st: CSSStyleDeclaration): boolean => parseFloat(st.fontSize) < 12;
  const bad: Element[] = textElements().filter((el) => small(getComputedStyle(el)));
  for (const el of Array.from(document.querySelectorAll("input, textarea, select")).filter(visible)) if (small(getComputedStyle(el))) bad.push(el);
  for (const el of Array.from(document.body.querySelectorAll("*")).filter(visible)) {
    for (const pseudo of ["::before", "::after"]) {
      const st = getComputedStyle(el, pseudo);
      const c = st.content;
      if (c && c !== "none" && c !== "normal" && c !== '""' && small(st)) bad.push(el);
    }
  }
  return { id: "S3", pass: bad.length === 0, offenders: bad.slice(0, 5).map(describe) };
}

/** 可以点的东西（docs/11 S4） */
const TAPPABLE =
  "button, input:not([type='hidden']), select, textarea, a[href], [role='button'], [role='radio'], [role='tab'], [role='slider'], [role='checkbox'], [role='switch']";

/** S4 可以点的区域：窗口宽小于 768 时不小于 44 × 44，其他时候不小于 32 × 32 */
export function s4(): CheckResult {
  const min = window.innerWidth < 768 ? 44 : 32;
  const bad = Array.from(document.querySelectorAll(TAPPABLE)).filter((el) => {
    if (!visible(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width < min - 0.5 || r.height < min - 0.5;
  });
  return { id: "S4", pass: bad.length === 0, offenders: bad.slice(0, 5).map((el) => `${describe(el)} < ${min}`) };
}

/** 最近的一个会切掉内容的上层元素（overflow 不是 visible） */
function clipper(el: Element): { box: Element; scrolls: boolean } | null {
  for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
    const st = getComputedStyle(p);
    if (st.overflowX !== "visible" || st.overflowY !== "visible") {
      // 页面这一层（body、#root）的上下由 S2 管，这里和可以滚动的区域一样只查左右
      const page = p === document.body || p.id === "root";
      return { box: p, scrolls: page || st.overflowX === "auto" || st.overflowX === "scroll" || st.overflowY === "auto" || st.overflowY === "scroll" };
    }
  }
  return null;
}

/** S7 没有文字超出自己的框，没有被上层的框切掉，也没有被同一块里的按钮盖住（行内的金额、数字也查） */
export function s7(): CheckResult {
  const bad = textElements().filter((el) => {
    const s = getComputedStyle(el);
    if (s.display !== "inline" && (el.scrollWidth > el.clientWidth + 1 || (s.overflow !== "visible" && el.scrollHeight > el.clientHeight + 1))) return true;
    // 被同一块（同一个 section）里的按钮盖住
    const sec = el.closest("section");
    if (sec) {
      const r0 = el.getBoundingClientRect();
      for (const btn of Array.from(sec.querySelectorAll("button, [role='button']"))) {
        if (btn.contains(el) || el.contains(btn) || btn.closest("section") !== sec || !visible(btn)) continue;
        const r1 = btn.getBoundingClientRect();
        if (r0.left < r1.right - 1 && r1.left < r0.right - 1 && r0.top < r1.bottom - 1 && r1.top < r0.bottom - 1) return true;
      }
    }
    const c = clipper(el);
    if (!c) return false;
    const r = el.getBoundingClientRect();
    const b = c.box.getBoundingClientRect();
    const outX = r.left < b.left - 1 || r.right > b.right + 1;
    // 可以上下滚动的区域，内容本来就会在下面：只查左右
    const outY = !c.scrolls && (r.top < b.top - 1 || r.bottom > b.bottom + 1);
    return outX || outY;
  });
  // 功能区是固定高度的卡片：里面的东西不能伸出内边距（docs/07 第四节）
  const spill: string[] = [];
  for (const panel of Array.from(document.querySelectorAll("[data-area]")).filter(visible)) {
    const pr = panel.getBoundingClientRect();
    const st = getComputedStyle(panel);
    const bottom = pr.bottom - parseFloat(st.borderBottomWidth) - parseFloat(st.paddingBottom);
    for (const child of Array.from(panel.querySelectorAll("*")).filter(visible)) {
      if (child.closest("[data-reminder]")) continue;
      if (child.getBoundingClientRect().bottom > bottom + 1) {
        spill.push(`${describe(panel)} > ${describe(child)}`);
        break;
      }
    }
  }
  const all = [...bad.map(describe), ...spill];
  return { id: "S7", pass: all.length === 0, offenders: all.slice(0, 5) };
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
