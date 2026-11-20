// 世界（docs/10 第二到五节）：镜头和光、四个季节的布置、跟着发货方式和库存变的东西、东西不放进房子里。
// 测试里没有 WebGL：给 World 一个什么都不画的渲染器，只检查世界里摆了什么。
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { World, type WorldView } from "../src/scene/world/World";
import { world as W } from "../src/ui/theme/tokens";

const stubRenderer = (): THREE.WebGLRenderer =>
  ({
    setSize: () => undefined,
    setPixelRatio: () => undefined,
    render: () => undefined,
    dispose: () => undefined,
    shadowMap: {},
  }) as unknown as THREE.WebGLRenderer;

function make(): World {
  return new World({} as HTMLCanvasElement, { mobile: false, reduceMotion: true }, stubRenderer);
}

const view = (v: Partial<WorldView> = {}): WorldView => ({
  season: 0,
  year: 0,
  fulfillment: "local",
  crates: 3,
  shipContainers: 3,
  coins: 3,
  frozen: false,
  gray: "none",
  ...v,
});

/** 只给测试用：读 World 里的私有字段 */
function inside(w: World): Record<string, unknown> {
  return w as unknown as Record<string, unknown>;
}
function sceneOf(w: World): THREE.Scene {
  return inside(w).scene as THREE.Scene;
}
function named(w: World, name: string): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  sceneOf(w).traverse((o) => {
    if (o.name === name) out.push(o);
  });
  return out;
}
/** 一个东西在地面上占的范围（x、z） */
function footprint(o: THREE.Object3D): { x0: number; x1: number; z0: number; z1: number } {
  const b = new THREE.Box3().setFromObject(o);
  return { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z };
}
function overlaps(a: ReturnType<typeof footprint>, b: ReturnType<typeof footprint>): boolean {
  return a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.z0 < b.z1 - 0.01 && b.z0 < a.z1 - 0.01;
}

describe("镜头和光（docs/10 第二节）", () => {
  it("正交镜头在世界中心加 (30, 24.5, 30)，太阳在中心加 (-7, 21, 15)", () => {
    const w = make();
    const cam = inside(w).camera as THREE.OrthographicCamera;
    expect(cam).toBeInstanceOf(THREE.OrthographicCamera);
    expect(cam.position.toArray()).toEqual([12.5 + 30, 24.5, 5 + 30]);
    const sun = inside(w).sun as THREE.DirectionalLight;
    expect(sun.position.toArray()).toEqual([12.5 - 7, 21, 5 + 15]);
    expect(sun.castShadow).toBe(true);
  });
});

describe("清单里的每一样都在世界里（docs/10 第三节）", () => {
  it("地、工厂、堆场、办公室、吊机、海、货船、仓库、5 栋房子、货车、7 棵树、7 棵棕榈、买家、货的去路和钱的回路", () => {
    const w = make();
    w.setView(view());
    for (const n of ["land-cn", "factory", "yard", "office", "crane", "sea", "ship", "land-my", "warehouse", "money-path"]) expect(named(w, n).length, n).toBeGreaterThanOrEqual(1);
    expect(named(w, "house").length).toBe(6); // 5 栋，加第二年的 1 栋
    expect(named(w, "truck").length).toBe(2);
    expect(named(w, "palm").length).toBe(7);
    expect(named(w, "goods-path").length).toBe(2); // 码头到码头、仓库到房子
  });
});

