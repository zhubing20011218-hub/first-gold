// 整个世界（docs/10）：镜头、光、模型、四个季节、跟着数据变。这里的代码不引用 React。
// 世界不保存任何游戏数据：每次 setView 都从传进来的 WorldView 重新决定画什么。
import * as THREE from "three";
import { color, world as W } from "../../ui/theme/tokens";
import {
  bareBranches,
  box,
  buyer,
  bunting,
  coin,
  crane,
  crate,
  dashedPath,
  dock,
  factory,
  festiveLights,
  house,
  landCn,
  landMy,
  mat,
  office,
  ownMat,
  palm,
  sea,
  ship,
  tree,
  truck,
  umbrellas,
  warehouse,
  yard,
} from "./models";

export type Season = 0 | 1 | 2 | 3;

/** 世界要画的东西，全部从模型的状态算出来（见 src/ui/store/selectors.ts 的 worldViewOf） */
export interface WorldView {
  season: Season;
  /** 第二年马来西亚多一栋房子、多 2 个买家 */
  year: 0 | 1;
  fulfillment: "cross" | "local";
  /** 门口货箱的数量：0、1、3、6 */
  crates: 0 | 1 | 3 | 6;
  /** 船上集装箱的数量：0、3、7 */
  shipContainers: 0 | 3 | 7;
  /** 钱的回路上金币的数量，0 到 6 */
  coins: number;
  /** 金币停住并变灰（审核） */
  frozen: boolean;
  /** 封店：马来西亚变灰；倒闭：整个世界变灰 */
  gray: "none" | "my" | "all";
}

export interface LabelAnchors {
  supplier: { x: number; y: number };
  warehouse: { x: number; y: number };
  buyers: { x: number; y: number };
  ship: { x: number; y: number };
  money: { x: number; y: number };
  stock: { x: number; y: number };
  stockout: { x: number; y: number };
}

export interface FitRect {
  /** 世界要放进的区域，单位是 CSS 像素 */
  left: number;
  top: number;
  width: number;
  height: number;
}

const CENTER = new THREE.Vector3(12.5, 0, 5);
const MONEY_PATH: [number, number, number][] = [
  [20.5, 0.56, 9.6],
  [15.2, 0.05, 10.6],
  [9.5, 0.05, 10.6],
  [6.0, 0.56, 9.6],
];
const GOODS_PATH: [number, number, number][] = [
  [8.6, 0.05, 4.7],
  [13.6, 0.05, 4.7],
];
const STREET_SPOTS: [number, number][] = [
  [22.3, 5.5],
  [24.0, 5.3],
  [20.6, 6.3],
  [18.6, 5.6],
  [23.4, 4.6],
  [16.6, 5.5],
  [19.6, 5.3],
  [24.3, 3.6],
];

export class World {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  private sun: THREE.DirectionalLight;
  private width = 1;
  private height = 1;

  // 跟季节变的
  private cnGrass = ownMat(W.season[0].grass);
  private leafA = ownMat(W.season[0].tree[0]);
  private leafB = ownMat(W.season[0].tree[1]);
  private trees: { leaves: THREE.Mesh[]; bare: THREE.Group }[] = [];
  private snowRoofs = new THREE.Group();
  private snowflakes: THREE.Points;
  private festive!: Record<"lights" | "umbrellas" | "bunting", THREE.Group>;
  private buyers: { group: THREE.Group; parcel: THREE.Mesh }[] = [];
  private extraHouse: THREE.Group;

  // 跟数据变的
  private warehouseWall = ownMat(W.wall);
  private warehouseRoof = ownMat(W.roof);
  private warehouseRoofTop = ownMat(W.roofDark);
  private doors: THREE.Mesh[] = [];
  private factoryCrates: THREE.Mesh[] = [];
  private warehouseCrates: THREE.Mesh[] = [];
  private shipGroup: THREE.Group;
  private shipSlots: THREE.Mesh[] = [];
  private coins: THREE.Mesh[] = [];
  private coinMat = new THREE.MeshStandardMaterial({ color: W.coin, roughness: 0.35, metalness: 0.5 });
  private palms: THREE.Group[] = [];
  private smoke: THREE.Mesh[] = [];
  private myGroup = new THREE.Group();
  /** 两块地连同上面的建筑（取景用，不含四周的海） */
  private cnGroup: THREE.Group | null = null;
  private frameBox: THREE.Box3 | null = null;
  private allMaterials: { m: THREE.MeshStandardMaterial; base: THREE.Color; my: boolean }[] = [];

