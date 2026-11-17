import * as THREE from 'three';
import type { MachineType } from './data';

export type Status = 'run' | 'idle' | 'down';
export interface MachineModel { group: THREE.Group; update(dt: number, s: Status): void }

const std = (color: number, rough = 0.6, metal = 0.1) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const M = {
  white: std(0xf4f6f7, 0.5), gray: std(0x9aa1aa, 0.45, 0.5), dark: std(0x303b49, 0.5, 0.3), blue: std(0x303b49, 0.45, 0.2),
  orange: std(0xf26a1b, 0.45, 0.2), metal: std(0xcfd6e2, 0.3, 0.8),
  glass: new THREE.MeshStandardMaterial({ color: 0xd7dce1, transparent: true, opacity: 0.24, roughness: 0.18, metalness: 0.12, depthWrite: false }),
  fence: new THREE.MeshStandardMaterial({ color: 0xffb36b, transparent: true, opacity: 0.22, depthWrite: false }),
  screen: new THREE.MeshStandardMaterial({ color: 0x303b49, emissive: 0xe96b2c, emissiveIntensity: 0.28 }),
  spark: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe96b2c, emissiveIntensity: 2.4 }),
};
const b = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y + h / 2, z); return mesh;
};
const cyl = (r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 24) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); mesh.position.set(x, y + h / 2, z); return mesh;
};
const sparkMesh = () => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), M.spark); s.visible = false; return s; };

/** Torre de sinalização industrial: verde = operando, âmbar = parada, vermelho = falha. */
function stackLight(g: THREE.Group, x: number, y: number, z: number) {
  g.add(cyl(0.045, 0.5, M.dark, x, y, z, 10));
  const colors = [0x22b573, 0xf5b83d, 0xe5484d];
  const mats = colors.map((color) => new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.035,
    roughness: 0.32,
    metalness: 0.08,
  }));
  // Lentes compactas e reaproveitadas por geometria; só a intensidade varia por estado.
  mats.forEach((material, i) => g.add(cyl(0.11, 0.13, material, x, y + 0.5 + i * 0.14, z, 16)));
  return (s: Status, t: number) => {
    mats[0].emissiveIntensity = s === 'run' ? 1.2 : 0.035;
    mats[1].emissiveIntensity = s === 'idle' ? 0.95 : 0.035;
    mats[2].emissiveIntensity = s === 'down' ? (Math.sin(t * 8) > 0 ? 1.65 : 0.08) : 0.035;
  };
}

function laser() {
  const g = new THREE.Group();

  // Base estrutural e mesa de corte interna.
  g.add(b(3.8, 0.28, 2.72, M.dark, 0, 0.14, 0));
  g.add(b(3.56, 0.12, 2.48, M.metal, 0, 0.34, 0));
  g.add(b(3.18, 0.1, 2.02, M.dark, 0, 0.48, -0.02));
  for (let i = 0; i < 17; i++) {
    const z = -0.92 + i * 0.115;
    g.add(b(3.0, 0.035, 0.035, M.metal, 0, 0.57, z));
  }

  // Carenagem fechada, laterais, traseira e cobertura superior.
  g.add(
    b(0.22, 1.72, 2.36, M.white, -1.72, 1.22, -0.02),
    b(0.22, 1.72, 2.36, M.white, 1.72, 1.22, -0.02),
    b(3.22, 1.72, 0.16, M.white, 0, 1.22, -1.12),
    b(3.72, 0.18, 2.62, M.gray, 0, 2.18, -0.02),
    b(3.45, 0.12, 0.12, M.dark, 0, 2.05, 1.15),
  );

  // Portas frontais com visor translúcido e perfis de grafite.
  g.add(
    b(3.22, 0.12, 0.1, M.dark, 0, 0.58, 1.18),
    b(3.22, 0.1, 0.1, M.dark, 0, 1.98, 1.18),
    b(0.09, 1.28, 0.1, M.dark, -1.59, 1.29, 1.18),
    b(0.09, 1.28, 0.1, M.dark, 1.59, 1.29, 1.18),
  );
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9dde2, transparent: true, opacity: 0.22,
    roughness: 0.16, metalness: 0.12, depthWrite: false,
  });
  const leftDoor = b(1.52, 1.25, 0.035, windowMaterial, -0.78, 1.28, 1.18);
  const rightDoor = b(1.52, 1.25, 0.035, windowMaterial, 0.78, 1.28, 1.18);
  g.add(leftDoor, rightDoor, b(0.035, 1.25, 0.05, M.orange, 0, 1.28, 1.2));

  // Gantry, cabeçote laser, bocal e trilho porta-cabos.
  const gantry = new THREE.Group();
  gantry.position.set(0, 1.77, 0);
  gantry.add(b(3.08, 0.16, 0.22, M.dark));
  gantry.add(b(2.92, 0.045, 0.08, M.orange, 0, 0.1, 0.02));
  const head = new THREE.Group();
  head.add(b(0.36, 0.42, 0.34, M.gray, 0, -0.28, 0.03));
  head.add(b(0.24, 0.2, 0.26, M.dark, 0, -0.58, 0.03));
  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 16), M.metal);
  nozzle.rotation.x = Math.PI;
  nozzle.position.set(0, -0.78, 0.03);
  const sp = sparkMesh();
  sp.scale.setScalar(0.72);
  sp.position.set(0, -0.88, 0.03);
  head.add(nozzle, sp);
  gantry.add(head);
  g.add(gantry);

  // Corrente porta-cabos em segmentos para reforçar a leitura do equipamento.
  const cable = new THREE.Group();
  for (let i = 0; i < 12; i++) cable.add(b(0.12, 0.055, 0.08, i % 3 === 0 ? M.orange : M.dark, -1.25 + i * 0.11, 0, 0));
  cable.position.set(0, 2.0, -0.88);
  g.add(cable);

  // Console lateral com tela orientada para o corredor.
  g.add(
    b(0.55, 1.12, 0.58, M.white, 2.28, 0.56, 0.7),
    b(0.58, 0.08, 0.62, M.dark, 2.28, 1.12, 0.7),
    b(0.42, 0.42, 0.04, M.dark, 2.28, 1.42, 1.0),
    b(0.28, 0.035, 0.04, M.orange, 2.28, 1.21, 1.03),
  );
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.25), M.screen);
  screen.position.set(2.28, 1.42, 1.03);
  g.add(screen);
  const light = stackLight(g, -1.42, 2.26, -0.92);

  let p = 0, t = 0;
  return {
    group: g,
    update(dt: number, s: Status) {
      t += dt;
      if (s === 'run') p += dt;
      gantry.position.z = Math.sin(p * 0.72) * 0.52;
      head.position.x = Math.sin(p * 1.85) * 1.08;
      cable.rotation.y = Math.sin(p * 0.72) * 0.09;
      sp.visible = s === 'run' && Math.sin(p * 35) > -0.3;
      light(s, t);
    },
  };
}