describe("四个季节（docs/10 第四节）", () => {
  const buyersShown = (w: World): number => (inside(w).buyers as { group: THREE.Group }[]).filter((b) => b.group.visible).length;
  it("天空、太阳光、中国的草地跟季节变", () => {
    const w = make();
    for (const season of [0, 1, 2, 3] as const) {
      w.setView(view({ season }));
      const s = W.season[season];
      expect(((sceneOf(w).background as THREE.Color).getHexString())).toBe(s.sky.slice(1).toLowerCase());
      const sun = inside(w).sun as THREE.DirectionalLight;
      expect(sun.color.getHexString()).toBe(s.sun.slice(1).toLowerCase());
      expect(sun.intensity).toBe(s.sunIntensity);
      expect((inside(w).cnGrass as THREE.MeshStandardMaterial).color.getHexString()).toBe(s.grass.slice(1).toLowerCase());
    }
  });
  it("街上的买家：6、3、4、6 个；第二年多 2 个，多一栋房子", () => {
    const w = make();
    [6, 3, 4, 6].forEach((n, season) => {
      w.setView(view({ season: season as 0 | 1 | 2 | 3 }));
      expect(buyersShown(w)).toBe(n);
      expect((inside(w).extraHouse as THREE.Group).visible).toBe(false);
      w.setView(view({ season: season as 0 | 1 | 2 | 3, year: 1 }));
      expect(buyersShown(w)).toBe(n + 2);
      expect((inside(w).extraHouse as THREE.Group).visible).toBe(true);
    });
  });
  it("春天彩灯、夏天两把遮阳伞、冬天彩旗；冬天树没有叶子、屋顶有雪、飘雪花", () => {
    const w = make();
    const festive = inside(w).festive as Record<"lights" | "umbrellas" | "bunting", THREE.Group>;
    const expectShown = (season: 0 | 1 | 2 | 3, shown: ("lights" | "umbrellas" | "bunting")[]): void => {
      w.setView(view({ season }));
      for (const k of ["lights", "umbrellas", "bunting"] as const) expect(festive[k].visible, `${season} ${k}`).toBe(shown.includes(k));
    };
    expectShown(0, ["lights"]);
    expectShown(1, ["umbrellas"]);
    expectShown(2, []);
    expectShown(3, ["bunting"]);
    const poles = festive.umbrellas.children.filter((c) => c instanceof THREE.Mesh && (c.geometry as THREE.BufferGeometry).type === "CylinderGeometry");
    expect(poles.length).toBe(2);
    const trees = inside(w).trees as { leaves: THREE.Mesh[]; bare: THREE.Group }[];
    expect(trees.length).toBe(7);
    w.setView(view({ season: 3 }));
    expect(trees.every((t) => t.bare.visible && t.leaves.every((l) => !l.visible))).toBe(true);
    expect((inside(w).snowRoofs as THREE.Group).visible).toBe(true);
    expect((inside(w).snowflakes as THREE.Points).visible).toBe(true);
    w.setView(view({ season: 1 }));
    expect(trees.every((t) => !t.bare.visible && t.leaves.every((l) => l.visible))).toBe(true);
    expect((inside(w).snowRoofs as THREE.Group).visible).toBe(false);
  });
});

describe("世界跟着数据变（docs/10 第五节，展示页能切换的几项）", () => {
  const doorColor = (w: World): string => ((inside(w).doors as THREE.Mesh[])[0].material as THREE.MeshStandardMaterial).color.getHexString();
  const shown = (list: unknown): number => (list as THREE.Mesh[]).filter((m) => m.visible).length;
  it("本土店：门开着、货箱在仓库门口；跨境直发：门关着、仓库变暗、货箱在工厂门口", () => {
    const w = make();
    w.setView(view({ fulfillment: "local", crates: 6 }));
    expect(doorColor(w)).toBe(W.window.slice(1).toLowerCase());
    expect(shown(inside(w).warehouseCrates)).toBe(6);
    expect(shown(inside(w).factoryCrates)).toBe(0);
    const bright = (inside(w).warehouseWall as THREE.MeshStandardMaterial).color.getHex();
    w.setView(view({ fulfillment: "cross", crates: 3 }));
    expect(doorColor(w)).toBe(W.wallShade.slice(1).toLowerCase());
    expect(shown(inside(w).warehouseCrates)).toBe(0);
    expect(shown(inside(w).factoryCrates)).toBe(3);
    expect((inside(w).warehouseWall as THREE.MeshStandardMaterial).color.getHex()).not.toBe(bright);
  });
  it("库存的四档货箱、船上的集装箱、金币的个数；审核时金币变灰", () => {
    const w = make();
    for (const crates of [0, 1, 3, 6] as const) {
      w.setView(view({ crates }));
      expect(shown(inside(w).warehouseCrates)).toBe(crates);
    }
    for (const shipContainers of [0, 3, 7] as const) {
      w.setView(view({ shipContainers }));
      expect(shown(inside(w).shipSlots)).toBe(shipContainers);
    }
    w.setView(view({ coins: 4 }));
    expect(shown(inside(w).coins)).toBe(4);
    const coinMat = inside(w).coinMat as THREE.MeshStandardMaterial;
    expect(coinMat.color.getHexString()).toBe(W.coin.slice(1).toLowerCase());
    w.setView(view({ frozen: true }));
    expect(coinMat.color.getHexString()).toBe(W.gray.slice(1).toLowerCase());
  });
});

