// 世界的模型（docs/10 第三节）：清单里的每一样都有，并且都能造出来（不需要 WebGL）。
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { SHELF_ITEMS } from "../src/scene/world/ModelShelf";

const docs = join(__dirname, "..", "docs");
const doc10 = readFileSync(join(docs, readdirSync(docs).find((f) => f.startsWith("10-")) ?? ""), "utf8");
const section3 = doc10.split("## 三、世界里有什么")[1].split("## 四")[0];
const ids = [...section3.matchAll(/^\| `([a-z-]+)`(?:、`([a-z-]+)`)?/gm)].flatMap((m) => [m[1], m[2]].filter(Boolean));

describe("世界的模型", () => {
  it("docs/10 第三节清单里的每个编号，展示页的每一样模型里都有", () => {
    expect(ids.length).toBeGreaterThanOrEqual(19);
    const shelf = new Set(SHELF_ITEMS.map((x) => x.id));
    expect(ids.filter((id) => !shelf.has(id))).toEqual([]);
  });
  it("每一样模型在四个季节都能造出来，里面有看得见的形状，大小合理", () => {
    for (const item of SHELF_ITEMS) {
      for (const season of [0, 1, 2, 3] as const) {
        const obj = item.make(season);
        let meshes = 0;
        obj.traverse((o) => {
          if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) meshes++;
        });
        expect(meshes, item.id).toBeGreaterThan(0);
        const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
        expect(Math.max(size.x, size.y, size.z), item.id).toBeGreaterThan(0.05);
        expect(Math.max(size.x, size.y, size.z), item.id).toBeLessThan(40);
      }
    }
  });
});
