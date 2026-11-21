// 新版（改版方案第 5 稿）的参数表：两年八季、多种商品、路线树、抢单排名、对手、事件、双 11。
// 每单结算、推流分、广告竞价、仓储费这些已经核对过的参数沿用 malaysia.ts；这里只放新的和改了值的。
// 新的参数都是设计值（等级 C），跑模拟以后再调。
import { malaysia } from "./malaysia";

interface CParam {
  value: number;
  unit: string;
  source: "C";
  note: string;
  public: true;
}
interface CArrayParam extends Omit<CParam, "value"> {
  value: readonly number[];
}
const c = (value: number, unit: string, note: string): CParam => ({ value, unit, source: "C", note, public: true });
const ca = (value: readonly number[], unit: string, note: string): CArrayParam => ({ value, unit, source: "C", note, public: true });

export const nextOnly = {
  // ---- 改了值的 ----
  startCashFen: c(5000000, "fen", "启动资金 ¥50,000"),
  goalNetWorthFen: c(100000000, "fen", "目标净资产 ¥1,000,000"),
  localSetupFeeFen: c(1500000, "fen", "海外仓的开通费"),
  monthlyFixedCostFen: c(200000, "fen", "每月固定开支（店铺工具、打包材料、杂费），小摊的时候"),
  levelFixedCostFen: ca([200000, 500000, 1200000, 2500000], "fen", "小摊、小店、旺铺、品牌每月的固定开支（人手、房租、工具）"),
  buyTier1Multiple: c(20, "倍", "一次进货达到起订量的 20 倍，每件便宜 5%"),
  buyTier2Multiple: c(50, "倍", "一次进货达到起订量的 50 倍，每件便宜 10%"),

  overdraftBpPerDay: c(20, "bp", "现金是负数的每一天，按欠的钱付这么多利息（周转的成本）"),

  // ---- 市场规模 ----
  marketScaleBp: c(48000, "bp", "自然订单的规模，相对商品库里的基础单量"),
  adPoolScaleBp: c(48000, "bp", "广告点击量的规模，相对商品库里的基础点击量"),
  supplierCapScaleBp: c(80000, "bp", "供应商每季度最多供多少，相对商品库里每月上限的倍数（已经乘了 3 个月以外再乘这个）"),
  trendHotBp: c(16000, "bp", "每季度有一种货特别火，热度乘这个"),
  rivalPriceMinBp: c(9500, "bp", "对手零售价最低是参考价的几成"),
  rivalPriceMaxBp: c(10800, "bp", "对手零售价最高是参考价的几成"),
  surpriseMinBp: c(6000, "bp", "每季每种货还有一个事先看不到的波动，最低"),
  surpriseMaxBp: c(13000, "bp", "每季每种货事先看不到的波动，最高"),
  trendColdBp: c(7000, "bp", "每季度有一种货变冷，热度乘这个"),
  storeSalesBenchmark: c(3000, "单", "推流分的出单能力：一个月发出这么多单拿满 20 分"),

  // ---- 路线树 ----
  crossOrganicBp: c(14000, "bp", "跨境直发：上架的商品多，自然流量乘这个"),
  bulkRouteOrganicBp: c(8000, "bp", "主攻企业大单：零售自然流量只有这么多"),
  bulkRouteCompositeBonus: c(10, "分", "主攻企业大单：店铺综合分加这么多"),
  bulkRouteQtyBp: c(35000, "bp", "主攻企业大单：询单的件数乘这个"),
  adRouteRatioBp: c(12500, "bp", "引流选广告：广告竞价的比例乘这个（平台扶持）"),
  adRoutePoolBp: c(15000, "bp", "引流选广告：能抢的广告点击量乘这个"),
  organicRoutePushPts: c(5, "分", "引流选自然流量：推流分加这么多"),
  organicRouteRatingE1: c(1, "0.1 分", "引流选自然流量：每月评分多恢复这么多"),
  creatorPerQuarter: c(2, "场", "引流选达人直播：每季度几场直播"),
  creatorBurstBp: c(200000, "bp", "一场直播的订单，相对这种货一天的自然订单"),
  creatorFeeBp: c(1500, "bp", "达人佣金，按售价算"),
  l3GoodNetWorthFen: c(20000000, "fen", "第一年结束时净资产达到这个，第 3 层亮绿色（机会卡）"),
  promoFeeFen: c(500000, "fen", "最后半年选全力冲大促：报名费"),
  promoDouble11Bp: c(200000, "bp", "全力冲大促：第二年双 11 当天订单的倍数"),
  bulkPushExtraInquiries: c(1, "张", "最后半年选抢大单：每季度多出几张询单"),
  safeStorageBp: c(7000, "bp", "最后半年选稳住现金：仓储费只付这么多"),
  safeFixedBp: c(5000, "bp", "最后半年选稳住现金：固定开支只付这么多"),
  safeLoanMaxFen: c(5000000, "fen", "稳住现金：季末现金不够时，平台最多借这么多"),
  safeLoanInterestBp: c(800, "bp", "稳住现金：借款的利息"),

  // ---- 店铺综合分和抢单 ----
  compPushPct: c(50, "%", "店铺综合分里推流分占多少"),
  compRatingPct: c(30, "%", "店铺综合分里店铺评分占多少"),
  compRecordPct: c(20, "%", "店铺综合分里交大单记录占多少"),
  recordBasePts: c(50, "分", "交大单记录的起点"),
  recordOnTimePts: c(15, "分", "按时交完一次大单，交大单记录加多少"),
  recordDefaultPts: c(40, "分", "违约一次，交大单记录减多少"),
  breachPenaltyPts: c(20, "分", "违约一次，店铺综合分直接扣多少"),
  breachDecayPts: c(10, "分", "违约扣的分每季度恢复多少"),
  breachDemandBpPerPt: c(100, "bp", "违约扣的分每 1 分，零售订单少 1%"),
  bidPricePct: c(40, "%", "抢单的总分里报价分占多少"),
  bidCompPct: c(60, "%", "抢单的总分里店铺综合分占多少"),
  bidFloorBp: c(7800, "bp", "报价分 100 分的价格，相对参考价"),
  bidShareBp: ca([5000, 3000, 2000, 0], "bp", "第 1 到第 4 名分到询单件数的几成"),
  bulkInquiryMax: c(3, "张", "每季度最多准备几张询单（显示几张看路线）"),
  bulkQtyScaleBp: c(100000, "bp", "询单件数的规模，相对商品库里的批发基础件数"),
  bulkRefPriceBp: c(13000, "bp", "询单的参考价，相对商品库里的批发参考价"),
  rivalCompBase: ca([84, 62, 71], "分", "三家对手开局的店铺综合分"),
  rivalCompDrift: c(4, "分", "对手的店铺综合分每季度上下变多少"),
  rivalBidMinBp: c(8600, "bp", "对手报价最低是参考价的几成"),
  rivalBidMaxBp: c(10000, "bp", "对手报价最高是参考价的几成"),
  rivalEstimateNoiseBp: c(300, "bp", "打听来的对手报价和真实报价最多差多少"),
  rivalProfitBaseFen: ca([2500000, 1200000, 1800000], "fen", "三家对手第一个季度大约赚多少（只用来排名）"),
  rivalProfitGrowthBp: c(1600, "bp", "对手每季度多赚多少"),

  // ---- 合规（只对海外仓）----
  complianceTierCostFen: ca([0, 300000, 800000], "fen", "合规三档：不做、补齐资料、全套认证的费用"),
  complianceTierPts: ca([0, 27, 52], "点", "合规三档各降低多少风险"),

  // ---- 事件 ----
  eventMinOffset: c(15, "天", "事件最早在季度的第几天"),
  eventMaxOffset: c(75, "天", "事件最晚在季度的第几天"),
  viralBp: c(30000, "bp", "视频火了：那种货的订单乘这个"),
  viralDays: c(7, "天", "视频火了持续几天"),
  streamerBurstBp: c(150000, "bp", "大主播上门：一天的订单相对那种货一天的自然订单"),
  homepageBp: c(13000, "bp", "首页推荐：所有货的自然订单乘这个"),
  homepageDays: c(15, "天", "首页推荐持续几天"),
  bigClientBp: c(2000, "bp", "大客户包货：买走那种货库存的几成"),
  typhoonDays: c(7, "天", "台风封港：不改空运的话，路上的货晚几天"),
  typhoonAirFen: c(300000, "fen", "台风封港：改空运的费用"),
  priceWarCutBp: c(8500, "bp", "价格战：跟着降价，售价变成几成"),
  priceWarIgnoreBp: c(6000, "bp", "价格战：不跟，那种货的订单只剩几成"),
  priceWarDays: c(30, "天", "价格战持续几天"),
  auditFastFen: c(300000, "fen", "风控审核：交加急费"),
  auditFastDays: c(5, "天", "风控审核：交加急费，货款冻结几天"),
  auditSlowDays: c(20, "天", "风控审核：等审核，货款冻结几天"),
  appealFen: c(150000, "fen", "恶意差评：花钱申诉的费用"),
  maliciousDropE1: c(4, "0.1 分", "恶意差评：不管的话评分降多少"),
  goodCardViralDays: c(14, "天", "第一年做得好（绿色）：视频火了持续几天"),

  // ---- 双 11 ----
  double11Offset: c(40, "天", "双 11 在第 4 季度的第几天（10 月 1 日是第 0 天）"),
  double11Bp: c(80000, "bp", "双 11 当天订单的倍数"),
  packMinBp: c(4000, "bp", "双 11 打包：一个都没点到也能发出几成"),

  // ---- 店铺等级（只看净资产）----
  levelNetWorthFen: ca([0, 10000000, 25000000, 60000000], "fen", "小摊、小店、旺铺、品牌的净资产门槛"),

  // ---- 结局 ----
  kingNetWorthFen: c(200000000, "fen", "隐藏结局东南亚之王的净资产"),
  nearGoalNetWorthFen: c(80000000, "fen", "差一点百万的下限"),
  overstockBp: c(3000, "bp", "库存的进价达到净资产的这么多算压货"),
  priceWarPoorFen: c(50000000, "fen", "价格战两败俱伤：净资产低于这个"),
  promoShareBp: c(2500, "bp", "大促一夜暴富：选了全力冲大促，两次双 11 的利润占总利润的这么多以上"),
  defaultEndingCount: c(2, "次", "大单违约这么多次就是大单违约结局"),
};

export const nextParams = { ...malaysia, ...nextOnly };
export type NextParams = typeof nextParams;
