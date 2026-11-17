import * as THREE from 'three';
import { buildCounter, buildPrinter, buildWaterCooler, buildServerRack, buildCabinet,
  buildSofa, buildCoffeeTable, buildWaitChair } from './props';
import { loadIndustrialAsset, type IndustrialAssetKey } from './industrial-assets';

const std = (color: number, rough = 0.6, metal = 0.05) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const b = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y + h / 2, z); return mesh;
};
const cyl = (r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, s = 16) => {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, s), m); me.position.set(x, y + h / 2, z); return me;
};
/** Vasinho com planta. */
function plant(x: number, z: number): THREE.Group {
  const p = new THREE.Group();
  const pot = std(0xd4dcea, 0.7), soil = std(0x514438, 0.95);
  const leafDark = std(0x285d39, 0.9), leafGreen = std(0x3f824b, 0.88), leafLight = std(0x69a35e, 0.88);
  p.add(cyl(0.22, 0.44, pot, x, 0, z, 16), cyl(0.18, 0.035, soil, x, 0.42, z, 16));
  p.add(cyl(0.035, 0.72, leafDark, x, 0.44, z, 8));
  const leaves: [number, number, number, number, number][] = [
    [0, 1.02, 0, 0.42, 0], [-0.28, 1.02, 0.02, 0.34, 0.7],
    [0.28, 1.12, 0.02, 0.38, -0.7], [-0.16, 1.35, -0.08, 0.32, -0.6],
    [0.18, 1.42, 0.06, 0.3, 0.65], [0, 1.62, -0.04, 0.27, 0.15],
  ];
  leaves.forEach(([lx, ly, lz, size, rz], i) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), i % 3 === 0 ? leafLight : i % 2 ? leafDark : leafGreen);
    leaf.scale.set(size * 0.58, size, size * 0.42);
    leaf.position.set(x + lx, ly, z + lz); leaf.rotation.z = rz; leaf.castShadow = true; p.add(leaf);
  });
  return p;
}
/** Piso vinílico amadeirado: réguas claras, juntas desencontradas e veios discretos. */
function woodFloorTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const c = cv.getContext('2d')!;
  const rowH = 512 / 6;
  const plankPalette = ['#d6bd9a', '#cdb28c', '#ddc6a4', '#c7ad88', '#d9c09a', '#cfb48d'];
  c.fillStyle = '#927557'; c.fillRect(0, 0, 512, 512);

  for (let row = 0; row < 6; row++) {
    const y = row * rowH;
    const joint = [118, 354, 214, 420, 150, 326][row];
    const shade = plankPalette[row];
    c.fillStyle = shade; c.fillRect(2, y + 2, 508, rowH - 4);

    // Veios longos, muito suaves, para sugerir madeira sem criar ruído visual.
    for (let grain = 0; grain < 8; grain++) {
      const gy = y + 10 + grain * 9;
      c.strokeStyle = grain % 2 ? 'rgba(255,255,255,.13)' : 'rgba(105,78,48,.075)';
      c.lineWidth = grain % 3 === 0 ? 2 : 1;
      c.beginPath(); c.moveTo(8, gy);
      c.bezierCurveTo(135, gy - 3, 260, gy + 4, 504, gy - 1); c.stroke();
    }

    // Junta transversal alternada entre fileiras (paginação desencontrada).
    c.fillStyle = '#927557';
    c.fillRect(joint - 2, y + 2, 3, rowH - 4);
    c.fillStyle = 'rgba(255,255,255,.25)';
    c.fillRect(joint + 1, y + 4, 1, rowH - 8);
    c.strokeStyle = 'rgba(115,83,51,.12)';
    c.lineWidth = 1;
    c.strokeRect(3, y + 3, 505, rowH - 6);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 20);
  tex.anisotropy = 8;
  return tex;
}

/** Tela de recepção com mensagem institucional neutra e identidade visual da plataforma. */
function buildReceptionDisplay(): THREE.Group {
  const g = new THREE.Group();
  const graphite = std(0x202936, 0.38, 0.35);
  const orange = std(0xe96b2c, 0.42);
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#172536'; c.fillRect(0, 0, 640, 360);
  c.fillStyle = '#e96b2c'; c.fillRect(0, 0, 640, 16);
  c.fillStyle = '#edf2f7'; c.font = '700 48px "IBM Plex Sans", Arial';
  c.fillText('BEM-VINDO', 42, 112);
  c.fillStyle = '#c3cfdb'; c.font = '500 27px "IBM Plex Sans", Arial';
  c.fillText('ATENDIMENTO COMERCIAL', 44, 158);
  c.fillStyle = '#e96b2c'; c.fillRect(44, 195, 160, 8);
  c.fillStyle = '#c8d2dd'; c.font = '400 20px "IBM Plex Sans", Arial';
  c.fillText('VENDAS  •  ORÇAMENTOS  •  SOLUÇÕES', 44, 246);
  c.fillStyle = '#34485c'; c.fillRect(430, 82, 160, 210);
  [72, 122, 96, 154, 176].forEach((height, index) => {
    c.fillStyle = index === 3 ? '#e96b2c' : '#91a4b8';
    c.fillRect(450 + index * 25, 266 - height, 15, height);
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.35,
  });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.92, 1.72, 0.075), graphite);
  frame.position.y = 0.86; frame.castShadow = true; g.add(frame);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.78, 1.58), screen);
  panel.position.set(0, 0.86, 0.041); g.add(panel);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(2.78, 0.035, 0.012), orange);
  trim.position.set(0, 1.67, 0.045); g.add(trim);
  return g;
}

/** Plaquinha de texto. */
function labelBoard(txt: string): THREE.Mesh {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64; const c = cv.getContext('2d')!;
  c.clearRect(0, 0, 512, 64); c.fillStyle = '#1f2a44'; c.font = '700 42px "IBM Plex Sans", Arial';
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 256, 34);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(4.8, 0.64), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
}
interface SellerNameplate {
  sprite: THREE.Sprite;
  setName(name: string): void;
}
function buildSellerNameplate(): SellerNameplate {
  const cv = document.createElement('canvas'); cv.width = 440; cv.height = 76;
  const c = cv.getContext('2d')!;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.52, 0.26, 1);
  sprite.renderOrder = 12;
  const setName = (name: string) => {
    c.clearRect(0, 0, cv.width, cv.height);
    if (!name) { sprite.visible = false; tex.needsUpdate = true; return; }
    c.fillStyle = 'rgba(25,39,56,0.96)';
    c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#e96b2c'; c.fillRect(0, 0, 9, cv.height);
    c.fillStyle = '#f7f9fc'; c.font = '650 31px "IBM Plex Sans", Arial';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(name.toLocaleUpperCase('pt-BR'), 228, 39, 398);
    sprite.visible = true; tex.needsUpdate = true;
  };
  sprite.visible = false;
  return { sprite, setName };
}
/** Troca apenas o visual interno de um móvel, preservando seu root, posição e ID editável. */
function replaceOfficeVisual(root: THREE.Group, key: IndustrialAssetKey, scale: [number, number, number] = [1, 1, 1]) {
  void loadIndustrialAsset(key).then(({ scene }) => {
    if (!root.parent) return;
    scene.scale.set(scale[0], scale[1], scale[2]);
    // Os GLBs de cadeira usam +Z como lado do usuário; o posto de trabalho
    // deste escritório posiciona o usuário olhando para -Z. Corrige no próprio asset.
    if (key === 'officeTaskChair') scene.rotation.y = Math.PI;
    root.clear();
    root.add(scene);
  }).catch((error) => {
    // O mobiliário procedural permanece visível se a CDN estiver indisponível.
    console.warn(`Não foi possível carregar o móvel GLB ${key}; mantendo o modelo local.`, error);
  });
}