/** Mesa CNC aberta com tocha: fallback visual para o tipo plasma. */
function plasma() {
  const g = new THREE.Group();
  g.add(b(5.2, 0.28, 2.55, M.dark, 0, 0.16));
  g.add(b(4.95, 0.12, 2.3, M.metal, 0, 0.34));
  for (let i = 0; i < 25; i++) {
    const z = -1.02 + i * 0.085;
    g.add(b(4.7, 0.035, 0.045, M.gray, 0, 0.43, z));
  }
  for (const x of [-2.38, 2.38]) {
    g.add(b(0.12, 1.55, 0.12, M.dark, x, 0.38, -0.98));
    g.add(b(0.12, 1.55, 0.12, M.dark, x, 0.38, 0.98));
  }
  const bridge = new THREE.Group();
  bridge.position.set(0, 1.76, 0);
  bridge.add(b(5.0, 0.25, 0.3, M.dark));
  bridge.add(b(0.22, 0.62, 0.32, M.orange, 0, -0.42, 0.02));
  const torch = new THREE.Group();
  torch.add(b(0.22, 0.35, 0.22, M.gray, 0, -0.28));
  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 12), M.metal);
  nozzle.rotation.x = Math.PI; nozzle.position.y = -0.53; torch.add(nozzle);
  const spark = sparkMesh(); spark.position.y = -0.63; torch.add(spark);
  bridge.add(torch); g.add(bridge);
  const cabinet = b(0.52, 1.1, 0.62, M.white, 2.72, 0.0, 0.78);
  g.add(cabinet, b(0.46, 0.36, 0.04, M.dark, 2.72, 0.72, 1.1));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), M.screen);
  screen.position.set(2.72, 0.84, 1.13); g.add(screen);
  const light = stackLight(g, -2.3, 1.95, -0.95);
  let p = 0, t = 0;
  return { group: g, update(dt: number, s: Status) {
    t += dt; if (s === 'run') p += dt;
    bridge.position.z = Math.sin(p * 0.7) * 0.48;
    torch.position.x = Math.sin(p * 1.7) * 2.0;
    spark.visible = s === 'run' && Math.sin(p * 34) > -0.3;
    light(s, t);
  } };
}

