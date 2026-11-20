// 世界里的每一样模型（docs/10 第三节）。全部用基本形状拼出来，每一样是一个函数，返回一个 three.js 的组。
// 坐标：x 向东，z 向南，y 向上。一个单位大约是一辆货车的宽度。
import * as THREE from "three";
import { color, world as W } from "../../ui/theme/tokens";

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** 不反光的纯色材质（粗糙度 0.85）。同一个颜色共用一个材质 */
export function mat(c: string, opts: { rough?: number; metal?: number; key?: string } = {}): THREE.MeshStandardMaterial {
  const key = `${opts.key ?? ""}${c}|${opts.rough ?? 0.85}|${opts.metal ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0, flatShading: true });
    matCache.set(key, m);
  }
  return m;
}

/** 单独一份材质（颜色要跟季节、状态变的东西用） */
export function ownMat(c: string, rough = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, flatShading: true });
}

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

/** 一个方块：左下角在 (x, y0, z)，大小 w × h × d */
export function box(x: number, z: number, w: number, d: number, h: number, m: THREE.Material, y0 = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x + w / 2, y0 + h / 2, z + d / 2);
  return shadowed(mesh);
}

/** 人字形屋顶：沿 x 方向延伸 */
export function gableRoof(x: number, z: number, w: number, d: number, h: number, m: THREE.Material, y0: number): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(-d / 2 - 0.12, 0);
  s.lineTo(d / 2 + 0.12, 0);
  s.lineTo(0, h);
  s.closePath();
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: w + 0.24, bevelEnabled: false }), m);
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(x - 0.12, y0, z + d / 2);
  return shadowed(mesh);
}

export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

// ---------------- 中国 ----------------

/** land-cn：沙色的边，草地（颜色跟季节变），一条横着的路，路中间有白色虚线 */
export function landCn(grass: THREE.Material): THREE.Group {
  const g = group(box(0, 0, 7.4, 10, 0.5, mat(W.sand)), box(0.25, 0.25, 6.9, 9.5, 0.04, grass, 0.5), box(0.25, 4.2, 6.9, 1, 0.05, mat(W.road), 0.5));
  for (let i = 0; i < 6; i++) g.add(box(0.6 + i * 1.1, 4.66, 0.55, 0.08, 0.06, mat(W.roadLine), 0.5));
  g.name = "land-cn";
  return g;
}

/** factory：白墙、三段锯齿屋顶、正面四扇窗一扇卷帘门、侧面两扇窗、烟囱和黑帽 */
export function factory(roofMat: THREE.Material): THREE.Group {
  const g = group(box(1.5, 1.1, 3.8, 2.5, 1.6, mat(W.wall), 0.5));
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(1.267, 0);
    s.lineTo(1.267, 0.65);
    s.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: false }), roofMat);
    m.position.set(1.5 + i * 1.267, 2.1, 1.1);
    g.add(shadowed(m));
  }
  for (let i = 0; i < 4; i++) g.add(box(1.75 + i * 0.9, 3.58, 0.55, 0.04, 0.5, mat(W.window), 1.25));
  g.add(box(2.9, 3.58, 1, 0.04, 0.6, mat(W.roofDark), 0.5));
  g.add(box(5.28, 1.6, 0.04, 0.5, 0.45, mat(W.window), 1.2), box(5.28, 2.6, 0.04, 0.5, 0.45, mat(W.window), 1.2));
  g.add(box(4.55, 1.35, 0.5, 0.5, 1.6, mat(W.chimney), 2.3), box(4.5, 1.3, 0.6, 0.6, 0.14, mat(W.chimneyCap), 3.9));
  g.name = "factory";
  return g;
}

/** 集装箱 */
export function container(x: number, z: number, y: number, c: string, w = 0.9, d = 0.42, h = 0.42): THREE.Mesh {
  return box(x, z, w, d, h, mat(c), y);
}

/** yard：两排三列的集装箱，上面再叠一个，五种以上颜色 */
export function yard(): THREE.Group {
  const g = new THREE.Group();
  const cols = W.container;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.add(container(1 + i, 5.9 + j * 0.5, 0.54, cols[(i * 2 + j) % cols.length]));
  g.add(container(1.5, 6.15, 0.96, cols[5]));
  g.name = "yard";
  return g;
}

/** office：人字形屋顶的小房子，一扇窗一扇门 */
export function office(roofMat: THREE.Material): THREE.Group {
  const g = group(
    box(4.9, 7.3, 1.4, 1.2, 0.9, mat(W.wall), 0.5),
    gableRoof(4.9, 7.3, 1.4, 1.2, 0.5, roofMat, 1.4),
    box(5.15, 8.48, 0.4, 0.04, 0.3, mat(W.window), 0.85),
    box(5.8, 8.48, 0.3, 0.04, 0.55, mat(W.trunk), 0.5),
  );
  g.name = "office";
  return g;
}

/** dock：木色的平台，伸到海里 */
export function dock(x: number): THREE.Group {
  const g = group(box(x, 3.7, 1.5, 2, 0.25, mat(W.dock), 0.5));
  g.name = x < 10 ? "dock-cn" : "dock-my";
  return g;
}

/** crane：两根立柱一根横梁，吊着一个集装箱 */
export function crane(): THREE.Group {
  const m = mat(W.crane);
  const g = group(box(7.3, 3.85, 0.18, 0.18, 2.2, m, 0.75), box(8.0, 3.85, 0.18, 0.18, 2.2, m, 0.75), box(6.8, 3.85, 2.4, 0.18, 0.18, m, 2.95));
  g.add(box(8.6, 3.92, 0.03, 0.03, 1.2, mat(W.chimneyCap), 1.75), container(8.5, 3.73, 1.35, W.container[2], 0.6, 0.4, 0.36));
  g.name = "crane";
  return g;
}

/** tree：树干加三团叶子。颜色和样子跟季节变（冬天没有叶子，枝头有雪） */
export function tree(x: number, z: number, leafA: THREE.Material, leafB: THREE.Material): { group: THREE.Group; leaves: THREE.Mesh[] } {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.7, 6), mat(W.trunk));
  trunk.position.set(x, 0.85, z);
  const g = group(trunk);
  const leaves: THREE.Mesh[] = [];
  const spots: [number, number, number, number, THREE.Material][] = [
    [0, 1.5, 0, 0.42, leafA],
    [-0.25, 1.25, 0.1, 0.32, leafB],
    [0.25, 1.3, -0.1, 0.32, leafA],
  ];
  for (const [dx, dy, dz, r, m] of spots) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
    s.position.set(x + dx, dy, z + dz);
    g.add(s);
    leaves.push(s);
  }
  g.name = "tree";
  return { group: shadowed(g), leaves };
}

/** 冬天的光秃枝头 */
export function bareBranches(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  for (const [a, l] of [[0.6, 0.5], [-0.7, 0.45], [0.1, 0.55]] as const) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, l, 5), mat(W.trunk));
    b.position.set(x + Math.sin(a) * l * 0.4, 1.35, z);
    b.rotation.z = -a;
    const snow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), mat(W.snow));
    snow.position.set(x + Math.sin(a) * l * 0.8, 1.35 + l * 0.42, z);
    g.add(b, snow);
  }
  return shadowed(g);
}

// ---------------- 海和船 ----------------

/** sea：一整块水面，几条白色的短线表示浪 */
export function sea(): THREE.Group {
  const water = new THREE.Mesh(new THREE.BoxGeometry(27.4, 0.6, 12.4), mat(W.seaWater, { rough: 0.25, metal: 0.05 }));
  water.position.set(12.5, -0.3, 5);
  water.receiveShadow = true;
  const g = group(water);
  const waves: [number, number, number][] = [
    [8.2, 1, 1.6],
    [11.4, 2.2, 1.2],
    [9.5, 8.6, 1.8],
    [12.6, 9.4, 1.2],
    [8.6, 6.4, 1],
    [13.4, 6.0, 1.4],
    [3, 10.6, 1.6],
    [19, 10.7, 1.4],
  ];
  for (const [x, z, w] of waves) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, 0.1), new THREE.MeshBasicMaterial({ color: W.waveLine }));
    f.position.set(x + w / 2, 0.012, z);
    g.add(f);
  }
  g.name = "sea";
  return g;
}

/** ship：深色船身、红色甲板线、白色驾驶舱和烟囱、两层集装箱。原点在船的中心，方便移动 */
export function ship(): { group: THREE.Group; slots: THREE.Mesh[] } {
  const g = group(box(-1.75, -0.7, 3.5, 1.4, 0.5, mat(W.shipHull), 0), box(-1.75, -0.7, 3.5, 1.4, 0.1, mat(W.shipDeck), 0.5));
  g.add(box(0.9, -0.45, 0.65, 0.9, 0.95, mat(W.wall), 0.6), box(1.05, -0.2, 0.28, 0.28, 0.5, mat(W.chimney), 1.55));
  // 7 个集装箱位：下层 6 个、上层 1 个。数量按档显示 0、3、7 个
  const slots: THREE.Mesh[] = [];
  let k = 0;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) slots.push(container(-1.55 + i * 0.78, -0.55 + j * 0.58, 0.6, W.container[k++ % 5], 0.7, 0.46, 0.4));
  slots.push(container(-1.17, -0.28, 1.0, W.container[3], 0.7, 0.46, 0.4));
  // 上层那一个放到第 3 位，这样 3 个时是下层一排
  const order = [0, 1, 2, 3, 4, 5, 6];
  for (const i of order) g.add(slots[i]);
  g.name = "ship";
  return { group: g, slots };
}

// ---------------- 马来西亚 ----------------

/** land-my：草地，一横一竖两条路 */
export function landMy(): THREE.Group {
  const g = group(
    box(15, 0, 10, 10, 0.5, mat(W.myGrassSide)),
    box(15.25, 0.25, 9.5, 9.5, 0.04, mat(W.myGrass), 0.5),
    box(15.25, 4.2, 9.5, 1, 0.05, mat(W.road), 0.5),
    box(21.1, 0.25, 1, 9.5, 0.05, mat(W.road), 0.5),
  );
  for (let i = 0; i < 8; i++) g.add(box(15.6 + i * 1.15, 4.66, 0.55, 0.08, 0.06, mat(W.roadLine), 0.5));
  g.name = "land-my";
  return g;
}

/** warehouse：白墙、青色双层平屋顶、正面三扇卷帘门、侧面两扇窗。暗和亮、门开和关由外面换材质 */
export function warehouse(wallMat: THREE.Material, roofMat: THREE.Material, roofTopMat: THREE.Material): { group: THREE.Group; doors: THREE.Mesh[] } {
  const g = group(box(16.5, 1, 3.8, 2.8, 1.5, wallMat, 0.5), box(16.4, 0.9, 4.0, 3.0, 0.26, roofMat, 2), box(16.9, 1.4, 3.0, 2.0, 0.12, roofTopMat, 2.26));
  const doors: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const d = box(16.8 + i * 1.15, 3.78, 0.9, 0.04, 0.95, ownMat(W.window), 0.5);
    doors.push(d);
    g.add(d);
  }
  g.add(box(20.28, 1.5, 0.04, 0.6, 0.4, mat(W.window), 1.2), box(20.28, 2.6, 0.04, 0.6, 0.4, mat(W.window), 1.2));
  g.name = "warehouse";
  return { group: g, doors };
}

/** house：人字形屋顶，每栋有门和窗 */
export function house(x: number, z: number, roof: string): THREE.Group {
  const g = group(
    box(x, z, 1.5, 1.4, 1, mat(W.wall), 0.5),
    gableRoof(x, z, 1.5, 1.4, 0.6, mat(roof), 1.5),
    box(x + 1.0, z + 1.38, 0.32, 0.04, 0.62, mat(W.trunk), 0.5),
    box(x + 0.2, z + 1.38, 0.4, 0.04, 0.32, mat(W.window), 0.95),
    box(x + 1.48, z + 0.4, 0.04, 0.6, 0.32, mat(W.window), 0.95),
  );
  g.name = "house";
  return g;
}

/** truck：白色车厢、彩色驾驶室、车窗、六个轮子。原点在车的中心 */
export function truck(cab: string): { group: THREE.Group; cargo: THREE.Mesh } {
  const cargo = box(-0.74, -0.3, 1.05, 0.6, 0.55, ownMat(W.wall), 0.12);
  const g = group(cargo, box(0.31, -0.3, 0.42, 0.6, 0.4, mat(cab), 0.12), box(0.72, -0.22, 0.02, 0.44, 0.18, mat(W.window), 0.3));
  for (const wx of [-0.54, 0.01, 0.51]) {
    for (const wz of [-0.29, 0.29]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12), mat(color.ink));
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.1, wz);
      g.add(w);
    }
  }
  g.name = "truck";
  return { group: shadowed(g), cargo };
}

/** palm：略弯的树干，顶上七片叶子。返回叶子的组，方便轻轻摆动 */
export function palm(x: number, z: number): { group: THREE.Group; crown: THREE.Group } {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.5, 6), mat(W.trunk));
  trunk.position.set(x, 1.25, z);
  trunk.rotation.z = 0.08;
  const crown = new THREE.Group();
  crown.position.set(x + 0.06, 1.95, z);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.95, 4), mat(W.palmLeaf));
    l.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42);
    l.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25);
    crown.add(l);
  }
  const g = group(trunk, crown);
  g.name = "palm";
  return { group: shadowed(g), crown };
}

/** buyer：身体、头、头发；可以拿着包裹。原点在脚下 */
export function buyer(body: string): { group: THREE.Group; parcel: THREE.Mesh } {
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 4, 8), mat(body));
  b.position.set(0, 0.28, 0);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat(W.skin));
  h.position.set(0, 0.62, 0);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(W.hair));
  hair.position.set(0, 0.64, 0);
  const parcel = box(0.08, 0.05, 0.16, 0.14, 0.14, mat(W.crate), 0.2);
  const g = group(b, h, hair, parcel);
  g.name = "buyer";
  return { group: shadowed(g), parcel };
}

/** crate：纸箱色的小方块 */
export function crate(x: number, z: number, y = 0.54): THREE.Mesh {
  const c = box(x, z, 0.42, 0.42, 0.42, mat(W.crate), y);
  c.name = "crate";
  return c;
}

/** coin：竖着的金色圆片 */
export function coin(m: THREE.Material): THREE.Mesh {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 24), m);
  c.rotation.x = Math.PI / 2;
  c.castShadow = true;
  c.name = "coin";
  return c;
}

/** 贴着地面的虚线（goods-path 青色、money-path 金色） */
export function dashedPath(points: [number, number, number][], c: string, name: string): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: c });
  for (let i = 0; i < points.length - 1; i++) {
    const a = new THREE.Vector3(...points[i]);
    const b = new THREE.Vector3(...points[i + 1]);
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.floor(len / 0.5));
    for (let k = 0; k < n; k++) {
      const p = a.clone().lerp(b, (k + 0.25) / n);
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.08), m);
      d.position.copy(p);
      d.lookAt(b.x, p.y, b.z);
      d.rotateY(Math.PI / 2);
      g.add(d);
    }
  }
  g.name = name;
  return g;
}

/** 开斋节：房子之间的彩灯和绿、黄两色的菱形挂饰 */
export function festiveLights(): THREE.Group {
  const g = new THREE.Group();
  const line: [number, number][] = [
    [17.2, 5.6],
    [24.0, 5.6],
  ];
  for (let i = 0; i <= 12; i++) {
    const x = line[0][0] + ((line[1][0] - line[0][0]) * i) / 12;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(W.lights[i % 4]));
    bulb.position.set(x, 1.7 - Math.sin((i / 12) * Math.PI) * 0.2, line[0][1]);
    g.add(bulb);
    if (i % 3 === 1) {
      const k = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), mat(W.ketupat[i % 2]));
      k.position.set(x, 1.45 - Math.sin((i / 12) * Math.PI) * 0.2, line[0][1]);
      g.add(k);
    }
  }
  g.name = "lights";
  return g;
}

/** 年终大促：三色的彩旗和门口的礼盒 */
export function bunting(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 3), mat(W.bunting[i % 3]));
    f.position.set(17.2 + i * 0.5, 1.6 - Math.sin((i / 13) * Math.PI) * 0.2, 5.6);
    f.rotation.x = Math.PI;
    g.add(f);
  }
  for (const [x, z] of [
    [22.3, 3.9],
    [23.7, 6.0],
    [18.2, 7.6],
    [20.2, 8.4],
  ] as const) {
    const gift = box(x, z, 0.32, 0.32, 0.3, mat(W.gift), 0.54);
    g.add(gift, box(x + 0.13, z - 0.01, 0.06, 0.34, 0.31, mat(W.crane), 0.54));
  }
  g.name = "bunting";
  return shadowed(g);
}

/** 淡季：路边两把遮阳伞 */
export function umbrellas(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [
    [18.6, 5.9],
    [23.2, 3.6],
  ] as const) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), mat(W.wall));
    pole.position.set(x, 1.05, z);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.3, 8), mat(W.umbrella[0]));
    top.position.set(x, 1.65, z);
    g.add(pole, top);
  }
  g.name = "umbrellas";
  return shadowed(g);
}