describe("东西不放进房子里，树不种在路上", () => {
  it("遮阳伞、礼盒、买家、棕榈树都不在房子和仓库里；棕榈树、遮阳伞不在路上", () => {
    const w = make();
    w.setView(view({ year: 1 }));
    const blocks = [...named(w, "house"), ...named(w, "warehouse")].map(footprint);
    // 马来西亚的两条路（models.ts landMy）
    const roads = [
      { x0: 15.25, x1: 24.75, z0: 4.2, z1: 5.2 },
      { x0: 21.1, x1: 22.1, z0: 0.25, z1: 9.75 },
    ];
    const festive = inside(w).festive as Record<"lights" | "umbrellas" | "bunting", THREE.Group>;
    const poles = festive.umbrellas.children.filter((c) => c instanceof THREE.Mesh && (c.geometry as THREE.BufferGeometry).type === "CylinderGeometry");
    const gifts = festive.bunting.children.filter((c) => c instanceof THREE.Mesh && (c.geometry as THREE.BufferGeometry).type === "BoxGeometry");
    const trunks = named(w, "palm").map((p) => p.children[0]);
    const buyers = (inside(w).buyers as { group: THREE.Group }[]).map((b) => b.group);
    const things: [string, THREE.Object3D][] = [
      ...poles.map((o, i): [string, THREE.Object3D] => [`遮阳伞 ${i}`, o]),
      ...gifts.map((o, i): [string, THREE.Object3D] => [`礼盒 ${i}`, o]),
      ...trunks.map((o, i): [string, THREE.Object3D] => [`棕榈树 ${i}`, o]),
      ...buyers.map((o, i): [string, THREE.Object3D] => [`买家 ${i}`, o]),
    ];
    expect(things.length).toBeGreaterThan(20);
    const bad: string[] = [];
    for (const [name, o] of things) {
      const f = footprint(o);
      if (blocks.some((b) => overlaps(f, b))) bad.push(`${name} 在房子或仓库里`);
    }
    for (const [name, o] of [...poles.map((o, i): [string, THREE.Object3D] => [`遮阳伞 ${i}`, o]), ...trunks.map((o, i): [string, THREE.Object3D] => [`棕榈树 ${i}`, o])]) {
      if (roads.some((r) => overlaps(footprint(o), r))) bad.push(`${name} 在路上`);
    }
    expect(bad).toEqual([]);
  });
});

// ---------- 和文档直接比（第 2 次检查之后加的） ----------

