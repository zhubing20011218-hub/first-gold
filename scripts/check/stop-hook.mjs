// 助手停下来之前的钩子（docs/13 第 3.2 节）。
// 退出码 0：放行；退出码 2：拦住，标准错误里的文字会交给助手。
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MESSAGE =
  "自动检查没有通过，请修好再停。如果你停下来是因为要问项目负责人问题，把问题和现在没通过的项目写清楚，然后可以停。";

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

const raw = await readStdin();
let input = {};
if (raw.trim() !== "") {
  try {
    input = JSON.parse(raw);
  } catch {
    // 读不懂输入时照常检查，不放过
    input = {};
  }
}

// 1. 已经因为这个钩子接着干过一次了：放行，避免没完没了
if (input.stop_hook_active === true) process.exit(0);

// 2. src、tests、scripts 里没有未提交的改动：放行
const status = spawnSync("git", ["status", "--porcelain", "--", "src", "tests", "scripts"], {
  cwd: ROOT,
  encoding: "utf8",
});
if (status.status === 0 && status.stdout.trim() === "") process.exit(0);

// 3. 运行自动检查
const check = spawnSync(process.execPath, [join(ROOT, "scripts", "check", "run.mjs")], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (check.status === 0) process.exit(0);

// 4. 不通过：把没通过的项目和原因写到标准错误，用退出码 2 结束
const lines = `${check.stdout ?? ""}`.split("\n");
const failed = [];
let inFail = false;
for (const line of lines) {
  if (/^K\d/.test(line)) {
    inFail = /不通过\s*$/.test(line);
    if (inFail) failed.push(line.trim());
  } else if (inFail && line.startsWith("    ")) {
    failed.push(line);
  }
}
process.stderr.write(`${failed.slice(0, 40).join("\n")}\n\n${MESSAGE}\n`);
process.exit(2);
