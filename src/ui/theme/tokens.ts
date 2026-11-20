// 设计变量（docs/07 第二节、docs/08、docs/10 第四节）。整个项目唯一可以写颜色值的地方，世界的颜色也在这里。
// Tailwind 的主题（src/ui/theme/theme.css）用的是同一组值；改颜色要两处一起改，测试会核对它们一致。

export const color = {
  ink: "#10212B",
  sea: "#0F8F8C",
  gold: "#E0A21B",
  goldText: "#8F6400",
  goldSoft: "#FBF1D6",
  hibiscus: "#D8434A",
  paper: "#FFFFFF",
  seaSoft: "#E3F4F3",
  line: "#C9D8D6",
  muted: "#5C7078",
  /** sea、hibiscus 的"字用"颜色：小于 28 的字和上面放小字的底色（docs/08 第五节第 2 条，规则包第 12 版） */
  seaText: "#0C7A77",
  hibiscusText: "#C53A41",
  /** 禁用按钮的底色和字色 */
  disabledBg: "#E4EAEB",
  disabledText: "#8A9A9F",
  /** 弹窗后面变暗用 ink，不透明度 40%（docs/07 第二节；docs/08 第五节第 5 条：遮罩不算背景） */
  scrim: "#10212B",
} as const;

/** 三个功能区的代表色 */
export const areaColor = {
  purchase: "#0F8F8C",
  ops: "#E0672B",
  finance: "#3E5C9A",
} as const;

/** 间距只用这几个值（docs/08 第三节） */
export const space = [4, 8, 12, 16, 24, 32, 48] as const;

/** 字号只用这几个（docs/08 第四节） */
export const fontSize = [12, 14, 16, 20, 28, 40, 56] as const;

/** 固定的尺寸（docs/08 第二节、docs/09 第四节） */
export const size = {
  gutter: 24,
  topBarTop: 16,
  topBarHeight: 44,
  inquiryTop: 76,
  inquiryWidth: 236,
  worldTop: 492,
  areaHeight: 204,
  barTop: 714,
  barHeight: 70,
  contentMax: 1440,
  popupMid: 560,
  popupPush: 360,
  popupBill: 880,
  popupSource: 480,
  popupDesk: 560,
  popupShort: 520,
} as const;

/** 层级（docs/08 第八节） */
export const z = {
  world: 0,
  worldLabel: 5,
  ui: 10,
  reminder: 15,
  scrim: 20,
  popup: 30,
  coach: 40,
  stamp: 50,
} as const;

/** 世界的颜色（docs/10 第二、四节） */
export const world = {
  seaWater: "#7FD6E3",
  seaDeep: "#5FB9C9",
  waveLine: "#FFFFFF",
  sand: "#EAD9A6",
  sandSide: "#C9B47E",
  road: "#FFF6DD",
  roadLine: "#FFFFFF",
  dock: "#C99A62",
  myGrass: "#A9DDA8",
  myGrassSide: "#7FB98A",
  wall: "#F7F7F2",
  wallShade: "#D7DCDC",
  window: "#BFE3EA",
  roof: "#2BB3A8",
  roofDark: "#14857D",
  chimney: "#D9622B",
  chimneyCap: "#1E2A30",
  trunk: "#8A5A35",
  palmLeaf: "#4CB979",
  crate: "#D9B074",
  coin: "#E0A21B",
  shipHull: "#1E2A30",
  shipDeck: "#D8434A",
  crane: "#E0A21B",
  container: ["#E46A3A", "#3E5C9A", "#0F8F8C", "#D8434A", "#E8C27A", "#E0A21B"],
  houseRoof: ["#F2B632", "#1F9E95", "#E0672B", "#D8434A", "#3E5C9A", "#8E6BB8"],
  truckCab: ["#3E5C9A", "#E0A21B"],
  buyerBody: ["#B7A6E0", "#F2C46B", "#9FD6C2", "#A9C1EA", "#F4A7A0", "#C8D98E", "#E9B8D5", "#9CC9E4"],
  skin: "#F2D3B3",
  hair: "#3A2A22",
  gray: "#B9C2C4",
  smoke: "#FFFFFF",
  lights: ["#F2B632", "#D8434A", "#1F9E95", "#3E5C9A"],
  ketupat: ["#4CB979", "#F2B632"],
  bunting: ["#D8434A", "#F2B632", "#1F9E95"],
  gift: "#D8434A",
  umbrella: ["#F28C28", "#FFFFFF"],
  /** 四个季节：中国的草地、树的两种颜色（冬天是树枝和雪）、天空、太阳光的颜色和强度 */
  season: [
    { grass: "#CFE8AE", tree: ["#F6B7C6", "#F090A8"], sky: "#D5EEF2", sun: "#FFF4E6", sunIntensity: 2.4 },
    { grass: "#A9D98C", tree: ["#3FA36A", "#55B97C"], sky: "#CBEBF5", sun: "#FFE9B8", sunIntensity: 2.8 },
    { grass: "#DCDCA2", tree: ["#E9A23B", "#D9772B"], sky: "#DCEBE6", sun: "#FFD9A8", sunIntensity: 2.2 },
    { grass: "#F2F6F8", tree: ["#8A5A35", "#FFFFFF"], sky: "#D9E6EE", sun: "#EEF4FF", sunIntensity: 1.9 },
  ],
  snow: "#FFFFFF",
} as const;
