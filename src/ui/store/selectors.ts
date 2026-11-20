// 界面从 store 里取要显示的东西（docs/12 第四节）。组件不直接读 engine 和 plan，只通过这里（docs/11 R10）。
// 任务 06 第一步只有基础组件要用的格式化；store 和其他取数在第三步加上。
export { formatRM, formatYuan } from "../../engine/money";
