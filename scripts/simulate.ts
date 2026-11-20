// 模拟报告（任务 04）：npm run sim。只引用 engine、params、products；结果写进 模拟报告.md。
// 每种商品一个工作线程并行跑，结果按固定顺序合并，所以每次生成的内容完全一样。
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { malaysia } from "../src/params/malaysia";
import { getProduct, products } from "../src/products/catalog";
import { PRODUCT_NAMES } from "./sim/names";
import { makeStrategies, STRATEGY_NAMES } from "./sim/strategies";
import { playWithStrategy, type Route } from "./sim/play";
import { buildReport, summarize, type Row, type SandboxCheck } from "./sim/report";

const SEEDS = 300;
const ROUTES: Route[] = ["cross", "local", "upgrade"];
const STRATEGIES = ["conservative", "balanced", "aggressive", "bulkOnly", "random", "reference"] as const;

interface WorkerOut {
  rows: Row[];
  sandbox: SandboxCheck;
}

function runProduct(productId: string): WorkerOut {
  const product = getProduct(productId);
  const strategies = makeStrategies(product, malaysia);
  const rows: Row[] = [];
  for (const route of ROUTES) {
    STRATEGIES.forEach((sid, si) => {
      const results = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        results.push(playWithStrategy(product, malaysia, strategies[sid], route, seed, si));
      }
      rows.push(summarize(productId, route, sid, results));
    });
  }
  // 沙盘检查：种子 1 到 20，一直跨境，同一个种子下各种打法的净资产是否互不相同
  let seedsWithTies = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const nws = STRATEGIES.map((sid, si) => playWithStrategy(product, malaysia, strategies[sid], "cross", seed, si).netWorthFen);
    if (new Set(nws).size !== nws.length) seedsWithTies++;
  }
  return { rows, sandbox: { productId, seedsWithTies, seeds: 20 } };
}

async function main(): Promise<void> {
  const self = fileURLToPath(import.meta.url);
  const outs = await Promise.all(
    products.map(
      (p) =>
        new Promise<WorkerOut>((resolve, reject) => {
          const w = new Worker(self, { workerData: p.id });
          w.once("message", (m: WorkerOut) => resolve(m));
          w.once("error", reject);
        }),
    ),
  );
  const productNames = PRODUCT_NAMES;
  const report = buildReport({
    rows: outs.flatMap((o) => o.rows),
    sandbox: outs.map((o) => o.sandbox),
    productNames,
    strategyNames: STRATEGY_NAMES,
    strategyOrder: [...STRATEGIES],
    goalFen: malaysia.goalNetWorthFen.value,
    startCashFen: malaysia.startCashFen.value,
    fixedCostFen: malaysia.monthlyFixedCostFen.value,
    seeds: SEEDS,
  });
  writeFileSync(process.env.SIM_OUT ?? "模拟报告.md", report);
  console.log(`模拟报告.md 已生成：${outs.reduce((s, o) => s + o.rows.length, 0)} 个组合。`);
}

if (isMainThread) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
} else {
  parentPort?.postMessage(runProduct(workerData as string));
}