const docsDir = join(__dirname, "..", "docs");
const doc10 = readFileSync(join(docsDir, readdirSync(docsDir).find((f) => f.startsWith("10-")) ?? ""), "utf8");
/** docs/10 第四节表格里某一行的四个格子，每格里的颜色 */
function seasonRow(label: string): string[][] {
  const section4 = doc10.split("## 四、四个季节")[1].split("## 五")[0];
  const line = section4.split("\n").find((l) => l.startsWith(`| ${label} |`));
  if (!line) throw new Error(label);
  return line
    .split("|")
    .slice(2, 6)
    .map((cell) => (cell.match(/#[0-9A-Fa-f]{6}/g) ?? []).map((h) => h.toLowerCase()));
}

describe("四个季节的颜色和 docs/10 第四节一样", () => {
  it("中国的草地、树、天空、太阳光（颜色和强度）", () => {
    const grass = seasonRow("中国的草地");
    const tree = seasonRow("中国的树");
    const sky = seasonRow("天空");
    const sun = seasonRow("太阳光");
    const sunLine = doc10.split("## 四、四个季节")[1].split("\n").find((l) => l.startsWith("| 太阳光 |")) ?? "";
    const strength = [...sunLine.matchAll(/强度 ([\d.]+)/g)].map((m) => Number(m[1]));
    for (const q of [0, 1, 2, 3] as const) {
      const s = W.season[q];
      expect(s.grass.toLowerCase(), `草地 ${q}`).toBe(grass[q][0]);
      expect(s.sky.toLowerCase(), `天空 ${q}`).toBe(sky[q][0]);
      expect(s.sun.toLowerCase(), `太阳 ${q}`).toBe(sun[q][0]);
      expect(s.sunIntensity, `强度 ${q}`).toBe(strength[q]);
      expect([s.tree[0].toLowerCase(), s.tree[1].toLowerCase()], `树 ${q}`).toEqual(tree[q]);
    }
  });
});

describe("模型的细节和位置", () => {
  it("货船：橙色的烟囱（docs/10 第三节）", () => {
    const w = make();
    const colors = new Set<string>();
    named(w, "ship")[0].traverse((o) => {
      if (o instanceof THREE.Mesh) colors.add((o.material as THREE.MeshStandardMaterial).color.getHexString());
    });
    expect(colors.has(W.chimney.slice(1).toLowerCase())).toBe(true);
  });
  it("货的去路：码头那段不被船压住；仓库那段从仓库门口出发、不被货箱挡住、通到房子", () => {
    const w = make();
    w.setView(view({ fulfillment: "local", crates: 6 }));
    const [sea, land] = named(w, "goods-path");
    const ship = footprint(named(w, "ship")[0]);
    for (const dash of sea.children) expect(overlaps(footprint(dash), ship)).toBe(false);
    const wh = footprint(named(w, "warehouse")[0]);
    const first = footprint(land.children[0]);
    expect(first.z0).toBeGreaterThanOrEqual(wh.z1 - 0.01);
    expect(first.z0 - wh.z1).toBeLessThan(0.5);
    const crates = (inside(w).warehouseCrates as THREE.Mesh[]).filter((c) => c.visible).map(footprint);
    for (const dash of land.children) expect(crates.some((c) => overlaps(footprint(dash), c))).toBe(false);
    const houses = named(w, "house").map(footprint);
    const last = footprint(land.children[land.children.length - 1]);
    expect(houses.some((h) => Math.abs(last.x1 - h.x0) < 1.2 || (last.x1 > h.x0 && last.x0 < h.x1))).toBe(true);
  });
  it("中国的树不种在工厂、办公室、堆场里", () => {
    const w = make();
    const blocks = ["factory", "office", "yard"].flatMap((n) => named(w, n)).map(footprint);
    // 按树冠算（比树枝大）
    const trees = (inside(w).trees as { leaves: THREE.Mesh[]; bare: THREE.Group }[]).map((t) => {
      const g = new THREE.Group();
      for (const l of t.leaves) g.add(l.clone());
      return footprint(g);
    });
    expect(trees.filter((t) => blocks.some((b) => overlaps(t, b))).length).toBe(0);
  });
  it("倒闭、封店时门、金币、仓库也变灰", () => {
    const w = make();
    w.setView(view({ gray: "none" }));
    const wall = (inside(w).warehouseWall as THREE.MeshStandardMaterial).color.getHex();
    const coin = (inside(w).coinMat as THREE.MeshStandardMaterial).color.getHex();
    for (const g of ["my", "all"] as const) {
      w.setView(view({ gray: g }));
      expect((inside(w).warehouseWall as THREE.MeshStandardMaterial).color.getHex()).not.toBe(wall);
      expect((inside(w).coinMat as THREE.MeshStandardMaterial).color.getHex()).not.toBe(coin);
    }
  });
});