  private view: WorldView | null = null;
  private raf = 0;
  private lastFrame = 0;
  private reduceMotion = false;
  private disposed = false;
  private firstFrameDone: (() => void) | null = null;
  readonly ready: Promise<void>;

  constructor(canvas: HTMLCanvasElement, opts: { mobile: boolean; reduceMotion: boolean }) {
    this.canvas = canvas;
    this.reduceMotion = opts.reduceMotion;
    this.ready = new Promise((resolve) => {
      this.firstFrameDone = resolve;
    });
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color(W.season[0].sky);
    this.camera.position.copy(CENTER).add(new THREE.Vector3(30, 24.5, 30));
    this.camera.lookAt(CENTER);

    this.scene.add(new THREE.HemisphereLight(color.paper, W.window, 1.7), new THREE.AmbientLight(color.paper, 0.55));
    this.sun = new THREE.DirectionalLight(W.season[0].sun, W.season[0].sunIntensity);
    this.sun.position.copy(CENTER).add(new THREE.Vector3(-7, 21, 15));
    this.sun.target.position.copy(CENTER);
    this.sun.castShadow = true;
    const map = opts.mobile ? 1024 : 2048;
    this.sun.shadow.mapSize.set(map, map);
    this.sun.shadow.radius = 6;
    this.sun.shadow.bias = -0.0005;
    Object.assign(this.sun.shadow.camera, { left: -20, right: 20, top: 16, bottom: -16, near: 1, far: 70 });
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(sea());
    this.buildChina();
    const s = ship();
    this.shipGroup = s.group;
    this.shipSlots = s.slots;
    this.shipGroup.position.set(11.15, 0, 4.7);
    this.scene.add(this.shipGroup);
    this.extraHouse = house(17.3, 8.3, W.houseRoof[5]);
    this.buildMalaysia();
    this.scene.add(dashedPath(GOODS_PATH, color.sea, "goods-path"), dashedPath(MONEY_PATH, color.gold, "money-path"));
    for (let i = 0; i < 6; i++) {
      const c = coin(this.coinMat);
      this.coins.push(c);
      this.scene.add(c);
    }
    this.snowflakes = this.makeSnow();
    this.scene.add(this.snowflakes);
    this.collectMaterials();
  }