const SHIRTS = [0xe96b2c, 0x394454, 0x7c8591, 0x394454, 0xe96b2c, 0x7c8591, 0x394454, 0xe96b2c, 0x7c8591, 0x394454];
const SKINS  = [0xf1c9a5, 0xd9a37a, 0xa8714a, 0x7a4b2e];

function dashboardTexture() {
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 100; const g = cv.getContext('2d')!;
  g.fillStyle = '#f4f7fc'; g.fillRect(0, 0, 160, 100); g.fillStyle = '#1f2a44'; g.fillRect(0, 0, 160, 12);
  [38, 62, 48, 80, 58, 72].forEach((h, i) => { g.fillStyle = i % 2 ? '#394454' : '#e96b2c'; g.fillRect(12 + i * 14, 92 - h, 9, h); });
  g.strokeStyle = '#394454'; g.lineWidth = 2; g.beginPath(); g.moveTo(104, 70); [[116, 56], [128, 62], [140, 40], [152, 46]].forEach(([x, y]) => g.lineTo(x, y)); g.stroke();
  g.fillStyle = '#cbd5e6'; for (let i = 0; i < 4; i++) g.fillRect(104, 24 + i * 7, 48, 3);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Textura de catálogo de produtos para a TV do showroom. */
function meetingRoomTexture() {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d')!;
  g.fillStyle = '#202a36'; g.fillRect(0, 0, 640, 360);
  g.fillStyle = '#e96b2c'; g.fillRect(0, 0, 640, 20);
  g.fillStyle = '#f7f9fc'; g.font = 'bold 30px Arial'; g.fillText('SALA DE REUNIÃO', 34, 76);
  g.fillStyle = '#aeb8c4'; g.font = '18px Arial'; g.fillText('PAUTA  •  PROJETOS  •  RESULTADOS', 36, 111);
  g.fillStyle = '#303b49'; g.fillRect(34, 150, 572, 166);
  g.fillStyle = '#e96b2c'; g.fillRect(56, 177, 160, 10);
  g.fillStyle = '#dfe3e8'; g.fillRect(56, 205, 260, 7); g.fillRect(56, 226, 215, 7); g.fillRect(56, 247, 295, 7);
  [44, 74, 58, 102, 126, 88].forEach((h, i) => { g.fillStyle = i === 4 ? '#e96b2c' : '#8994a2'; g.fillRect(390 + i * 28, 286 - h, 17, h); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Balcão de autoatendimento com café, água e copos para visitantes e equipe. */
function buildCoffeeStation(): THREE.Group {
  const g = new THREE.Group();
  const white = std(0xe8edf2, 0.58), graphite = std(0x303b49, 0.45, 0.22), metal = std(0x8d98a3, 0.35, 0.58), orange = std(0xe96b2c, 0.42), glass = std(0x9bb7c5, 0.22, 0.12);
  g.add(b(3.35, 0.88, 0.76, white, 0, 0, 0), b(3.46, 0.08, 0.84, graphite, 0, 0.88, 0));
  g.add(b(3.1, 0.11, 0.035, orange, 0, 0.48, 0.39));
  for (const x of [-1.45, 1.45]) g.add(b(0.035, 0.72, 0.035, metal, x, 0.08, -0.25));
  // Máquina de espresso dupla com painel e bicos metálicos.
  g.add(b(0.82, 0.56, 0.48, graphite, -0.83, 0.96, -0.03), b(0.72, 0.08, 0.42, metal, -0.83, 1.52, -0.03));
  g.add(b(0.28, 0.18, 0.025, glass, -0.83, 1.2, 0.22), b(0.12, 0.045, 0.035, orange, -0.83, 1.42, 0.23));
  for (const x of [-1.03, -0.63]) g.add(cyl(0.035, 0.18, metal, x, 1.02, 0.23, 10), cyl(0.07, 0.06, white, x, 1.0, 0.23, 12));
  // Moedor, bandeja e copos.
  g.add(b(0.38, 0.42, 0.38, metal, 0.05, 0.96, -0.02), cyl(0.13, 0.22, glass, 0.24, 1.38, -0.02, 14));
  g.add(cyl(0.16, 0.24, graphite, 0.95, 0.96, -0.02, 16), b(0.34, 0.12, 0.34, metal, 0.95, 1.2, -0.02));
  g.add(b(0.9, 0.035, 0.42, metal, 0.92, 0.98, 0.18));
  for (let i = 0; i < 4; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.13, 12), white);
    cup.position.set(0.62 + (i % 2) * 0.2, 1.08 + Math.floor(i / 2) * 0.01, 0.18 + Math.floor(i / 2) * 0.08); cup.castShadow = true; g.add(cup);
  }
  const sign = labelBoard('CAFÉ  •  ÁGUA'); sign.scale.setScalar(0.42); sign.position.set(0, 1.72, -0.385); g.add(sign);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Mesa executiva de reunião com calha central para energia e conectividade. */
function buildConferenceTable(): THREE.Group {
  const g = new THREE.Group();
  const top = std(0xdfe4e9, 0.48), graphite = std(0x303b49, 0.42, 0.25), metal = std(0x818c97, 0.38, 0.55), orange = std(0xe96b2c, 0.42);
  g.add(b(4.75, 0.14, 1.5, top, 0, 0.78, 0), b(4.45, 0.025, 0.12, orange, 0, 0.92, 0));
  g.add(b(4.3, 0.08, 1.24, graphite, 0, 0.18, 0));
  for (const x of [-1.92, 1.92]) g.add(b(0.18, 0.76, 1.0, metal, x, 0, 0), b(0.34, 0.06, 1.18, graphite, x, 0, 0));
  for (const x of [-1.3, 0, 1.3]) g.add(b(0.34, 0.025, 0.16, graphite, x, 0.93, 0), b(0.08, 0.012, 0.025, orange, x, 0.955, 0));
  return g;
}

/** Cadeira estofada de reunião com braços e base metálica. */
function buildMeetingChair(): THREE.Group {
  const g = new THREE.Group();
  const fabric = std(0x394454, 0.82), seam = std(0x687583, 0.78), metal = std(0x303b49, 0.42, 0.5), orange = std(0xe96b2c, 0.5);
  g.add(b(0.62, 0.14, 0.62, fabric, 0, 0.46, 0), b(0.62, 0.68, 0.13, fabric, 0, 0.78, -0.25), b(0.48, 0.035, 0.025, seam, 0, 1.13, -0.18));
  for (const x of [-0.38, 0.38]) g.add(b(0.07, 0.42, 0.07, metal, x, 0.52, -0.02), b(0.07, 0.08, 0.56, metal, x, 0.88, 0.02));
  g.add(cyl(0.075, 0.42, metal, 0, 0.04, 0, 12));
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spoke = b(0.42, 0.055, 0.07, metal, Math.cos(angle) * 0.2, 0, Math.sin(angle) * 0.2); spoke.rotation.y = -angle; g.add(spoke);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.045, 10), metal); wheel.rotation.z = Math.PI / 2; wheel.position.set(Math.cos(angle) * 0.42, 0.055, Math.sin(angle) * 0.42); g.add(wheel);
  }
  g.add(b(0.035, 0.035, 0.035, orange, 0, 0.57, 0.31));
  return g;
}

