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
  /** 商品的名字、一句话介绍、玩家要小心的地方（docs/05 第二、三节），用商品的 id 对应 */
  products: {
    phone_case: { name: "手机壳", intro: "便宜、好卖、谁都用得上", caution: "每单赚得少，广告费稍高就亏" },
    arm_sleeve: { name: "防晒冰袖", intro: "天气热，全年都有人买", caution: "每单赚得少，竞争多" },
    hijab: { name: "头巾", intro: "当地特色，开斋节前卖得最好", caution: "旺季前要提前备货，备多了节后卖不动" },
    mini_fan: { name: "充电小风扇", intro: "每单赚得不少，全年有需求", caution: "进货贵，一断货就没得卖" },
    blouse: { name: "女装长袖上衣", intro: "每单赚得多", caution: "尺码不合适，退货多" },
    earbuds: { name: "蓝牙耳机", intro: "每单赚得最多", caution: "退货多，差评多，进货最贵" },
  } as Record<string, { name: string; intro: string; caution: string }>,
} as const;
