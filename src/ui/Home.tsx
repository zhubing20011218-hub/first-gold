// 首页（任务 01）：标题、副标题、三张员工卡片、开始经营按钮、启动资金、页脚
import { zh } from "../text/zh";
import { malaysia } from "../params/malaysia";
import { fenToSen, formatRM, formatYuan } from "../engine/money";

const staffCards = [
  { key: "buyer", name: zh.staff.buyer, swatch: "bg-buyer" },
  { key: "operator", name: zh.staff.operator, swatch: "bg-operator" },
  { key: "finance", name: zh.staff.finance, swatch: "bg-finance" },
] as const;

export function Home() {
  const startCashFen = malaysia.startCashFen.value;
  const startCashSen = fenToSen(startCashFen, malaysia.cnyPerRmE4.value);
  const startCashLine = zh.startCashLine(zh.startCashLabel, formatYuan(startCashFen), formatRM(startCashSen));

  return (
    <div className="flex min-h-full flex-col items-center justify-between px-4 py-8">
      <main className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 text-center">
        <header className="flex flex-col gap-3">
          <h1 className="text-5xl font-bold tracking-wide md:text-6xl">{zh.title}</h1>
          <p className="text-lg text-muted md:text-xl">{zh.subtitle}</p>
        </header>

        <ul className="grid w-full grid-cols-3 gap-3 md:gap-5">
          {staffCards.map((s) => (
            <li key={s.key} className="card-flat flex flex-col items-center gap-3 bg-paper p-4 md:p-6">
              <div className={`h-14 w-14 rounded-full md:h-20 md:w-20 ${s.swatch}`} aria-hidden="true" />
              <span className="text-lg font-bold">{s.name}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-center gap-3">
          <button type="button" className="btn-solid min-h-12 bg-gold px-10 py-3 text-xl font-bold" data-primary>
            {zh.startButton}
          </button>
          <p className="text-sm text-muted tabular-nums">{startCashLine}</p>
        </div>
      </main>

      <footer className="pt-6 text-xs text-muted">{zh.footer}</footer>
    </div>
  );
}