function pressBrake() {
  const g = new THREE.Group();
  g.add(b(0.4, 2.6, 1.3, M.blue, -1.3), b(0.4, 2.6, 1.3, M.blue, 1.3), b(3, 0.35, 0.9, M.blue, 0, 2.6));
  g.add(b(2.6, 0.7, 0.9, M.gray, 0, 0.5, 0.15), b(2.4, 0.18, 0.25, M.dark, 0, 1.2, 0.15), b(1.8, 0.04, 0.6, M.metal, 0, 1.38, 0.15));
  g.add(b(0.5, 0.5, 0.4, M.white, 0, 0, 0.9));
  const ram = new THREE.Group(); ram.add(b(2.4, 0.3, 0.12, M.dark, 0, 0, 0.15), b(2.6, 0.4, 0.45, M.white, 0, 0.3, 0.15)); g.add(ram);
  const light = stackLight(g, 1.3, 2.95, -0.2); let p = 0, t = 0;
  return { group: g, update(dt: number, s: Status) { t += dt; if (s === 'run') p += dt;
    ram.position.y = 1.5 + 0.35 * (0.5 + 0.5 * Math.sin(p * 2.2)); light(s, t); } };
}

function cnc() {
  const g = new THREE.Group();
  g.add(b(2.8, 2.0, 1.4, M.white, 0, 0, -0.4), b(0.5, 2.0, 0.8, M.white, -1.15, 0, 0.7), b(0.9, 2.0, 0.8, M.white, 0.95, 0, 0.7));
  g.add(b(1.4, 0.55, 0.8, M.white, -0.2, 1.45, 0.7), b(1.4, 0.5, 0.8, M.white, -0.2, 0, 0.7), b(2.9, 0.1, 2.3, M.blue, 0, 2.0, 0));
  g.add(b(1.4, 0.95, 0.02, M.dark, -0.2, 0.5, 0.31), b(1.2, 0.12, 0.6, M.gray, -0.2, 0.5, 0.6), b(0.5, 0.3, 0.4, M.metal, -0.2, 0.62, 0.6));
  g.add(b(1.4, 0.95, 0.03, M.glass, -0.2, 0.5, 1.08), b(0.6, 0.4, 0.1, M.dark, 0.95, 1.1, 1.15));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), M.screen); scr.position.set(0.95, 1.3, 1.21); g.add(scr);
  const spindle = new THREE.Group(); spindle.position.set(-0.2, 1.25, 0.6); spindle.add(b(0.26, 0.3, 0.26, M.blue, 0, 0.1));
  const tool = cyl(0.04, 0.35, M.metal, 0, -0.25, 0, 10); spindle.add(tool); g.add(spindle);
  const light = stackLight(g, -1.2, 2.1, -0.6); let p = 0, t = 0;
  return { group: g, update(dt: number, s: Status) { t += dt; if (s === 'run') { p += dt; tool.rotation.y += dt * 30; }
    spindle.position.x = -0.2 + Math.sin(p * 1.3) * 0.3; spindle.position.y = 1.25 - 0.1 * (0.5 + 0.5 * Math.sin(p * 2.6)); light(s, t); } };
}

function robotWelder() {
  const g = new THREE.Group();
  g.add(b(3, 0.12, 2.6, M.gray), b(3, 1.6, 0.05, M.fence, 0, 0.12, -1.25), b(0.05, 1.6, 2.5, M.fence, -1.45, 0.12), b(0.05, 1.6, 2.5, M.fence, 1.45, 0.12));
  for (const [x, z] of [[-1.45, -1.25], [1.45, -1.25], [-1.45, 1.25], [1.45, 1.25]]) g.add(b(0.1, 1.75, 0.1, M.orange, x, 0.12, z));
  g.add(b(1.2, 0.5, 0.8, M.gray, 0, 0.12, 0.6), b(0.8, 0.3, 0.4, M.metal, 0, 0.62, 0.6));
  g.add(cyl(0.32, 0.3, M.dark, 0, 0.12, -0.5));
  const turret = new THREE.Group(); turret.position.set(0, 0.42, -0.5); turret.add(b(0.32, 0.5, 0.32, M.orange));
  const lower = new THREE.Group(); lower.position.y = 0.45; lower.add(b(0.2, 0.9, 0.2, M.orange));
  const elbow = new THREE.Group(); elbow.position.y = 0.9; elbow.add(b(0.18, 0.8, 0.18, M.white));
  const wrist = new THREE.Group(); wrist.position.y = 0.8; wrist.add(b(0.08, 0.35, 0.08, M.dark));
  const sp = sparkMesh(); sp.position.y = 0.4; wrist.add(sp); elbow.add(wrist); lower.add(elbow); turret.add(lower); g.add(turret);
  const light = stackLight(g, 1.45, 1.87, -1.25); let p = 0, t = 0;
  return { group: g, update(dt: number, s: Status) { t += dt; if (s === 'run') p += dt;
    turret.rotation.y = Math.sin(p * 0.6) * 0.5; lower.rotation.x = 0.55 + Math.sin(p * 1.1) * 0.2;
    elbow.rotation.x = 0.9 + Math.sin(p * 1.1 + 1) * 0.25; wrist.rotation.x = 0.8;
    sp.visible = s === 'run' && Math.sin(p * 35) > -0.3; light(s, t); } };
}