/** Tela plana para a sala de reunião, montada diretamente na parede (sem suporte de TV). */
function buildMeetingDisplay(): THREE.Group {
  const g = new THREE.Group();
  const graphite = std(0x202936, 0.38, 0.35), orange = std(0xe96b2c, 0.42),
    screen = new THREE.MeshStandardMaterial({ map: meetingRoomTexture(), emissiveMap: meetingRoomTexture(), emissive: 0xffffff, emissiveIntensity: 0.62, roughness: 0.35 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.62, 1.46, 0.075), graphite);
  frame.position.y = 0.73; frame.castShadow = true; frame.receiveShadow = true; g.add(frame);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.34), screen);
  panel.position.set(0, 0.73, 0.041); g.add(panel);
  const accent = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.035, 0.012), orange);
  accent.position.set(0, 1.42, 0.044); g.add(accent);
  // Quatro fixadores curtos mantêm a tela paralela à parede, sem braço articulado visível.
  for (const x of [-1.02, 1.02]) for (const y of [0.18, 1.28]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.045), graphite);
    bracket.position.set(x, y, -0.055); g.add(bracket);
  }
  return g;
}

interface Seat { arms: THREE.Group[]; head: THREE.Mesh; screen: THREE.MeshStandardMaterial | null; ph: number }

type ErrandKind = 'counter' | 'water' | 'printer';
interface Walker {
  sit: THREE.Group; stand: THREE.Group;
  legs: THREE.Group[]; sArms: THREE.Group[]; sHead: THREE.Mesh;
  home: THREE.Vector2; dest: THREE.Vector2; destAng: number; kind: ErrandKind;
  /** caminho poligonal home → (waypoints) → dest (ida); a volta percorre o mesmo caminho ao contrário */
  path: THREE.Vector2[];
  period: number; phase: number; walkOut: number; interact: number; walkBack: number;
}

/** Figura de pé (reaproveitada para o vendedor quando ele se levanta e anda). */
function standingPerson(seed: number) {
  const g = new THREE.Group();
  const shirt = std(SHIRTS[seed % SHIRTS.length], 0.7), skin = std(SKINS[(seed * 3 + 1) % SKINS.length], 0.8), pants = std(0x2b3550, 0.8), shoe = std(0x1a2236, 0.6);
  const legs = [-0.1, 0.1].map((x) => { const l = new THREE.Group(); l.position.set(x, 0.5, 0); l.add(b(0.14, 0.5, 0.15, pants, 0, -0.25, 0), b(0.16, 0.1, 0.24, shoe, 0, -0.52, 0.03)); g.add(l); return l; });
  g.add(b(0.42, 0.56, 0.26, shirt, 0, 0.66, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), skin); head.position.set(0, 1.31, 0);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), std(seed % 3 ? 0x2a1f1a : 0x7a5a3a, 0.9)); hair.position.y = 0.02; head.add(hair);
  g.add(head, b(0.09, 0.08, 0.09, skin, 0, 1.16, 0));
  const arms = [-0.26, 0.26].map((x) => { const a = new THREE.Group(); a.position.set(x, 0.9, 0); a.add(b(0.09, 0.44, 0.11, shirt, 0, -0.2, 0), b(0.08, 0.1, 0.09, skin, 0, -0.42, 0)); g.add(a); return a; });
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, legs, arms, head };
}

/** Figura sentada "solta" — sem cadeira própria embutida, usada por quem se senta em
 *  mobília já existente (sofá, poltronas de espera). Origem local = topo do assento. */
function seatedVisitor(seed: number) {
  const g = new THREE.Group();
  const shirt = std(SHIRTS[(seed * 5 + 2) % SHIRTS.length], 0.7), skin = std(SKINS[(seed * 2 + 3) % SKINS.length], 0.8),
        pants = std(0x384258, 0.8), shoe = std(0x1a2236, 0.6);
  for (const x of [-0.12, 0.12]) {
    g.add(b(0.16, 0.16, 0.46, pants, x, 0.18, 0.16));    // coxa (horizontal, sentado)
    g.add(b(0.14, 0.34, 0.14, pants, x, -0.16, -0.06));  // canela (vertical)
    g.add(b(0.16, 0.08, 0.22, shoe, x, -0.5, 0.0));
  }
  g.add(b(0.44, 0.5, 0.26, shirt, 0, 0.3, -0.06));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 16), skin); head.position.set(0, 0.95, -0.1);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), std(seed % 2 ? 0x2a1f1a : 0x7a5a3a, 0.9)); hair.position.y = 0.02; head.add(hair);
  g.add(head, b(0.08, 0.1, 0.08, skin, 0, 0.78, -0.08));
  const arms = [-0.25, 0.25].map((x) => {
    const a = new THREE.Group(); a.position.set(x, 0.62, -0.06);
    a.add(b(0.09, 0.3, 0.1, shirt, 0, -0.1, -0.02), b(0.08, 0.1, 0.09, skin, 0, -0.26, -0.14));
    g.add(a); return a;
  });
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, arms, head };
}

/** Interpola um ponto ao longo de um caminho poligonal (waypoints), f ∈ [0,1]. */
function pathLerp(pts: THREE.Vector2[], f: number): THREE.Vector2 {
  const segs = pts.length - 1; const tot = Math.max(0, Math.min(1, f)) * segs;
  const i = Math.max(0, Math.min(segs - 1, Math.floor(tot))); const lf = tot - i;
  return pts[i].clone().lerp(pts[i + 1], lf);
}
/** Ângulo de direção (convenção ang = atan2(dx,dz)) do trecho do caminho em f ∈ [0,1]. */
function pathAngle(pts: THREE.Vector2[], f: number): number {
  const segs = pts.length - 1; const tot = Math.max(0, Math.min(1, f)) * segs;
  const i = Math.max(0, Math.min(segs - 1, Math.floor(tot)));
  const d = pts[i + 1].clone().sub(pts[i]); return Math.atan2(d.x, d.y);
}
/** Comprimento total de um caminho poligonal. */
function pathLen(pts: THREE.Vector2[]): number {
  let d = 0; for (let i = 0; i < pts.length - 1; i++) d += pts[i].distanceTo(pts[i + 1]); return d;
}

