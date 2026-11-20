// 商品的字段（docs/05 第一节）。类型定义在 src/engine/product.ts：
// engine 只能引用 params 的类型，products 可以引用 engine 的类型（docs/01 第四节）。
export type { Product, ProductKind } from "../engine/product";