  private buildChina(): void {
    const cn = new THREE.Group();
    cn.add(landCn(this.cnGrass), factory(mat(W.wall)), yard(), office(mat(W.houseRoof[4])), dock(7.0), crane());
    const truckCn = truck(W.truckCab[0]);
    truckCn.group.position.set(2.75, 0.5, 4.72);
    cn.add(truckCn.group);
    const spots: [number, number][] = [
      [0.8, 0.8],
      [6.5, 0.7],
      [0.7, 3.4],
      [6.6, 3.2],
      [4.6, 6.2],
      [1.0, 8.8],
      [6.3, 8.6],
    ];
    for (const [x, z] of spots) {
      const t = tree(x, z, this.leafA, this.leafB);
      const bare = bareBranches(x, z);
      bare.visible = false;
      cn.add(t.group, bare);
      this.trees.push({ leaves: t.leaves, bare });
    }
    // 冬天屋顶上的雪
    this.snowRoofs.add(box(1.5, 1.1, 3.8, 2.5, 0.05, mat(W.snow), 2.75), box(4.85, 7.28, 1.5, 1.24, 0.05, mat(W.snow), 1.88));
    this.snowRoofs.visible = false;
    cn.add(this.snowRoofs);
    // 工厂门口的货箱（跨境直发时堆在这里）
    for (const [x, z, y] of this.crateSpots(2.9, 4.0)) {
      const c = crate(x, z, y);
      this.factoryCrates.push(c);
      cn.add(c);
    }
    // 烟囱的烟
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ color: W.smoke, transparent: true, opacity: 0.8, roughness: 1 }));
      p.position.set(4.8, 4.2 + i * 0.4, 1.55);
      this.smoke.push(p);
      cn.add(p);
    }
    this.scene.add(cn);
    this.cnGroup = cn;
  }

  private buildMalaysia(): void {
    const my = this.myGroup;
    my.add(landMy(), dock(13.9));
    const wh = warehouse(this.warehouseWall, this.warehouseRoof, this.warehouseRoofTop);
    this.doors = wh.doors;
    my.add(wh.group);
    const roofs = W.houseRoof;
    my.add(house(22.6, 1.0, roofs[2]), house(22.9, 2.75, roofs[3]), house(17.0, 6.2, roofs[0]), house(19.0, 7.2, roofs[1]), house(22.6, 6.0, roofs[4]));
    my.add(this.extraHouse);
    const truckMy = truck(W.truckCab[1]);
    truckMy.group.position.set(20.0, 0.5, 4.72);
    my.add(truckMy.group);
    const spots: [number, number][] = [
      [15.8, 0.9],
      [24.3, 0.8],
      [20.5, 0.9],
      [16, 9.1],
      [24.3, 9.2],
      [21.6, 8.9],
      [18.3, 9.3],
    ];
    for (const [x, z] of spots) {
      const p = palm(x, z);
      this.palms.push(p.crown);
      my.add(p.group);
    }
    for (let i = 0; i < STREET_SPOTS.length; i++) {
      const b = buyer(W.buyerBody[i % W.buyerBody.length]);
      b.group.position.set(STREET_SPOTS[i][0], 0.54, STREET_SPOTS[i][1]);
      this.buyers.push(b);
      my.add(b.group);
    }
    this.festive = { lights: festiveLights(), umbrellas: umbrellas(), bunting: bunting() };
    my.add(this.festive.lights, this.festive.umbrellas, this.festive.bunting);
    for (const [x, z, y] of this.crateSpots(17.0, 4.0)) {
      const c = crate(x, z, y);
      this.warehouseCrates.push(c);
      my.add(c);
    }
    this.scene.add(my);
  }

  /** 6 个货箱的位置：下面一排 4 个，上面 2 个 */
  private crateSpots(x: number, z: number): [number, number, number][] {
    return [
      [x, z, 0.54],
      [x + 0.46, z, 0.54],
      [x + 0.92, z, 0.54],
      [x + 1.38, z, 0.54],
      [x + 0.23, z, 0.96],
      [x + 0.69, z, 0.96],
    ];
  }

  private makeSnow(): THREE.Points {
    const n = 160;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // 雪花的位置用固定的公式铺开，不用随机数
      pos[i * 3] = ((i * 37) % 80) / 10 - 0.3;
      pos[i * 3 + 1] = 0.6 + ((i * 53) % 50) / 10;
      pos[i * 3 + 2] = ((i * 71) % 100) / 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: W.snow, size: 0.09 }));
    p.visible = false;
    return p;
  }

  private collectMaterials(): void {
    const seen = new Set<THREE.Material>();
    const visit = (o: THREE.Object3D, my: boolean): void => {
      o.traverse((c) => {
        if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshStandardMaterial && !seen.has(c.material)) {
          seen.add(c.material);
          this.allMaterials.push({ m: c.material, base: c.material.color.clone(), my });
        }
      });
    };
    visit(this.myGroup, true);
    visit(this.scene, false);
  }

  /** 世界要放进的区域。窗口变大变小时只改取景的大小，世界等比缩放 */
  resize(width: number, height: number, fit: FitRect): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.updateMatrixWorld();
    const inv = this.camera.matrixWorldInverse;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    // 按两块地（连同上面的建筑）实际的外框取景，四周再留一圈海（docs/10 第二节）；海本身可以延伸到区域外面
    // 外框只算一次：换季节、显示隐藏布置时，世界的位置不变（docs/10 第四节）
    if (!this.frameBox) {
      this.frameBox = new THREE.Box3();
      if (this.cnGroup) this.frameBox.expandByObject(this.cnGroup);
      this.frameBox.expandByObject(this.myGroup);
    }
    const box = this.frameBox;
    for (const x of [box.min.x, box.max.x]) {
      for (const z of [box.min.z, box.max.z]) {
        for (const y of [box.min.y, box.max.y]) {
          const v = new THREE.Vector3(x, y, z).applyMatrix4(inv);
          minX = Math.min(minX, v.x);
          maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y);
          maxY = Math.max(maxY, v.y);
        }
      }
    }
    const margin = 0.06 * Math.max(maxX - minX, maxY - minY);
    minX -= margin;
    maxX += margin;
    minY -= margin;
    maxY += margin;
    const s = Math.max((maxX - minX) / fit.width, (maxY - minY) / fit.height);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const left = cx - (fit.left + fit.width / 2) * s;
    const top = cy + (fit.top + fit.height / 2) * s;
    this.camera.left = left;
    this.camera.right = left + this.width * s;
    this.camera.top = top;
    this.camera.bottom = top - this.height * s;
    this.camera.updateProjectionMatrix();
    this.renderFrame(performance.now());
  }

  setView(view: WorldView): void {
    this.view = view;
    const season = W.season[view.season];
    (this.scene.background as THREE.Color).set(season.sky);
    this.sun.color.set(season.sun);
    this.sun.intensity = season.sunIntensity;
    this.cnGrass.color.set(season.grass);
    this.leafA.color.set(season.tree[0]);
    this.leafB.color.set(season.tree[1]);
    const winter = view.season === 3;
    for (const t of this.trees) {
      for (const l of t.leaves) l.visible = !winter;
      t.bare.visible = winter;
    }
    this.snowRoofs.visible = winter;
    this.snowflakes.visible = winter;
    this.festive.lights.visible = view.season === 0;
    this.festive.umbrellas.visible = view.season === 1;
    this.festive.bunting.visible = view.season === 3;
    const buyerCount = [6, 3, 4, 6][view.season] + (view.year === 1 ? 2 : 0);
    this.buyers.forEach((b, i) => {
      b.group.visible = i < buyerCount;
      b.parcel.visible = i % 2 === 0;
    });
    this.extraHouse.visible = view.year === 1;

    // 发货方式：跨境直发时仓库是暗的、门关着，货箱堆在工厂门口
    const local = view.fulfillment === "local";
    for (const d of this.doors) (d.material as THREE.MeshStandardMaterial).color.set(local ? W.window : W.wallShade);
    const piles = local ? this.warehouseCrates : this.factoryCrates;
    const empty = local ? this.factoryCrates : this.warehouseCrates;
    piles.forEach((c, i) => (c.visible = i < view.crates));
    for (const c of empty) c.visible = false;
    this.shipSlots.forEach((c, i) => (c.visible = i < view.shipContainers));
    this.coins.forEach((c, i) => {
      c.visible = i < view.coins;
      const t = (i + 0.5) / 6;
      c.position.copy(this.pointOnPath(MONEY_PATH, t)).add(new THREE.Vector3(0, 0.35, 0));
    });
    this.coinMat.color.set(view.frozen ? W.gray : W.coin);

    // 变灰：倒闭整个世界；封店只有马来西亚。跨境直发时仓库也偏暗
    const gray = new THREE.Color(W.gray);
    for (const { m, base, my } of this.allMaterials) {
      const toGray = view.gray === "all" || (view.gray === "my" && my);
      m.color.copy(base);
      if (toGray) m.color.lerp(gray, 0.75);
    }
    this.cnGrass.color.set(view.gray === "all" ? W.gray : season.grass);
    this.leafA.color.set(view.gray === "all" ? W.gray : season.tree[0]);
    this.leafB.color.set(view.gray === "all" ? W.gray : season.tree[1]);
    const dim = new THREE.Color(W.wall).lerp(gray, local ? 0 : 0.55);
    this.warehouseWall.color.copy(dim);
    this.warehouseRoof.color.set(W.roof).lerp(gray, local ? 0 : 0.6);
    this.warehouseRoofTop.color.set(W.roofDark).lerp(gray, local ? 0 : 0.6);
    this.renderFrame(performance.now());
  }

  private pointOnPath(path: [number, number, number][], t: number): THREE.Vector3 {
    const segs: { a: THREE.Vector3; b: THREE.Vector3; len: number }[] = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = new THREE.Vector3(...path[i]);
      const b = new THREE.Vector3(...path[i + 1]);
      const len = a.distanceTo(b);
      segs.push({ a, b, len });
      total += len;
    }
    let d = t * total;
    for (const s of segs) {
      if (d <= s.len) return s.a.clone().lerp(s.b, d / s.len);
      d -= s.len;
    }
    return new THREE.Vector3(...path[path.length - 1]);
  }

  /** 3D 里的点换算到屏幕上（CSS 像素） */
  private toScreen(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.width, y: ((1 - v.y) / 2) * this.height };
  }

  labelAnchors(): LabelAnchors {
    const local = this.view?.fulfillment === "local";
    return {
      supplier: this.toScreen(3.4, 4.6, 2.3),
      warehouse: this.toScreen(18.4, 3.3, 2.4),
      buyers: this.toScreen(23.6, 2.6, 4.2),
      ship: this.toScreen(this.shipGroup.position.x, 2.2, this.shipGroup.position.z),
      money: this.toScreen(12.4, 0.6, 10.6),
      stock: local ? this.toScreen(17.7, 1.9, 4.2) : this.toScreen(3.6, 1.9, 4.2),
      stockout: local ? this.toScreen(17.7, 2.6, 4.2) : this.toScreen(3.6, 2.6, 4.2),
    };
  }

  /** 画布是不是空的：中间取几个点，颜色不全相同（docs/11 S10） */
  sampleColors(): string[] {
    const gl = this.renderer.getContext();
    const out: string[] = [];
    const px = new Uint8Array(4);
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const a = this.labelAnchors();
    for (const p of [a.supplier, a.warehouse, a.ship, a.buyers, a.money]) {
      const fx = Math.min(0.99, Math.max(0, p.x / this.width));
      const fy = Math.min(0.99, Math.max(0, 1 - p.y / this.height));
      gl.readPixels(Math.floor(w * fx), Math.floor(h * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      out.push(Array.from(px).join(","));
    }
    return out;
  }

  start(): void {
    const loop = (t: number): void => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      // 没有东西在走的时候，每秒只重画 12 次（docs/10 第六节）
      if (t - this.lastFrame < 1000 / 12) return;
      this.renderFrame(t);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private renderFrame(t: number): void {
    if (this.disposed) return;
    this.lastFrame = t;
    if (!this.reduceMotion) {
      const s = t / 1000;
      this.shipGroup.position.y = Math.sin(s * 1.6) * 0.04;
      for (const c of this.coins) c.rotation.z = s * 1.2;
      this.smoke.forEach((p, i) => {
        const k = (s * 0.25 + i / 4) % 1;
        p.position.y = 4.15 + k * 1.6;
        (p.material as THREE.MeshStandardMaterial).opacity = 0.8 * (1 - k);
      });
      this.palms.forEach((p, i) => (p.rotation.z = Math.sin(s * 1.2 + i) * 0.05));
      if (this.snowflakes.visible) {
        const pos = this.snowflakes.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - 0.02;
          if (y < 0.55) y = 5.6;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }
    }
    this.renderer.render(this.scene, this.camera);
    if (this.firstFrameDone) {
      this.firstFrameDone();
      this.firstFrameDone = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    this.renderer.dispose();
  }
}

/** 浏览器能不能用 WebGL */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}
