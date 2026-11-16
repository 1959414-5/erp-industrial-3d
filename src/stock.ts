import * as THREE from 'three';

// Grade 6×7 de paletes com chapas — posição e espaçamento do layout de referência.
const COLS = 6, ROWS = 7, MAX = 18, T = 0.07, GAP = 0.012, BASE = 0.16;
const SPX = 4.5, SPZ = 3.0;
const STEEL = [0xaab3c2, 0xb9c1ce, 0x8f9aab, 0xc4cbd6];
const hash = (n: number) => Math.abs(Math.sin(n * 127.1) * 43758.5453) % 1;

/** Lotes de chapas metálicas empilhadas sobre paletes. Altura da pilha = ocupação (0..1) de cada posição. */
export class SheetLots {
  readonly group = new THREE.Group();
  private pallets: THREE.InstancedMesh;
  private sheets: THREE.InstancedMesh;
  private straps: THREE.InstancedMesh;
  private tops: number[] = new Array(COLS * ROWS).fill(BASE);

  constructor(private origin = new THREE.Vector3(23, 0, -12)) {
    const n = COLS * ROWS;
    this.pallets = new THREE.InstancedMesh(new THREE.BoxGeometry(3.8, BASE, 2.4), new THREE.MeshStandardMaterial({ color: 0xc9a26b, roughness: 0.9 }), n);
    this.sheets = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, T, 2.1), new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.85 }), n * MAX);
    this.straps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 1, 2.2), new THREE.MeshStandardMaterial({ color: 0x2b3550, roughness: 0.6 }), n * 2);
    for (const m of [this.pallets, this.sheets, this.straps]) { m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
    this.setOccupancy(new Array(n).fill(0.5));
  }

  setOccupancy(values: number[], states: string[] = []) {
    const d = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < COLS * ROWS; i++) {
      const v = values[i] ?? 0, col = i % COLS, row = Math.floor(i / COLS);
      const x = this.origin.x + col * SPX, z = this.origin.z + row * SPZ;
      const layers = v < 0.15 ? 0 : Math.max(1, Math.round(v * MAX));
      d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.position.set(x, BASE / 2, z); d.updateMatrix(); this.pallets.setMatrixAt(i, d.matrix);
      const state = states[i];
      const palletTone = state === 'critical' ? 0xffb9bb
        : state === 'empty' ? 0xc3cbd6
          : state === 'full' ? 0xb6dcb9
            : state === 'medium' ? 0xf3d69a
              : state === 'low' ? 0xb8d0ee : 0xffffff;
      this.pallets.setColorAt(i, c.setHex(palletTone));
      const steel = STEEL[Math.floor(hash(i) * STEEL.length)];
      const tag = state === 'critical' ? 0xe5484d
        : state === 'empty' ? 0x9aa5b8
          : state === 'full' ? 0x22b573
            : state === 'medium' ? 0xf5b83d
              : state === 'low' ? 0x3b82f6
                : v > 0.8 ? 0x22b573 : v > 0.5 ? 0xf5b83d : steel;
      for (let l = 0; l < MAX; l++) {
        const k = i * MAX + l;
        if (l >= layers) { d.scale.setScalar(0.0001); d.position.set(x, 0, z); }
        else { d.scale.set(1, 1, 1); d.position.set(x + (hash(k) - 0.5) * 0.07, BASE + l * (T + GAP) + T / 2, z + (hash(k + 9) - 0.5) * 0.07); }
        d.rotation.y = (hash(k + 3) - 0.5) * 0.03; d.updateMatrix(); this.sheets.setMatrixAt(k, d.matrix);
        this.sheets.setColorAt(k, c.set(l === layers - 1 ? tag : steel));
      }
      const h = Math.max(layers * (T + GAP), 0.001); this.tops[i] = BASE + (layers ? h : 0);
      for (let s = 0; s < 2; s++) {
        d.rotation.set(0, 0, 0); d.scale.set(1, layers ? h + 0.04 : 0.0001, 1);
        d.position.set(x + (s ? 1.1 : -1.1), BASE + h / 2, z); d.updateMatrix(); this.straps.setMatrixAt(i * 2 + s, d.matrix);
      }
    }
    for (const m of [this.pallets, this.sheets, this.straps]) m.instanceMatrix.needsUpdate = true;
    if (this.sheets.instanceColor) this.sheets.instanceColor.needsUpdate = true;
    if (this.pallets.instanceColor) this.pallets.instanceColor.needsUpdate = true;
  }

  center(i: number) { return new THREE.Vector3(this.origin.x + (i % COLS) * SPX, 0, this.origin.z + Math.floor(i / COLS) * SPZ); }
  top(i: number) { return this.tops[i]; }
  pick(ray: THREE.Raycaster): { distance: number; index: number } | null {
    const out: { distance: number; index: number }[] = [];
    const a = ray.intersectObject(this.sheets)[0], p = ray.intersectObject(this.pallets)[0];
    if (a && a.instanceId !== undefined) out.push({ distance: a.distance, index: Math.floor(a.instanceId / MAX) });
    if (p && p.instanceId !== undefined) out.push({ distance: p.distance, index: p.instanceId });
    return out.sort((x, y) => x.distance - y.distance)[0] ?? null;
  }
}
