// 展示页用：docs/10 第三节清单里的每一样模型单独摆出来，一格一样。这里的代码不引用 React。
import * as THREE from "three";
import { color, world as W } from "../../ui/theme/tokens";
import {
  bareBranches,
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

/** 季节的编号：0 春、1 夏、2 秋、3 冬（docs/10 第四节） */
export type ShelfSeason = 0 | 1 | 2 | 3;

/** 每一格：模型的编号（和 docs/10 一样）和造模型的函数。中国的草地和树跟季节变，冬天的树没有叶子 */
export const SHELF_ITEMS: { id: string; make: (season: ShelfSeason) => THREE.Object3D }[] = [
  { id: "land-cn", make: (s) => landCn(ownMat(W.season[s].grass)) },
  { id: "factory", make: () => factory(mat(W.wall)) },
  { id: "yard", make: () => yard() },
  { id: "office", make: () => office(mat(W.houseRoof[4])) },
  { id: "dock-cn", make: () => dock(7.0) },
  { id: "dock-my", make: () => dock(13.9) },
  { id: "crane", make: () => crane() },
  { id: "sea", make: () => sea() },
  { id: "ship", make: () => ship().group },
  { id: "land-my", make: () => landMy() },
  { id: "warehouse", make: () => warehouse(ownMat(W.wall), ownMat(W.roof), ownMat(W.roofDark)).group },
  { id: "house", make: () => house(0, 0, W.houseRoof[0]) },
  { id: "truck", make: () => truck(W.truckCab[0]).group },
  {
    id: "tree",
    make: (s) => (s === 3 ? bareBranches(0, 0) : tree(0, 0, ownMat(W.season[s].tree[0]), ownMat(W.season[s].tree[1])).group),
  },
  { id: "palm", make: () => palm(0, 0).group },
  { id: "buyer", make: () => buyer(W.buyerBody[0]).group },
  { id: "crate", make: () => crate(0, 0) },
  { id: "coin", make: () => coin(new THREE.MeshStandardMaterial({ color: W.coin, roughness: 0.35, metalness: 0.5 })) },
  { id: "goods-path", make: () => dashedPath([[0, 0.05, 0], [4, 0.05, 0]], color.sea, "goods-path") },
  { id: "money-path", make: () => dashedPath([[0, 0.05, 0], [4, 0.05, 0]], color.gold, "money-path") },
  { id: "lights", make: () => festiveLights() },
  { id: "umbrellas", make: () => umbrellas() },
  { id: "bunting", make: () => bunting() },
];

/** 每一样模型画在自己的小图里：一个渲染器，轮流画每一样，再复制到各自的 2D 画布上 */
export class ModelShelf {
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);

  constructor(private tileW: number, private tileH: number) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setSize(tileW, tileH, false);
  }

  /** 把第 i 样模型按某个季节画到 target 上 */
  draw(i: number, target: HTMLCanvasElement, season: ShelfSeason): void {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(W.season[season].sky);
    scene.add(new THREE.HemisphereLight(color.paper, W.window, 1.7), new THREE.AmbientLight(color.paper, 0.6));
    const sun = new THREE.DirectionalLight(W.season[season].sun, W.season[season].sunIntensity);
    sun.position.set(-7, 21, 15); // 和世界一样（docs/10 第二节）
    scene.add(sun);
    const obj = SHELF_ITEMS[i].make(season);
    scene.add(obj);
    // 镜头和世界一样从东南上方 (30, 24.5, 30) 的方向看（docs/10 第二节），大小按包住模型的球来定
    const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
    const r = Math.max(sphere.radius, 0.1) * 1.05;
    const aspect = this.tileW / this.tileH;
    this.camera.left = -r * aspect;
    this.camera.right = r * aspect;
    this.camera.top = r;
    this.camera.bottom = -r;
    this.camera.near = 0.1;
    this.camera.far = r * 20 + 100;
    this.camera.position.copy(sphere.center).add(new THREE.Vector3(30, 24.5, 30).normalize().multiplyScalar(r * 6 + 20));
    this.camera.lookAt(sphere.center);
    this.camera.updateProjectionMatrix();
    this.renderer.render(scene, this.camera);
    const src = this.renderer.domElement;
    target.width = src.width;
    target.height = src.height;
    const ctx = target.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(src, 0, 0);
    }
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