/** Transeunte ambiente que cruza o escritório inteiro (as 3 salas, pelas aberturas das
 *  divisórias) em vaivém contínuo — só para dar movimento/vida ao espaço comercial. */
interface Stroller {
  group: THREE.Group; legs: THREE.Group[]; arms: THREE.Group[];
  a: THREE.Vector2; b: THREE.Vector2; speed: number; phase: number;
}
/** Visitante que entra, senta numa poltrona/sofá por um tempo, e volta a sair — em loop. */
interface Lounger {
  stand: THREE.Group; legs: THREE.Group[]; sArms: THREE.Group[];
  sit: THREE.Group; sitArms: THREE.Group[]; sitHead: THREE.Mesh;
  path: THREE.Vector2[]; seat: THREE.Vector2; seatY: number; seatAng: number;
  period: number; phase: number; walkIn: number; sitDur: number; walkOut: number;
}

/* ═══════════════════════════════════════════════════════════════════════
   ESCRITÓRIO COMERCIAL — 3 salas (layout de referência 43.5 × 19.0)
   Local (0,0) = centro do escritório, posicionado em (27.25, 0, 20.5) no mundo.
   ◦ Sala 1 (Recepção):  x -21.75 a -7.75  (largura 14)
   ◦ Sala 2 (Backoffice): x -7.75  a +8.25  (largura 16)
   ◦ Sala 3 (Showroom):   x +8.25  a +21.75 (largura 13.5)
   ═══════════════════════════════════════════════════════════════════════ */
