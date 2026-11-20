// 自动检查（docs/13 第二节）。
//   npm run check                 K1 到 K5
//   npm run check:full            K1 到 K8
//   ... -- --task 03              任务 01 到 03 应该有的核对用例都必须有
//   ... -- --accept               全部通过时，把通过的测试条数记进基线（只有检查员用）
// 只用 Node 自带的模块，不新增依赖。
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AUTO_DIR = join(ROOT, "检查记录", "自动");
const BASELINE = join(ROOT, "检查记录", "基线.json");
const MANIFEST = join(ROOT, "规则包清单.sha256");
const BIN = join(ROOT, "node_modules", ".bin");
const JS_GZIP_LIMIT = 600 * 1024;
const MAX_REASON_LINES = 30;

// ---------- 参数 ----------
const args = process.argv.slice(2);
const full = args.includes("--full");
const accept = args.includes("--accept");
const taskIdx = args.indexOf("--task");
const task = taskIdx >= 0 ? Number.parseInt(args[taskIdx + 1], 10) : null;
if (taskIdx >= 0 && !Number.isInteger(task)) {
  console.error("--task 后面要写任务编号，例如 --task 03");
  process.exit(2);
}

// ---------- 小工具 ----------
function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, error: r.error };
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === ".DS_Store") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function tail(text, n = MAX_REASON_LINES) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  return lines.length > n ? [...lines.slice(0, n), `……（还有 ${lines.length - n} 行）`] : lines;
}

const results = [];
function record(id, name, status, reasons = []) {
  // status: "pass" | "fail" | "none"（还没有）
  results.push({ id, name, status, reasons: reasons.slice(0, MAX_REASON_LINES) });
}

// ---------- K1 规则包没有被改 ----------
let kitVersion = "未知";
function checkK1() {
  if (!existsSync(MANIFEST)) {
    record("K1", "规则包没有被改", "fail", ["找不到 规则包清单.sha256"]);
    return;
  }
  const lines = readFileSync(MANIFEST, "utf8").split("\n");
  const verMatch = lines[0]?.match(/第\s*(\d+)\s*版/);
  if (verMatch) kitVersion = verMatch[1];
  const reasons = [];
  const listed = new Set();
  for (const line of lines) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const m = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
    if (!m) {
      reasons.push(`清单里有一行格式不对：${line}`);
      continue;
    }
    const [, hash, path] = m;
    listed.add(path);
    const abs = join(ROOT, path);
    if (!existsSync(abs)) reasons.push(`文件不见了：${path}`);
    else if (sha256(abs) !== hash) reasons.push(`文件被改了：${path}`);
  }
  // 规则包的文件夹里多出来的文件也算被改
  for (const dir of ["docs", "参考图", join(".qoder", "agents")]) {
    for (const abs of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, abs);
      if (!listed.has(rel)) reasons.push(`规则包里多了一个文件：${rel}`);
    }
  }
  if (!listed.has("AGENTS.md")) reasons.push("清单里没有 AGENTS.md");
  record("K1", `规则包没有被改（第 ${kitVersion} 版）`, reasons.length === 0 ? "pass" : "fail", reasons);
}

// ---------- K2 类型检查 ----------
function checkK2() {
  const r = run(join(BIN, "tsc"), ["--noEmit"]);
  record("K2", "类型检查", r.code === 0 ? "pass" : "fail", r.code === 0 ? [] : tail(r.out));
}

// ---------- K3 测试 ----------
let vitest = null; // vitest 的 JSON 结果
let passedTests = 0;
function checkK3() {
  mkdirSync(AUTO_DIR, { recursive: true });
  const outFile = join(AUTO_DIR, "vitest.json");
  const r = run(join(BIN, "vitest"), ["run", "--reporter=json", `--outputFile=${outFile}`]);
  if (!existsSync(outFile)) {
    record("K3", "测试", "fail", ["vitest 没有产生结果", ...tail(r.out)]);
    return;
  }
  vitest = JSON.parse(readFileSync(outFile, "utf8"));
  const all = vitest.testResults.flatMap((f) =>
    f.assertionResults.map((a) => ({ ...a, file: relative(ROOT, f.name) })),
  );
  passedTests = all.filter((a) => a.status === "passed").length;
  const failed = all.filter((a) => a.status === "failed");
  const skipped = all.filter((a) => a.status !== "passed" && a.status !== "failed");
  const fileErrors = vitest.testResults.filter((f) => f.status === "failed" && f.assertionResults.length === 0);

  const reasons = [];
  for (const f of fileErrors) reasons.push(`测试文件出错：${relative(ROOT, f.name)} ${tail(f.message ?? "", 3).join(" ")}`);
  for (const a of failed) {
    reasons.push(`没通过：${a.file} › ${a.fullName}`);
    // 只留错误说明，去掉调用栈
    const msg = (a.failureMessages ?? [])
      .join("\n")
      .split("\n")
      .filter((l) => !/^\s*at\s/.test(l))
      .join("\n");
    for (const l of tail(msg, 4)) reasons.push(`    ${l}`);
  }
  for (const a of skipped) reasons.push(`被跳过（${a.status}）：${a.file} › ${a.fullName}`);
  if (all.length === 0) reasons.push("一条测试都没有");
  const ok = reasons.length === 0 && r.code === 0;
  if (!ok && reasons.length === 0) reasons.push(...tail(r.out));
  record("K3", `测试（${all.length} 条）`, ok ? "pass" : "fail", reasons);
}

