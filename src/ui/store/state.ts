// 界面的状态（docs/09 第二节）。任务 06 第一步只有功能区的名字；整个 store 在第三步加上。
/** 三个功能区：进货、运营、财务（docs/06 第一节） */
export type Area = "purchase" | "ops" | "finance";
export const AREAS: readonly Area[] = ["purchase", "ops", "finance"];
