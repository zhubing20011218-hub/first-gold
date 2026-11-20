// 首页的简版（任务 06 第一步）：标题、一句话、页脚三句话，用新的设计变量。
// 规则包第 2 版去掉了三个 AI 员工，旧首页的员工卡片已经删掉。"开始经营"和完整的首页在第三步做（docs/07 第三节）。
import { zh } from "../text/zh";

export function Home() {
  return (
    <div className="flex h-full flex-col items-center justify-between bg-sea-soft px-4 py-8">
      <div />
      <main className="flex flex-col items-center gap-6 rounded-dialog border-2 border-ink bg-paper px-12 py-8 text-center shadow-dialog max-md:px-6">
        <h1 className="text-hero font-black">{zh.title}</h1>
        <p className="max-w-popup text-title text-muted">{zh.subtitle}</p>
      </main>
      <ul className="flex flex-col items-center gap-1 rounded-control bg-paper px-4 py-2 text-cap text-muted">
        {zh.honest.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  );
}