// ---------- K4 测试没有变少 ----------
function checkK4() {
  const reasons = [];
  const banned = /\.(skip|only|todo)\b|\bxit\s*\(|\bxdescribe\s*\(|\bxtest\s*\(|\.skipIf\s*\(|\.runIf\s*\(/;
  for (const abs of walk(join(ROOT, "tests"))) {
    const rel = relative(ROOT, abs);
    readFileSync(abs, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (banned.test(line)) reasons.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
  }
  let base = 0;
  let label = "还没有基线";
  if (existsSync(BASELINE)) {
    base = JSON.parse(readFileSync(BASELINE, "utf8")).passedTests ?? 0;
    label = `基线 ${base}`;
  }
  if (vitest === null) reasons.push("测试没有运行成功，数不出通过的条数");
  else if (passedTests < base) reasons.push(`通过的测试 ${passedTests} 条，比基线 ${base} 条少`);
  record("K4", `测试没有变少（${label}）`, reasons.length === 0 ? "pass" : "fail", reasons);
}

// ---------- K5 核对用例齐全 ----------
function checkK5() {
  const listFile = join(ROOT, "docs", "核对用例清单.json");
  if (!existsSync(listFile)) {
    record("K5", "核对用例齐全", "fail", ["找不到 docs/核对用例清单.json"]);
    return;
  }
  const { groups } = JSON.parse(readFileSync(listFile, "utf8"));
  if (vitest === null) {
    record("K5", "核对用例齐全", "fail", ["测试没有运行成功，查不了核对用例"]);
    return;
  }
  const byGroup = new Map();
  for (const f of vitest.testResults) {
    for (const a of f.assertionResults) {
      const m = a.title.match(/^\[(G[0-9.-]+)#(\d{2})\]/);
      if (!m) continue;
      if (!byGroup.has(m[1])) byGroup.set(m[1], []);
      byGroup.get(m[1]).push({ n: Number.parseInt(m[2], 10), status: a.status, title: a.title });
    }
  }
  const reasons = [];
  let complete = 0;
  let missing = 0;
  const known = new Set(groups.map((g) => g.id));
  for (const id of byGroup.keys()) {
    if (!known.has(id)) reasons.push(`测试里有清单之外的组：${id}`);
  }
  for (const g of groups) {
    const cases = byGroup.get(g.id) ?? [];
    const required = task !== null && g.task <= task;
    if (cases.length === 0) {
      if (required) reasons.push(`${g.id}（${g.source}）：任务 ${String(g.task).padStart(2, "0")} 就该有，一条都没有`);
      missing++;
      continue;
    }
    const nums = new Set(cases.map((c) => c.n));
    const lack = [];
    for (let i = 1; i <= g.count; i++) if (!nums.has(i)) lack.push(String(i).padStart(2, "0"));
    const extra = cases.filter((c) => c.n < 1 || c.n > g.count).map((c) => c.title);
    const dup = cases.length !== nums.size;
    const bad = cases.filter((c) => c.status !== "passed");
    if (lack.length > 0) reasons.push(`${g.id}：应有 ${g.count} 条，缺 #${lack.join("、#")}`);
    if (extra.length > 0) reasons.push(`${g.id}：编号超出范围 ${extra.join("；")}`);
    if (dup) reasons.push(`${g.id}：有重复的编号`);
    for (const c of bad) reasons.push(`${g.id}：没通过 ${c.title}`);
    if (lack.length === 0 && extra.length === 0 && !dup && bad.length === 0) complete++;
  }
  const missingLabel = missing > 0 ? `，${missing} 组还没有` : "";
  record("K5", `核对用例齐全（${complete} 组齐${missingLabel}）`, reasons.length === 0 ? "pass" : "fail", reasons);
}

// ---------- K6 打包和体积 ----------
function checkK6() {
  const r = run(join(BIN, "vite"), ["build"]);
  if (r.code !== 0) {
    record("K6", "打包和体积", "fail", ["vite build 失败", ...tail(r.out)]);
    return;
  }
  const jsFiles = walk(join(ROOT, "dist")).filter((f) => f.endsWith(".js"));
  const gz = jsFiles.reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0);
  const kb = (gz / 1024).toFixed(1);
  const ok = gz <= JS_GZIP_LIMIT;
  record("K6", `打包和体积（JS 压缩后 ${kb} KB / 600 KB）`, ok ? "pass" : "fail", ok ? [] : [`JS 压缩后 ${kb} KB，超过 600 KB`]);
}

// ---------- K7 画面 ----------
function checkK7() {
  if (!existsSync(join(ROOT, "scripts", "shots.ts"))) {
    record("K7", "画面", "none");
    return;
  }
  const r = run("npm", ["run", "shots"]);
  record("K7", "画面", r.code === 0 ? "pass" : "fail", r.code === 0 ? [] : tail(r.out));
}

// ---------- K8 模拟报告是最新的 ----------
function checkK8() {
  const report = join(ROOT, "模拟报告.md");
  if (!existsSync(join(ROOT, "scripts", "simulate.ts")) || !existsSync(report)) {
    record("K8", "模拟报告是最新的", "none");
    return;
  }
  const before = readFileSync(report, "utf8");
  const r = run("npm", ["run", "sim"]);
  if (r.code !== 0) {
    record("K8", "模拟报告是最新的", "fail", ["npm run sim 失败", ...tail(r.out)]);
    return;
  }
  const after = readFileSync(report, "utf8");
  record(
    "K8",
    "模拟报告是最新的",
    before === after ? "pass" : "fail",
    before === after ? [] : ["重新运行 npm run sim 之后，模拟报告.md 变了。请提交新的报告"],
  );
}

// ---------- 运行 ----------
checkK1();
checkK2();
checkK3();
checkK4();
checkK5();
if (full) {
  checkK6();
  checkK7();
  checkK8();
}

const STATUS = { pass: "通过", fail: "不通过", none: "还没有" };
// 中文在终端里占两格，按显示宽度对齐
const displayWidth = (t) => [...t].reduce((w, ch) => w + (/[\u1100-\uffff]/.test(ch) ? 2 : 1), 0);
const width = Math.max(...results.map((r) => displayWidth(`${r.id} ${r.name}`))) + 3;
for (const r of results) {
  const label = `${r.id} ${r.name}`;
  console.log(`${label}${" ".repeat(width - displayWidth(label))}${STATUS[r.status]}`);
  if (r.status === "fail") for (const reason of r.reasons) console.log(`    ${reason}`);
}
const allOk = results.every((r) => r.status !== "fail");
console.log(`自动检查${full ? "（全部）" : ""}：${allOk ? "通过" : "不通过"}`);

// 写 检查记录/自动/最新.json
const git = (a) => run("git", a).out.trim();
const commit = git(["rev-parse", "--short", "HEAD"]) || "还没有提交";
const dirty = git(["status", "--porcelain"]) !== "";
mkdirSync(AUTO_DIR, { recursive: true });
writeFileSync(
  join(AUTO_DIR, "最新.json"),
  `${JSON.stringify(
    {
      commit: /^[0-9a-f]+$/.test(commit) ? commit : null,
      uncommittedChanges: dirty,
      kitVersion,
      full,
      task,
      passed: allOk,
      passedTests,
      items: results.map(({ id, name, status, reasons }) => ({ id, name, status, reasons })),
    },
    null,
    2,
  )}\n`,
);

if (accept) {
  if (!allOk) {
    console.log("有不通过的项目，没有更新基线。");
  } else {
    writeFileSync(
      BASELINE,
      `${JSON.stringify({ passedTests, commit: /^[0-9a-f]+$/.test(commit) ? commit : null, task }, null, 2)}\n`,
    );
    console.log(`已更新基线：${passedTests} 条通过的测试。`);
  }
}

process.exit(allOk ? 0 : 1);
