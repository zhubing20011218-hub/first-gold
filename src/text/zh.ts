// 界面上所有的中文都放在这里（docs/02 第六节）

export const zh = {
  title: "第一桶金",
  subtitle: "三个 AI 员工都说这单能赚，你听谁的？",
  staff: {
    buyer: "采购",
    operator: "运营",
    finance: "财务",
  },
  startButton: "开始经营",
  startCashLabel: "启动资金",
  /** 启动资金那一行：¥5,000.00（约 RM 3,030.30） */
  startCashLine: (label: string, yuan: string, rm: string): string => `${label} ${yuan}（约 ${rm}）`,
  footer: "本游戏的规则是简化过的，不等于真实平台。",
} as const;