function paintBooth() {
  const g = new THREE.Group();
  g.add(b(3, 2.4, 2.4, M.white), b(3.02, 0.15, 2.42, M.blue, 0, 1.95), b(2.4, 1.7, 0.06, M.dark, 0, 0.35, 1.2), b(2.4, 1.7, 0.04, M.glass, 0, 0.35, 1.26));
  g.add(b(2.2, 0.05, 0.3, M.screen, 0, 1.95, 1.1), cyl(0.35, 0.8, M.gray, 0.8, 2.4, -0.5));
  const hang = new THREE.Group(); hang.position.set(0, 0.5, 0.9); hang.add(b(0.4, 0.9, 0.3, M.metal, 0, 0), cyl(0.02, 0.5, M.dark, 0, 0.9, 0, 8)); g.add(hang);
  const fan = new THREE.Group(); fan.position.set(0.8, 3.2, -0.5); fan.add(b(0.6, 0.03, 0.12, M.dark), b(0.12, 0.03, 0.6, M.dark)); g.add(fan);
  const light = stackLight(g, -1.2, 2.4, -0.8); let p = 0, t = 0;
  return { group: g, update(dt: number, s: Status) { t += dt; if (s === 'run') { p += dt; fan.rotation.y += dt * 12; }
    hang.rotation.y = p * 0.8; light(s, t); } };
}

/** Puncionadeira CNC — torre com ferramentas rotativas que perfuram a chapa. */
function punchPress() {
  const g = new THREE.Group();
  g.add(b(3, 0.8, 2.4, M.white), b(2.7, 0.08, 2.0, M.dark, 0, 0.8), b(2.3, 0.05, 1.6, M.metal, 0, 0.88));
  // coluna C
  g.add(b(0.5, 2.6, 1.0, M.blue, -1.3, 0.8), b(3, 0.28, 0.8, M.blue, 0, 3.4));
  // turreta
  const turret = new THREE.Group(); turret.position.set(0, 3.1, 0);
  turret.add(cyl(0.6, 0.4, M.gray, 0, 0, 0, 20));
  const punch = cyl(0.06, 0.5, M.metal, 0.35, -0.4, 0, 10);
  turret.add(punch);
  g.add(turret);
  // painel
  g.add(b(0.5, 1.0, 0.4, M.white, 1.3, 0.8, 1.0));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.26), M.screen); scr.position.set(1.3, 1.65, 1.21); g.add(scr);
  const light = stackLight(g, -1.3, 3.7, -0.4); let p = 0, t = 0;
  return { group: g, update(dt: number, s: Status) { t += dt; if (s === 'run') p += dt;
    turret.rotation.y = p * 0.6;
    punch.position.y = -0.4 - 0.15 * (0.5 + 0.5 * Math.sin(p * 12)); // golpe rápido
    light(s, t); } };
}

/** Serra de fita — corte de barras e chapas grossas. */
function bandSaw() {
  const g = new THREE.Group();
  // base e morsa
  g.add(b(2.4, 0.6, 1.6, M.gray, 0, 0), b(1.6, 0.4, 0.6, M.metal, 0, 0.6, 0), b(0.3, 0.5, 0.6, M.dark, -0.8, 0.6, 0), b(0.3, 0.5, 0.6, M.dark, 0.8, 0.6, 0));
  // coluna
  g.add(b(0.4, 2.6, 0.4, M.blue, -1.1, 0.6));
  // braço articulado
  const arm = new THREE.Group(); arm.position.set(-1.1, 2.8, 0);
  arm.add(b(2.4, 0.3, 0.5, M.white));
  // disco da serra (representado como cilindro fino)
  const blade = cyl(0.7, 0.03, M.metal, 0.6, -0.3, 0, 32);
  arm.add(blade);
  g.add(arm);
  // motor
  g.add(cyl(0.3, 0.5, M.dark, -1.1, 3.2, -0.3, 12));
  const light = stackLight(g, 1.1, 1.2, -0.6); let p = 0, t = 0;
  return { group: g, update(dt: number, s: Status) { t += dt; if (s === 'run') { p += dt; blade.rotation.y += dt * 20; }
    arm.rotation.z = -0.15 + Math.sin(p * 0.4) * 0.12; light(s, t); } };
}

const BUILDERS: Record<MachineType, () => { group: THREE.Group; update(dt: number, s: Status): void }> = {
  laser, plasma, pressBrake, cnc, robotWelder, paintBooth, punchPress, bandSaw
};

export function buildMachine(type: MachineType): MachineModel {
  const m = (BUILDERS[type] ?? laser)();
  m.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return m;
}
