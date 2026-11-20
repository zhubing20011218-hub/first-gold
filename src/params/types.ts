// 参数表的格式（docs/02 第五节）

/** A：平台公开规则；B：真实经营或项目负责人指定的计算器；C：假设或设计值 */
export type ParamSource = "A" | "B" | "C";

export interface Param {
  value: number;
  unit: string;
  source: ParamSource;
  note: string;
  /** true 时会显示在"这些数字从哪来"的页面上 */
  public: boolean;
}