export function buildOffice() {
  const group = new THREE.Group(); const seats: Seat[] = []; const sellers: THREE.Group[] = []; const walkers: Walker[] = [];
  const sellerNameplates: SellerNameplate[] = [];
  const strollers: Stroller[] = []; const loungers: Lounger[] = [];
  const editables: { id: string; object: THREE.Object3D }[] = [];
  const ed = (id: string, object: THREE.Object3D) => editables.push({ id: `office-${id}`, object });
  const tex = dashboardTexture(), white = std(0xf7f9fd, 0.5), dark = std(0x2b3550, 0.5, 0.3),
        gray = std(0x9aa1aa, 0.5, 0.4), chair = std(0x394454, 0.7);

  const OW = 43.5, OD = 19.0;

  // Base estrutural com acabamento vinílico amadeirado claro.
  group.add(b(OW, 0.12, OD, std(0x9b8a76, 0.95), 0, 0, 0));
  const floorSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(OW, OD),
    new THREE.MeshStandardMaterial({ map: woodFloorTexture(), roughness: 0.84, metalness: 0 }),
  );
  floorSurface.rotation.x = -Math.PI / 2;
  floorSurface.position.y = 0.124;
  floorSurface.receiveShadow = true;
  group.add(floorSurface);

  // ── vidros e paredes ──────────────────────────────────────────
  const glassW = new THREE.MeshStandardMaterial({ color: 0xcbd0d6, transparent: true, opacity: 0.38, depthWrite: false });
  const solidW = std(0xe2e8f0, 0.7);
  const aluFrame = std(0x18181b, 0.35, 0.65);

  const WH = 4.0; // altura das paredes do escritório
  // parede traseira sólida (z = -9.5)
  group.add(b(OW, WH, 0.15, solidW, 0, 0.12, -OD / 2));
  // parede frontal de vidro (z = +9.5)
  group.add(b(OW, WH, 0.06, glassW, 0, 0.12, OD / 2));
  // montantes de alumínio na frente
  for (let x = -21.75; x <= 21.75; x += 7) {
    group.add(b(0.12, WH, 0.08, aluFrame, x, 0.12, OD / 2));
  }
  // parede esquerda (x = -21.75) com abertura de porta em z ≈ -4.5
  group.add(b(0.15, WH, 4.5, solidW, -OW / 2, 0.12, -7.25));  // trecho superior
  group.add(b(0.15, 0.6, 3.2, aluFrame, -OW / 2, 3.52, -4.5));  // verga da porta
  group.add(b(0.06, WH, 11.5, glassW, -OW / 2, 0.12, 3.75));   // vidro lateral inferior
  // parede direita de vidro (x = +21.75)
  group.add(b(0.06, WH, OD, glassW, OW / 2, 0.12, 0));

  // ── divisórias internas (x = -7.75 e x = +8.25) ──────────────
  for (const dx of [-7.75, 8.25]) {
    group.add(b(0.12, WH, 4.5, solidW, dx, 0.12, -7.25));   // trecho atrás
    group.add(b(0.12, 0.6, 3.2, aluFrame, dx, 3.52, -4.5));  // verga de porta
    group.add(b(0.06, WH, 11.5, glassW, dx, 0.12, 3.75));   // vidro p/ frente
  }

  // faixa-logo da marca no topo da parede traseira
  group.add(b(OW, 0.55, 0.09, std(0xf26a1b, 0.6), 0, 3.62, -OD / 2 + 0.06));
  // rótulo COMERCIAL
  const lbl = labelBoard('COMERCIAL'); lbl.scale.set(0.5, 0.5, 1); lbl.position.set(0, 3.42, -OD / 2 + 0.12); group.add(lbl);

  // Entrada principal: portal metálico, cobertura e identificação de recepção.
  const portalMetal = std(0x303b49, 0.38, 0.5), portalOrange = std(0xe96b2c, 0.42, 0.25);
  group.add(
    b(0.16, 3.35, 0.16, portalMetal, -21.48, 0.12, -5.08),
    b(0.16, 3.35, 0.16, portalMetal, -21.48, 0.12, -1.92),
    b(0.16, 0.18, 3.32, portalOrange, -21.48, 3.29, -3.5),
    b(1.35, 0.13, 4.25, portalMetal, -22.18, 3.02, -3.5),
    b(0.08, 0.07, 4.25, portalOrange, -22.18, 2.94, -3.5),
  );
  const entranceSign = labelBoard('RECEPÇÃO');
  entranceSign.scale.set(0.52, 0.52, 1);
  entranceSign.position.set(-21.55, 3.58, -3.5);
  entranceSign.rotation.y = -Math.PI / 2;
  group.add(entranceSign);

  // Caminho visual da porta até o balcão; mantém livre a faixa de circulação.
  const entryPath = std(0xe9edf1, 0.96), entryLine = std(0xe96b2c, 0.58);
  group.add(
    b(5.45, 0.025, 1.55, entryPath, -18.55, 0.12, -3.5),
    b(5.45, 0.018, 0.045, entryLine, -18.55, 0.15, -4.26),
    b(5.45, 0.018, 0.045, entryLine, -18.55, 0.15, -2.74),
    b(2.1, 0.035, 1.45, std(0x303b49, 0.9), -20.8, 0.15, -3.5),
  );

  // teto removido — bloqueava a visão de cima (overview)

  // Tapetes delimitam somente áreas de permanência, deixando o piso amadeirado visível.
  group.add(
    b(7.3, 0.018, 7.1, std(0xd8cdbd, 0.98), -17.25, 0.12, 5.0),
    b(8.8, 0.022, 4.7, std(0xcfc4b3, 0.98), -1.45, 0.12, 6.85),
    b(11.8, 0.018, 8.7, std(0xd8dce0, 0.98), 15, 0.12, 0),
  );

  // Plantas com folhagem verde em todos os setores; a posição da recepção fica livre para o café.
  group.add(plant(20.5, -8.5), plant(-20.5, 8.5), plant(20.5, 8.5));
  group.add(plant(-7, 8), plant(8, 8));
  // plantas extras p/ preencher cantos vazios do backoffice e do showroom
  group.add(plant(2, -6), plant(16.5, 6));

  // ── SALA 1 — Recepção (x -21.75 a -7.75) ─────────────────────
  // Balcão de atendimento — encostado no fundo da sala, FORA do corredor z∈(-5,-2) que liga a
  // porta de entrada (parede esquerda) à porta da divisória. Clientes ficam do lado +z (frente
  // do balcão), os 2 vendedores ficam atrás dele (lado da parede), lado a lado.
  const counter = new THREE.Group(); counter.add(buildCounter(5.5));
  counter.position.set(-14.75, 0.12, -6.45); group.add(counter); ed('counter-reception', counter);
  replaceOfficeVisual(counter, 'curvedReceptionDesk');
  const serviceSign = labelBoard('ATENDIMENTO COMERCIAL');
  serviceSign.scale.set(0.44, 0.44, 1);
  serviceSign.position.set(-14.75, 2.75, -9.36);
  group.add(serviceSign);
  // armário de arquivos
  const cabR = buildCabinet(0.9, 1.7, 0.5); cabR.position.set(-9.6, 0.12, -8.9); group.add(cabR); ed('cabinet-reception', cabR);
  // sofá + mesinha + 2 cadeiras — área de espera no canto frontal
  const sofa = new THREE.Group(); sofa.add(buildSofa(1.9, 0x394454));
  sofa.position.set(-18.6, 0.12, 4.6); sofa.rotation.y = Math.PI / 2; group.add(sofa); ed('sofa', sofa);
  replaceOfficeVisual(sofa, 'officeSofa');
  const table = buildCoffeeTable(); table.position.set(-17.0, 0.12, 4.6); group.add(table); ed('coffee-table', table);
  const wc1 = new THREE.Group(); wc1.add(buildWaitChair(0x394454));
  wc1.position.set(-15.6, 0.12, 2.9); wc1.rotation.y = -Math.PI / 2; group.add(wc1); ed('waitchair-1', wc1);
  replaceOfficeVisual(wc1, 'officeLoungeChair');
  const wc2 = new THREE.Group(); wc2.add(buildWaitChair(0x394454));
  wc2.position.set(-15.6, 0.12, 6.3); wc2.rotation.y = -Math.PI / 2; group.add(wc2); ed('waitchair-2', wc2);
  replaceOfficeVisual(wc2, 'officeLoungeChair');
  // Tela informativa montada na divisória interna, voltada para a recepção.
  const receptionDisplay = buildReceptionDisplay();
  receptionDisplay.position.set(-7.83, 1.72, -7.2);
  receptionDisplay.rotation.y = -Math.PI / 2;
  group.add(receptionDisplay); ed('reception-display', receptionDisplay);

  // ── SALA 2 — Backoffice (x -7.75 a +8.25) ────────────────────
  // 3 impressoras na parede do fundo
  for (let i = 0; i < 3; i++) {
    const pr = buildPrinter(); pr.scale.setScalar(0.9); pr.position.set(-5 + i * 1.5, 0.12, -8.8); group.add(pr); ed(`printer-backoffice-${i}`, pr);
  }
  // bebedouro
  const water = buildWaterCooler(); water.scale.setScalar(0.9); water.position.set(7, 0.12, -8.5); group.add(water); ed('watercooler', water);
  // rack de servidor (canto, perto da divisória) com LEDs piscantes
  const server = buildServerRack(); server.group.position.set(-7.1, 0.12, -8.75); group.add(server.group); ed('server-rack', server.group);
  // armários de arquivos
  const cabB1 = buildCabinet(0.9, 1.7, 0.5); cabB1.position.set(1, 0.12, -8.9); group.add(cabB1); ed('cabinet-backoffice-1', cabB1);
  const cabB2 = buildCabinet(0.9, 1.7, 0.5); cabB2.position.set(2.9, 0.12, -8.9); group.add(cabB2); ed('cabinet-backoffice-2', cabB2);
  // COPA E DESCANSO — substitui as cadeiras soltas por um lounge e uma estação de café.
  const loungeSofa = new THREE.Group();
  loungeSofa.add(buildSofa(2.35, 0x52677d));
  loungeSofa.position.set(-2.0, 0.14, 5.65);
  group.add(loungeSofa); ed('break-sofa', loungeSofa);
  replaceOfficeVisual(loungeSofa, 'officeSofa', [1.28, 1.0, 1.0]);

  const loungeTable = buildCoffeeTable();
  loungeTable.scale.set(1.45, 1, 1.35);
  loungeTable.position.set(-2.0, 0.14, 7.0);
  group.add(loungeTable); ed('break-table', loungeTable);

  const loungeChairA = new THREE.Group(); loungeChairA.add(buildWaitChair(0x52677d));
  loungeChairA.position.set(-4.65, 0.14, 7.05); loungeChairA.rotation.y = -Math.PI / 2;
  group.add(loungeChairA); ed('break-chair-a', loungeChairA);
  replaceOfficeVisual(loungeChairA, 'officeLoungeChair');
  const loungeChairB = new THREE.Group(); loungeChairB.add(buildWaitChair(0x52677d));
  loungeChairB.position.set(0.65, 0.14, 7.05); loungeChairB.rotation.y = Math.PI / 2;
  group.add(loungeChairB); ed('break-chair-b', loungeChairB);
  replaceOfficeVisual(loungeChairB, 'officeLoungeChair');

  const coffee = buildCoffeeStation();
  coffee.position.set(6.45, 0.14, 6.45);
  coffee.rotation.y = -Math.PI / 2;
  group.add(coffee); ed('coffee-station', coffee);
  const breakSign = labelBoard('COPA  •  DESCANSO');
  breakSign.scale.set(0.43, 0.43, 1);
  breakSign.position.set(6.45, 2.65, 9.36);
  breakSign.rotation.y = Math.PI;
  group.add(breakSign);

  // ── SALA 3 — Sala de reunião (x +8.25 a +21.75) ──────────────
  // Tela fixada na parede externa do fundo; a abertura da porta da divisória permanece livre.
  const meetingScreen = buildMeetingDisplay();
  meetingScreen.position.set(15, 1.93, -9.38); group.add(meetingScreen); ed('meeting-screen', meetingScreen);
  const conference = buildConferenceTable(); conference.position.set(15, 0.12, 0); group.add(conference); ed('conference-table', conference);
  // Seis cadeiras livres; duas posições são ocupadas pelos vendedores que participam da reunião.
  const meetingChairSpots: [number, number, number][] = [
    // Duas cadeiras por lateral, alinhadas e voltadas para o centro da mesa.
    [13.35, 1.78, Math.PI], [16.65, 1.78, Math.PI],
    [13.35, -1.78, 0], [16.65, -1.78, 0],
    // Uma cadeira em cada cabeceira, voltada para o eixo longo da mesa.
    [12.05, 0, Math.PI / 2], [17.95, 0, -Math.PI / 2],
  ];
  meetingChairSpots.forEach(([x, z, rotation], i) => {
    const seat = new THREE.Group(); seat.add(buildMeetingChair());
    seat.position.set(x, 0.12, z); seat.rotation.y = rotation; group.add(seat); ed(`meeting-chair-${i + 1}`, seat);
  });
  const meetingCredenza = buildCabinet(1.5, 0.92, 0.48, 0x303b49);
  meetingCredenza.position.set(10.2, 0.12, -8.72); group.add(meetingCredenza); ed('meeting-credenza', meetingCredenza);

  // ── VENDEDORES — 10 estações distribuídas nas 3 salas ─────────
  // Sala 1: 2 estações (recepção)
  // Sala 2: 6 estações (backoffice, 2 fileiras × 3 colunas)
  // Sala 3: 2 participantes sentados à mesa de reunião, sem estações individuais.
  // Cada participante fica voltado para o centro da mesa.
  const positions: [number, number, number?][] = [
    // Sala 1 — Recepção: lado a lado, atrás do balcão
    [-16.3, -8.0, Math.PI], [-13.2, -8.0, Math.PI],
    // Sala 2 — Backoffice (2 fileiras × 3 colunas)
    [-4.2, -3.5], [-4.2, 1.5], [0, -3.5], [0, 1.5], [4.3, -3.5], [4.3, 1.5],
    // Dois participantes da reunião, posicionados nas laterais longas da mesa.
    [15, 1.78, 0], [15, -1.78, Math.PI],
  ];
  // Rotina de cada vendedor: para onde ele caminha periodicamente (sempre dentro da própria
  // sala — nunca atravessa divisórias, evitando qualquer colisão com paredes/objetos).
  const errands: { kind: ErrandKind; dest: [number, number]; ang: number; via?: [number, number][] }[] = [
    // 0/1 recepção → atrás do balcão: saem de trás da mesa pelo vão entre as duas mesas (x≈-14.75)
    // e só então avançam até o balcão, sem atravessar a mesa
    { kind: 'counter', dest: [-15.05, -7.2], ang: 0, via: [[-15.05, -8.95]] },
    { kind: 'counter', dest: [-14.45, -7.2], ang: 0, via: [[-14.45, -8.95]] },
    { kind: 'printer', dest: [-5, -7.9], ang: Math.PI },        // 2  backoffice → impressora 1
    { kind: 'water',   dest: [7.3, -7.7], ang: Math.PI },       // 3  backoffice → bebedouro
    { kind: 'printer', dest: [-3.5, -7.9], ang: Math.PI },      // 4  backoffice → impressora 2
    { kind: 'water',   dest: [6.7, -7.7], ang: Math.PI },       // 5  backoffice → bebedouro
    { kind: 'printer', dest: [-2, -7.9], ang: Math.PI },        // 6  backoffice → impressora 3
    { kind: 'water',   dest: [7, -7.3], ang: Math.PI },         // 7  backoffice → bebedouro
    { kind: 'counter', dest: [13, -1.7], ang: 0 },              // 8  showroom → balcão (cliente)
    { kind: 'printer', dest: [20, -7.9], ang: Math.PI },        // 9  showroom → impressora
  ];
  let n = 0;
  for (const [px, pz, rot = 0] of positions) {
    const sx = n >= 8 ? px : px + 0.95 * Math.sin(rot);
    const sz = n >= 8 ? pz : pz + 0.95 * Math.cos(rot);
    const s = new THREE.Group();
    let screen: THREE.MeshStandardMaterial | null = null;
    if (n < 8) {
      s.position.set(px, 0.12, pz); s.rotation.y = rot;
      const deskVisual = new THREE.Group();
      deskVisual.add(b(1.7, 0.06, 0.85, white, 0, 0.75, 0));
      for (const [lx, lz] of [[-0.8, -0.38], [0.8, -0.38], [-0.8, 0.38], [0.8, 0.38]]) deskVisual.add(b(0.06, 0.75, 0.06, gray, lx, 0, lz));
      s.add(deskVisual); replaceOfficeVisual(deskVisual, 'officeDesk');
      // Monitores preservam as texturas dos dashboards.
      s.add(b(0.12, 0.22, 0.1, dark, 0, 0.81, -0.15), b(0.66, 0.4, 0.04, dark, 0, 1.0, -0.15));
      screen = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.7 });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.34), screen); pl.position.set(0, 1.2, -0.128); pl.rotation.y = Math.PI; s.add(pl);
      s.add(b(0.5, 0.03, 0.18, gray, 0, 0.81, 0.2), b(0.08, 0.03, 0.12, dark, 0.45, 0.81, 0.2));
      const chairRoot = new THREE.Group(); chairRoot.position.set(sx, 0.12, sz); chairRoot.rotation.y = rot;
      const fallbackChair = new THREE.Group();
      fallbackChair.add(b(0.58, 0.07, 0.55, chair, 0, 0.5, 0.05), b(0.58, 0.62, 0.07, chair, 0, 0.55, 0.33), b(0.08, 0.5, 0.08, dark, 0, 0, 0.05), b(0.6, 0.05, 0.06, dark, 0, 0, 0.05), b(0.06, 0.05, 0.6, dark, 0, 0, 0.05));
      chairRoot.add(fallbackChair); group.add(chairRoot); ed(`chair-${n}`, chairRoot);
      replaceOfficeVisual(chairRoot, 'officeTaskChair');
    } else {
      // Vendedores 9 e 10 participam das reuniões, sem mesas individuais.
      // A cadeira tem encosto no sentido oposto ao corpo sentado.
      s.position.set(sx, 0.12, sz); s.rotation.y = rot + Math.PI; s.add(buildMeetingChair());
    }
    const nameplate = buildSellerNameplate();
    nameplate.sprite.position.set(0, n < 8 ? 1.58 : 2.05, n < 8 ? 0.48 : 0.55);
    s.add(nameplate.sprite);
    sellerNameplates.push(nameplate);
    group.add(s); sellers.push(s); ed(n < 8 ? `desk-${n}` : `meeting-attendee-${n}`, s);
    const sit = new THREE.Group(); sit.position.set(sx, 0.12, sz); sit.rotation.y = rot;
    const shirt = std(SHIRTS[n % SHIRTS.length], 0.7), skin = std(SKINS[(n * 3 + 1) % SKINS.length], 0.8), pants = std(0x2b3550, 0.8);
    for (const x of [-0.12, 0.12]) sit.add(b(0.16, 0.16, 0.5, pants, x, 0.57, -0.22), b(0.14, 0.52, 0.14, pants, x, 0.02, -0.47));
    sit.add(b(0.44, 0.62, 0.27, shirt, 0, 0.68, 0.02));
    const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), skin); sHead.position.set(0, 1.5, -0.02);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), std(n % 3 ? 0x2a1f1a : 0x7a5a3a, 0.9)); hair.position.y = 0.015; hair.rotation.x = -0.25; sHead.add(hair);
    sit.add(sHead, b(0.08, 0.1, 0.08, skin, 0, 1.3, 0));
    const sArms: THREE.Group[] = [-1, 1].map((sx) => {
      const a = new THREE.Group(); a.position.set(sx * 0.27, 1.22, 0); a.add(b(0.1, 0.1, 0.6, shirt, 0, -0.1, -0.3), b(0.08, 0.08, 0.1, skin, 0, -0.09, -0.65)); sit.add(a); return a;
    });
    group.add(sit);

    // vendedor de pé (figura usada quando ele sai da mesa)
    const standP = standingPerson(n);
    standP.group.position.set(sx, 0.12, sz); standP.group.visible = false;
    group.add(standP.group);

    seats.push({ arms: sArms, head: sHead, screen, ph: n * 1.7 });

    // Os oito vendedores das áreas operacionais fazem trajetos de atendimento.
    // Os dois participantes da sala de reunião permanecem sentados e selecionáveis.
    if (n < 8) {
      const e = errands[n];
      const home = new THREE.Vector2(sx, sz);
      const dest = new THREE.Vector2(e.dest[0], e.dest[1]);
      const path = [home, ...(e.via ?? []).map(([x, z]) => new THREE.Vector2(x, z)), dest];
      const walkDur = Math.max(1.6, pathLen(path) / 1.3);
      walkers.push({
        sit, stand: standP.group, legs: standP.legs, sArms: standP.arms, sHead: standP.head,
        home, dest, destAng: e.ang, kind: e.kind, path,
        period: 24 + (n * 7 % 23), phase: n * 3.1,
        walkOut: walkDur, interact: e.kind === 'counter' ? 5 : 3.5, walkBack: walkDur,
      });
    }
    n++;
  }

  // ── TRANSEUNTES — pessoas andando pelo comercial inteiro (vaivém pelas 3 salas) ──
  // Cruzam exatamente pela faixa z≈-4.5, que é onde ficam as aberturas das divisórias
  // (verga das portas) e a abertura da parede esquerda — corredor livre, sem móveis.
  const strollA = new THREE.Vector2(-20, -4.5), strollB = new THREE.Vector2(19.5, -4.5);
  [
    { seed: 31, speed: 1.05, phase: 0 },
    { seed: 46, speed: 1.3, phase: 24 },
  ].forEach(({ seed, speed, phase }) => {
    const p = standingPerson(seed);
    p.group.position.set(strollA.x, 0.12, strollA.y);
    group.add(p.group);
    strollers.push({ group: p.group, legs: p.legs, arms: p.arms, a: strollA, b: strollB, speed, phase });
  });

  // ── VISITANTES DE SOFÁ — entram, sentam na área de espera, saem (loop) ───────────
  // Entrada próxima da porta da recepção; caminho em 1-2 trechos escolhido para nunca
  // passar por cima das estações dos vendedores da recepção (x=-18).
  const loungeDefs: { seed: number; path: [number, number][]; seat: [number, number]; seatY: number; seatAng: number; period: number; phase: number; sitDur: number }[] = [
    // senta no sofá — caminho direto, nunca cruza x=-18 (fica à esquerda dele o tempo todo)
    { seed: 52, path: [[-20.5, -3.0], [-18.6, 4.6]], seat: [-18.6, 4.6], seatY: 0.12 + 0.44, seatAng: -Math.PI / 2, period: 46, phase: 5, sitDur: 14 },
    // senta na poltrona de espera (wc1) — anda até x=-18 na faixa livre (z=-3.0, entre as
    // 2 estações da recepção) e só então segue em diagonal até a poltrona
    { seed: 64, path: [[-20.5, -3.0], [-18.0, -3.0], [-15.6, 2.9]], seat: [-15.6, 2.9], seatY: 0.12 + 0.50, seatAng: Math.PI / 2, period: 40, phase: 22, sitDur: 11 },
  ];
  for (const ld of loungeDefs) {
    const path = ld.path.map(([x, z]) => new THREE.Vector2(x, z));
    const seat = new THREE.Vector2(ld.seat[0], ld.seat[1]);
    const standV = standingPerson(ld.seed); standV.group.position.set(path[0].x, 0.12, path[0].y); standV.group.visible = false; group.add(standV.group);
    const sitV = seatedVisitor(ld.seed); sitV.group.visible = false; group.add(sitV.group);
    const walk = Math.max(1.8, pathLen(path) / 1.25);
    loungers.push({
      stand: standV.group, legs: standV.legs, sArms: standV.arms,
      sit: sitV.group, sitArms: sitV.arms, sitHead: sitV.head,
      path, seat, seatY: ld.seatY, seatAng: ld.seatAng,
      period: ld.period, phase: ld.phase, walkIn: walk, sitDur: ld.sitDur, walkOut: walk,
    });
  }

  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group, sellers, editables,
    setSellerNames(names: string[]) {
      sellerNameplates.forEach((plate, index) => plate.setName(names[index] ?? ''));
    },
    update(t: number) {
    seats.forEach((s) => {
      s.arms.forEach((a, i) => { a.rotation.x = -0.28 + Math.sin(t * 11 + s.ph + i * 2) * 0.05; });
      s.head.rotation.y = Math.sin(t * 0.5 + s.ph) * 0.25; s.head.rotation.x = Math.sin(t * 0.9 + s.ph) * 0.05;
      if (s.screen) s.screen.emissiveIntensity = 0.65 + 0.1 * Math.sin(t * 2 + s.ph);
    });
    // LEDs do servidor piscando em padrões assíncronos
    server.leds.forEach((led, i) => {
      const m = led.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.3 + 0.7 * Math.max(0, Math.sin(t * (2.3 + (i % 5) * 0.37) + i));
    });
    // vendedores: ciclo sentado → levanta → caminha até a tarefa → interage → volta → senta
    walkers.forEach((w) => {
      const tt = (((t + w.phase) % w.period) + w.period) % w.period;
      const sitDur = w.period - (w.walkOut + w.interact + w.walkBack);
      if (tt < sitDur) {
        w.sit.visible = true; w.stand.visible = false; return;
      }
      w.sit.visible = false; w.stand.visible = true;
      const u = tt - sitDur;
      if (u < w.walkOut) {
        const f = u / w.walkOut; const p = pathLerp(w.path, f);
        const ang = pathAngle(w.path, f);
        w.stand.position.set(p.x, 0.12, p.y); w.stand.rotation.y = ang;
        const sw = Math.sin(t * 8 + w.phase);
        w.legs[0].rotation.x = sw * 0.6; w.legs[1].rotation.x = -sw * 0.6;
        w.sArms[0].rotation.x = -sw * 0.5; w.sArms[1].rotation.x = sw * 0.5;
        w.stand.position.y = 0.12 + Math.abs(Math.cos(t * 8 + w.phase)) * 0.04;
      } else if (u < w.walkOut + w.interact) {
        w.stand.position.set(w.dest.x, 0.12, w.dest.y); w.stand.rotation.y = w.destAng;
        w.legs[0].rotation.x = 0; w.legs[1].rotation.x = 0;
        const ui = u - w.walkOut;
        if (w.kind === 'water') {
          // leva o copo à boca
          w.sArms[1].rotation.x = -1.9 + Math.sin(ui * 3) * 0.1; w.sArms[0].rotation.x = -0.2;
        } else if (w.kind === 'printer') {
          // inclina para pegar o papel na bandeja
          w.stand.rotation.x = 0; const bend = Math.sin(Math.min(ui, 1) * Math.PI / 2) * 0.35;
          w.sArms[0].rotation.x = -0.6 - bend; w.sArms[1].rotation.x = -0.6 - bend;
        } else {
          // gesticula atendendo o cliente no balcão
          w.sArms[0].rotation.x = -0.5 + Math.sin(t * 2 + w.phase) * 0.2;
          w.sArms[1].rotation.x = -0.4 + Math.sin(t * 2.3 + w.phase + 1) * 0.2;
        }
      } else {
        const f = (u - w.walkOut - w.interact) / w.walkBack; const p = pathLerp(w.path, 1 - f);
        const ang = pathAngle(w.path, Math.max(0, 1 - f - 0.001)) + Math.PI;
        w.stand.position.set(p.x, 0.12, p.y); w.stand.rotation.y = ang;
        const sw = Math.sin(t * 8 + w.phase);
        w.legs[0].rotation.x = sw * 0.6; w.legs[1].rotation.x = -sw * 0.6;
        w.sArms[0].rotation.x = -sw * 0.5; w.sArms[1].rotation.x = sw * 0.5;
        w.stand.position.y = 0.12 + Math.abs(Math.cos(t * 8 + w.phase)) * 0.04;
      }
    });
    // transeuntes: vaivém contínuo cruzando as 3 salas pelas aberturas das divisórias
    strollers.forEach((st) => {
      const dist = st.a.distanceTo(st.b);
      const ph = (((t * st.speed + st.phase) % (2 * dist)) + 2 * dist) % (2 * dist);
      const forward = ph < dist; const d = forward ? ph : 2 * dist - ph; const f = d / dist;
      const from = forward ? st.a : st.b, to = forward ? st.b : st.a;
      const p = from.clone().lerp(to, f);
      st.group.position.set(p.x, 0.12, p.y);
      const dv = to.clone().sub(from); st.group.rotation.y = Math.atan2(dv.x, dv.y);
      const sw = Math.sin(t * 8 + st.phase);
      st.legs[0].rotation.x = sw * 0.6; st.legs[1].rotation.x = -sw * 0.6;
      st.arms[0].rotation.x = -sw * 0.5; st.arms[1].rotation.x = sw * 0.5;
      st.group.position.y = 0.12 + Math.abs(Math.cos(t * 8 + st.phase)) * 0.04;
    });
    // visitantes: ciclo entra → caminha até o sofá/poltrona → senta um tempo → levanta → sai
    loungers.forEach((l) => {
      const tt = (((t + l.phase) % l.period) + l.period) % l.period;
      const awayDur = l.period - (l.walkIn + l.sitDur + l.walkOut);
      if (tt < awayDur) { l.stand.visible = false; l.sit.visible = false; return; }
      const u = tt - awayDur;
      if (u < l.walkIn) {
        l.sit.visible = false; l.stand.visible = true;
        const f = u / l.walkIn; const p = pathLerp(l.path, f); const ang = pathAngle(l.path, f);
        l.stand.position.set(p.x, 0.12, p.y); l.stand.rotation.y = ang;
        const sw = Math.sin(t * 7.3 + l.phase);
        l.legs[0].rotation.x = sw * 0.55; l.legs[1].rotation.x = -sw * 0.55;
        l.sArms[0].rotation.x = -sw * 0.45; l.sArms[1].rotation.x = sw * 0.45;
        l.stand.position.y = 0.12 + Math.abs(Math.cos(t * 7.3 + l.phase)) * 0.035;
      } else if (u < l.walkIn + l.sitDur) {
        l.stand.visible = false; l.sit.visible = true;
        l.sit.position.set(l.seat.x, l.seatY, l.seat.y); l.sit.rotation.y = l.seatAng;
        const ui = u - l.walkIn;
        l.sitHead.rotation.y = Math.sin(ui * 0.4 + l.phase) * 0.3;
        l.sitArms[0].rotation.x = -0.1 + Math.sin(ui * 0.6 + l.phase) * 0.08;
        l.sitArms[1].rotation.x = -0.1 + Math.sin(ui * 0.6 + l.phase + 1) * 0.08;
      } else {
        l.sit.visible = false; l.stand.visible = true;
        const f = (u - l.walkIn - l.sitDur) / l.walkOut;
        const p = pathLerp(l.path, 1 - f); const ang = pathAngle(l.path, Math.max(0, 1 - f - 0.001)) + Math.PI;
        l.stand.position.set(p.x, 0.12, p.y); l.stand.rotation.y = ang;
        const sw = Math.sin(t * 7.3 + l.phase);
        l.legs[0].rotation.x = sw * 0.55; l.legs[1].rotation.x = -sw * 0.55;
        l.sArms[0].rotation.x = -sw * 0.45; l.sArms[1].rotation.x = sw * 0.45;
        l.stand.position.y = 0.12 + Math.abs(Math.cos(t * 7.3 + l.phase)) * 0.035;
      }
    });
  } };
}
