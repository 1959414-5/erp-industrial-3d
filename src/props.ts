import * as THREE from 'three';

// Props do chão de fábrica: operadores, empilhadeiras e área de expedição.
// Mantém o mesmo estilo low-poly/procedural das máquinas.

const std = (color: number, rough = 0.6, metal = 0.08) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const b = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y + h / 2, z); return mesh;
};
const cyl = (r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 16) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); mesh.position.set(x, y + h / 2, z); return mesh;
};

const SKINS = [0xf1c9a5, 0xd9a37a, 0xa8714a, 0x7a4b2e];
const HATS = [0xffd23f, 0xff8c42, 0xffffff, 0x3b82f6]; // capacetes de EPI
const SHIRTS = [0x3b82f6, 0xf26a1b, 0x22b573, 0x7c5cfc, 0x1f2a44, 0xe5484d, 0xf5b83d, 0x14b8a6]; // roupas de clientes
const hash = (n: number) => Math.abs(Math.sin(n * 91.73) * 43758.5453) % 1;

export interface Prop {
  group: THREE.Group;
  update(t: number): void;
  setLabel?(text: string): void;
}

/** Operador de pé com capacete e colete de alta visibilidade. Pequena animação ociosa. */
export function buildWorker(seed = 0): Prop {
  const g = new THREE.Group();
  const skin = std(SKINS[Math.floor(hash(seed) * SKINS.length)], 0.8, 0);
  const hatC = HATS[Math.floor(hash(seed + 5) * HATS.length)];
  const vest = std(hash(seed + 2) > 0.5 ? 0xe96b2c : 0x7c8591, 0.7);
  const pants = std(0x2b3550, 0.8);
  const boot = std(0x1a2236, 0.7);
  const stripe = std(0xe8eef6, 0.4, 0.3); // faixa refletiva do colete

  // pernas + botas
  for (const x of [-0.11, 0.11]) {
    g.add(b(0.15, 0.5, 0.15, pants, x, 0.18, 0));
    g.add(b(0.17, 0.12, 0.26, boot, x, 0.0, 0.03));
  }
  // tronco (colete) + faixas refletivas
  g.add(b(0.42, 0.58, 0.26, vest, 0, 0.66, 0));
  g.add(b(0.44, 0.06, 0.27, stripe, 0, 0.8, 0));
  g.add(b(0.1, 0.46, 0.27, stripe, -0.12, 0.7, 0), b(0.1, 0.46, 0.27, stripe, 0.12, 0.7, 0));
  // pescoço
  g.add(b(0.09, 0.08, 0.09, skin, 0, 1.22, 0));
  // cabeça + capacete (meia-esfera) + aba
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), skin); head.position.set(0, 1.37, 0);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), std(hatC, 0.5));
  helmet.position.y = 0.02; head.add(helmet);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 18, 1, false, 0, Math.PI), std(hatC, 0.5));
  brim.position.set(0, 0.03, 0.06); head.add(brim);
  g.add(head);
  // braços (grupos p/ animar) — um levemente à frente (operando painel)
  const arms = [-1, 1].map((sx) => {
    const a = new THREE.Group(); a.position.set(sx * 0.27, 0.92, 0);
    a.add(b(0.1, 0.46, 0.12, vest, 0, -0.16, 0), b(0.09, 0.12, 0.1, skin, 0, -0.42, 0));
    g.add(a); return a;
  });
  arms[0].rotation.x = -1.1; arms[1].rotation.x = -1.0;
  const ph = seed * 1.3;
  return { group: g, update(t: number) {
    const w = t * 1.9 + ph;
    // braços à frente operando a máquina/painel, com micro-movimentos de "apertar"
    arms[0].rotation.x = -1.15 + Math.sin(w * 1.4) * 0.18;
    arms[1].rotation.x = -1.0 + Math.sin(w * 1.4 + 0.8) * 0.14;
    // ciclo lento: de vez em quando um "golpe" de carregar/retirar peça
    const cyc = (Math.sin(t * 0.5 + ph * 2) + 1) / 2;
    if (cyc > 0.82) arms[0].rotation.x -= (cyc - 0.82) * 2.6;
    head.rotation.x = 0.26 + Math.sin(w) * 0.05;  // olhando para o trabalho
    head.rotation.y = Math.sin(t * 0.7 + ph) * 0.12;
    g.position.y = Math.abs(Math.sin(t * 1.1 + ph)) * 0.012;
  } };
}

/** Palete de madeira com caixas/carga embalada. */
export function buildPallet(wrap = false): THREE.Group {
  const g = new THREE.Group();
  const wood = std(0xc9a26b, 0.9);
  g.add(b(1.2, 0.14, 0.9, wood, 0, 0, 0));
  if (wrap) {
    g.add(b(1.0, 0.8, 0.72, std(0x9fb0c7, 0.3, 0.1), 0, 0.14)); // filme stretch
    g.add(b(1.02, 0.08, 0.74, std(0x2b3550, 0.5), 0, 0.5));     // cinta
  } else {
    const box = std(0xb98a52, 0.85);
    g.add(b(0.52, 0.42, 0.4, box, -0.26, 0.14, -0.2), b(0.52, 0.42, 0.4, box, 0.26, 0.14, 0.2));
    g.add(b(0.52, 0.42, 0.4, box, 0.26, 0.14, -0.22), b(0.56, 0.4, 0.42, box, -0.22, 0.56, 0));
  }
  return g;
}

/** Empilhadeira com mastro, garfos, rodas girando e motorista. Segue uma rota
 *  de vários pontos (polilinha), indo e voltando (ping-pong). */
export function buildForklift(route: { path: [number, number][]; speed?: number; carry?: boolean }): Prop {
  const g = new THREE.Group();
  const body = std(0xf2a71b, 0.5, 0.2), dark = std(0x24303f, 0.5), metal = std(0xcfd6e2, 0.3, 0.8), seat = std(0x1a2236, 0.7);
  // chassi + contrapeso (frente dos garfos = +x)
  g.add(b(1.5, 0.55, 1.0, body, -0.1, 0.32, 0));
  g.add(b(0.5, 0.7, 1.0, body, -0.95, 0.32, 0)); // contrapeso traseiro
  // rodas
  const wheels: THREE.Mesh[] = [];
  for (const [x, z] of [[0.5, 0.52], [0.5, -0.52], [-0.8, 0.52], [-0.8, -0.52]]) {
    const w = cyl(0.26, 0.18, dark, x, 0.26, z, 16); w.rotation.x = Math.PI / 2; g.add(w); wheels.push(w);
  }
  // gaiola de proteção (overhead guard)
  for (const [x, z] of [[0.05, 0.42], [0.05, -0.42], [-0.6, 0.42], [-0.6, -0.42]]) g.add(b(0.07, 1.25, 0.07, dark, x, 0.6, z));
  g.add(b(0.85, 0.07, 1.0, dark, -0.27, 1.85, 0));
  // banco + motorista
  g.add(b(0.4, 0.1, 0.42, seat, -0.5, 0.87, 0), b(0.4, 0.4, 0.1, seat, -0.68, 0.95, 0));
  const drv = buildWorker(7); drv.group.scale.setScalar(0.82); drv.group.position.set(-0.4, 0.52, 0); drv.group.rotation.y = Math.PI / 2; g.add(drv.group);
  // mastro + garfos (frente)
  g.add(b(0.1, 2.0, 0.12, metal, 0.72, 0.1, 0.28), b(0.1, 2.0, 0.12, metal, 0.72, 0.1, -0.28));
  const carriage = new THREE.Group(); carriage.position.set(0.78, 0.12, 0);
  carriage.add(b(0.08, 0.5, 0.7, dark, 0, 0.25, 0));
  carriage.add(b(0.9, 0.08, 0.12, metal, 0.45, 0, 0.22), b(0.9, 0.08, 0.12, metal, 0.45, 0, -0.22)); // garfos
  g.add(carriage);
  if (route.carry) { const pal = buildPallet(true); pal.scale.setScalar(0.85); pal.position.set(1.0, 0.16, 0); g.add(pal); }

  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // --- percurso por polilinha (ping-pong) ---
  const pts = route.path.map(([x, z]) => new THREE.Vector2(x, z));
  const segLen: number[] = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); segLen.push(l); total += l; }
  total = total || 1;
  const speed = route.speed ?? 2;
  const at = (s: number) => { // ponto e tangente a uma distância s ao longo da polilinha
    s = Math.max(0, Math.min(total, s)); let acc = 0;
    for (let i = 0; i < segLen.length; i++) {
      if (s <= acc + segLen[i] || i === segLen.length - 1) {
        const u = segLen[i] ? (s - acc) / segLen[i] : 0;
        const p = pts[i].clone().lerp(pts[i + 1], u);
        const tan = pts[i + 1].clone().sub(pts[i]).normalize();
        return { p, tan };
      }
      acc += segLen[i];
    }
    return { p: pts[0].clone(), tan: new THREE.Vector2(1, 0) };
  };
  let last = 0;
  return { group: g, update(t: number) {
    const dt = Math.min(Math.max(t - last, 0), 0.1); last = t;
    const cycle = total / speed;                 // tempo de uma passada
    const phase = (t / cycle) % 2;               // 0..2
    const s = phase < 1 ? phase * total : (2 - phase) * total;
    const sgn = phase < 1 ? 1 : -1;
    const { p, tan } = at(s);
    g.position.set(p.x, 0, p.y);
    const dir = tan.clone().multiplyScalar(sgn);
    g.rotation.y = Math.atan2(-dir.y, dir.x);
    const spin = (speed * dt) / 0.26;
    wheels.forEach((w) => (w.rotation.y += spin * sgn));
    carriage.position.y = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.3)); // sobe/desce leve
  } };
}

/** Pilha de chapas metálicas sobre palete (matéria-prima junto da máquina). */
export function buildSheetStack(n = 6): THREE.Group {
  const g = new THREE.Group();
  g.add(b(1.4, 0.14, 1.0, std(0xc9a26b, 0.9), 0, 0, 0));
  const steel = std(0xb9c1ce, 0.3, 0.85);
  for (let i = 0; i < n; i++) g.add(b(1.3 - i * 0.015, 0.05, 0.9 - i * 0.015, steel, 0, 0.14 + i * 0.06, 0));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Área de expedição: doca elevada, portas, caminhão com baú e paletes prontos. */
export function buildExpedition(): THREE.Group {
  const g = new THREE.Group();
  const wall = std(0xdfe5ef, 0.8), frame = std(0x9aa5b8, 0.5), door = std(0x3b4660, 0.6);
  const dock = std(0xb8c0cf, 0.7), paint = std(0xf5d04e, 0.9);

  // parede de fundo com 2 portões de doca
  g.add(b(11, 4.2, 0.3, wall, 0, 0, -2));
  for (const x of [-2.8, 2.8]) {
    g.add(b(2.4, 3.0, 0.12, door, x, 0.2, -1.84));
    g.add(b(2.7, 0.18, 0.14, frame, x, 3.2, -1.82));
    // ripas do portão basculante
    for (let i = 0; i < 6; i++) g.add(b(2.3, 0.03, 0.02, frame, x, 0.35 + i * 0.45, -1.77));
  }
  // placa EXPEDIÇÃO
  const sign = signBoard('EXPEDIÇÃO'); sign.position.set(0, 3.7, -1.7); g.add(sign);

  // plataforma de doca elevada + rampa + faixa de segurança
  g.add(b(11, 1.1, 3.2, dock, 0, 0, 0.4));
  g.add(b(11, 0.03, 0.2, paint, 0, 1.1, 1.9));
  for (let i = 0; i < 10; i++) g.add(b(0.25, 0.03, 0.2, std(0x1a2236, 0.6), -4.8 + i * 1.07, 1.1, 1.9));

  // paletes prontos para embarque, sobre a doca
  const spots: [number, number, boolean][] = [[-3.6, 0.9, true], [-2.2, 0.9, true], [3.4, 0.6, false], [4.4, 0.9, true]];
  for (const [x, z, w] of spots) { const p = buildPallet(w); p.position.set(x, 1.1, z); g.add(p); }

  // caminhão removido daqui — agora é animado externamente (scene.ts)

  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Marcador e etiqueta billboard de cada equipamento. A cor reflete o estado operacional. */
export function buildMarker(name: string, hex: number, detail: string): Prop {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.6, roughness: 0.3 });
  const pin = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), mat);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 18), mat);
  cone.position.y = -0.29; cone.rotation.x = Math.PI;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), new THREE.MeshBasicMaterial({
    color: hex, transparent: true, opacity: 0.14, depthWrite: false,
  }));
  pin.add(ball, cone, halo); g.add(pin);

  const tag = labelSprite(name, detail, hex);
  tag.position.set(0, 1.08, 0);
  g.add(tag);

  const ph = name.length * 0.7;
  return { group: g, update(t: number) {
    pin.position.y = 0.15 * Math.sin(t * 2 + ph) + 0.1;
    mat.emissiveIntensity = 0.48 + 0.28 * Math.sin(t * 3 + ph);
  } };
}
function labelSprite(name: string, detail: string, hex: number): THREE.Sprite {
  const cv = document.createElement('canvas');
  cv.width = 360; cv.height = 104;
  const c = cv.getContext('2d')!;

  c.fillStyle = 'rgba(18,28,41,0.97)';
  roundRect(c, 2, 2, 356, 100, 13); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.26)'; c.lineWidth = 2;
  roundRect(c, 3, 3, 354, 98, 12); c.stroke();

  const accent = '#' + hex.toString(16).padStart(6, '0');
  c.fillStyle = accent;
  roundRect(c, 10, 12, 7, 80, 3); c.fill();

  c.beginPath(); c.arc(34, 34, 8, 0, Math.PI * 2);
  c.fillStyle = accent; c.fill();
  c.beginPath(); c.arc(34, 34, 13, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 2; c.stroke();

  c.textBaseline = 'middle';
  c.textAlign = 'left';
  c.fillStyle = '#f7f9fc';
  c.font = '800 25px "IBM Plex Sans", Arial';
  c.fillText(name.toLocaleUpperCase('pt-BR'), 56, 35, 286);

  c.fillStyle = 'rgba(222,231,240,0.82)';
  c.font = '700 15px "IBM Plex Sans", Arial';
  c.fillText(detail.toLocaleUpperCase('pt-BR'), 56, 73, 286);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
  });
  const spr = new THREE.Sprite(material);
  spr.renderOrder = 10;
  const k = 0.0075;
  spr.scale.set(cv.width * k, cv.height * k, 1);
  return spr;
}

/** Estante/prateleira de armazenagem (racking industrial) com fardos de chapa. */
export function buildRack(width = 10): THREE.Group {
  const g = new THREE.Group();
  const H = 3.0, depth = 1.0, levels = 3;
  const upright = std(0x394454, 0.5, 0.2), beamM = std(0xe96b2c, 0.5, 0.2), deck = std(0xaeb8ca, 0.6, 0.3), steel = std(0xb9c1ce, 0.3, 0.8), bundle = std(0xc9a26b, 0.85);
  for (const x of [-width / 2, 0, width / 2]) for (const z of [-depth / 2, depth / 2]) g.add(b(0.14, H, 0.14, upright, x, 0, z));
  for (let l = 0; l < levels; l++) {
    const y = 0.5 + l * (H - 0.6) / (levels - 1);
    g.add(b(width, 0.08, 0.12, beamM, 0, y, -depth / 2), b(width, 0.08, 0.12, beamM, 0, y, depth / 2));
    g.add(b(width - 0.1, 0.06, depth, deck, 0, y + 0.06, 0));
    for (let k = -1; k <= 1; k++) g.add(b(width / 3.7, 0.34, depth * 0.72, k % 2 ? steel : bundle, k * width / 3.1, y + 0.13, 0));
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// --- seguidor de polilinha (reutilizado por pessoas e veículos) ---
function follower(path: [number, number][], speed: number) {
  const pts = path.map(([x, z]) => new THREE.Vector2(x, z));
  const seg: number[] = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); seg.push(l); total += l; }
  total = total || 1;
  return (t: number) => {
    const phase = (t * speed / total) % 2;
    const s = (phase < 1 ? phase : 2 - phase) * total; const sgn = phase < 1 ? 1 : -1;
    let acc = 0;
    for (let i = 0; i < seg.length; i++) {
      if (s <= acc + seg[i] || i === seg.length - 1) {
        const u = seg[i] ? (s - acc) / seg[i] : 0;
        const p = pts[i].clone().lerp(pts[i + 1], u);
        const d = pts[i + 1].clone().sub(pts[i]).multiplyScalar(sgn).normalize();
        return { x: p.x, z: p.y, ang: Math.atan2(d.x, d.y) };
      }
      acc += seg[i];
    }
    return { x: pts[0].x, z: pts[0].y, ang: 0 };
  };
}

/** Trabalhador que CAMINHA por uma rota (pernas/braços balançando). */
export function buildRoamer(path: [number, number][], seed = 0, speed = 1.3): Prop {
  const g = new THREE.Group();
  const vest = std(hash(seed + 2) > 0.5 ? 0xe96b2c : 0x7c8591, 0.7);
  const skin = std(SKINS[Math.floor(hash(seed) * SKINS.length)], 0.8, 0);
  const pants = std(0x2b3550, 0.8), boot = std(0x1a2236, 0.7);
  const hatC = HATS[Math.floor(hash(seed + 5) * HATS.length)];
  const legs = [-0.11, 0.11].map((x) => { const l = new THREE.Group(); l.position.set(x, 0.52, 0); l.add(b(0.15, 0.5, 0.16, pants, 0, -0.25, 0), b(0.17, 0.1, 0.26, boot, 0, -0.52, 0.03)); g.add(l); return l; });
  g.add(b(0.42, 0.56, 0.26, vest, 0, 0.66, 0), b(0.09, 0.08, 0.09, skin, 0, 1.2, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), skin); head.position.set(0, 1.35, 0);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), std(hatC, 0.5)); helmet.position.y = 0.02; head.add(helmet); g.add(head);
  const arms = [-0.27, 0.27].map((x) => { const a = new THREE.Group(); a.position.set(x, 0.92, 0); a.add(b(0.1, 0.46, 0.12, vest, 0, -0.2, 0), b(0.09, 0.1, 0.1, skin, 0, -0.44, 0)); g.add(a); return a; });
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const move = follower(path, speed);
  return { group: g, update(t: number) {
    const m = move(t); g.position.set(m.x, 0, m.z); g.rotation.y = m.ang;
    const sw = Math.sin(t * speed * 4.5 + seed);
    legs[0].rotation.x = sw * 0.6; legs[1].rotation.x = -sw * 0.6;
    arms[0].rotation.x = -sw * 0.5; arms[1].rotation.x = sw * 0.5;
    g.position.y = Math.abs(Math.cos(t * speed * 4.5 + seed)) * 0.04;
  } };
}

/** Funcionário separando caixas: ergue um volume, aproxima-o do corpo e devolve-o à prateleira.
 *  É cenográfico e não altera estoque, lote ou qualquer dado operacional. */
export function buildWarehousePicker(seed = 0): Prop {
  const g = new THREE.Group();
  const worker = buildWorker(seed);
  worker.group.scale.setScalar(0.9);
  g.add(worker.group);

  const cartonMat = std(seed % 2 ? 0xc79a64 : 0xd4aa76, 0.88, 0);
  const tapeMat = std(0x526171, 0.74, 0.02);
  const labelMat = std(0xf1eee7, 0.9, 0);
  const carton = new THREE.Group();
  carton.add(
    b(0.42, 0.32, 0.34, cartonMat, 0, 0, 0),
    b(0.045, 0.012, 0.345, tapeMat, 0, 0.32, 0),
    b(0.012, 0.012, 0.34, tapeMat, 0, 0.16, 0),
    b(0.15, 0.1, 0.012, labelMat, 0.11, 0.14, 0.176),
  );
  g.add(carton);

  // Caixa de apoio e pequeno pallet junto ao funcionário.
  const pallet = new THREE.Group();
  pallet.add(
    b(0.92, 0.12, 0.7, std(0xb78a58, 0.9), 0, 0, 0),
    b(0.86, 0.34, 0.62, cartonMat, 0, 0.12, 0),
    b(0.05, 0.012, 0.63, tapeMat, 0, 0.46, 0),
  );
  pallet.position.set(0.72, 0, -0.78);
  g.add(pallet);

  const shelfPoint = new THREE.Vector3(0.62, 0.84, -0.95);
  const handPoint = new THREE.Vector3(0.02, 1.08, -0.36);
  return {
    group: g,
    update(t: number) {
      worker.update(t);
      const phase = ((t * 0.23 + seed * 0.071) % 1 + 1) % 1;
      const triangle = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      const eased = triangle * triangle * (3 - 2 * triangle);
      carton.position.lerpVectors(shelfPoint, handPoint, eased);
      carton.rotation.y = Math.sin(t * 1.8 + seed) * 0.08;
      carton.rotation.x = Math.sin(t * 1.2 + seed * 0.4) * 0.025;
    },
  };
}

/** Placa de setor com moldura, faixa de identificação e texto de alto contraste. */
export function buildSectorSign(text: string, hex = 0x1f2a44): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.05, 2.0, std(0x778493, 0.55), 0, 0, 0, 10));

  const cv = document.createElement('canvas'); cv.width = 420; cv.height = 120;
  const c = cv.getContext('2d')!;
  c.fillStyle = 'rgba(15,24,36,0.98)'; roundRect(c, 2, 2, 416, 116, 16); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.34)'; c.lineWidth = 3;
  roundRect(c, 3, 3, 414, 114, 15); c.stroke();
  c.fillStyle = '#' + hex.toString(16).padStart(6, '0');
  roundRect(c, 12, 13, 12, 94, 6); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.94)';
  c.font = '800 34px "IBM Plex Sans", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 224, 62, 360);

  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.57), material);
  plate.position.set(0, 2.12, 0);
  const back = plate.clone(); back.rotation.y = Math.PI;
  g.add(plate, back);
  return g;
}

/** Impressora de escritório. */
export function buildPrinter(): THREE.Group {
  const g = new THREE.Group();
  g.add(b(0.7, 0.5, 0.6, std(0xf4f7fd, 0.5), 0, 0.5, 0), b(0.72, 0.1, 0.62, std(0x2b3550, 0.5), 0, 0.5, 0));
  g.add(b(0.5, 0.03, 0.4, std(0xffffff, 0.4), 0, 1.01, 0.05), b(0.2, 0.06, 0.1, std(0x22b573, 0.4, 0.5), 0.2, 1.02, 0.28));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Bebedouro / galão de água. */
export function buildWaterCooler(): THREE.Group {
  const g = new THREE.Group();
  g.add(b(0.5, 1.0, 0.5, std(0xeef2f8, 0.5), 0, 0, 0));
  g.add(cyl(0.22, 0.45, new THREE.MeshStandardMaterial({ color: 0x9ec5ff, transparent: true, opacity: 0.6, roughness: 0.1 }), 0, 1.0, 0, 16));
  g.add(b(0.1, 0.1, 0.12, std(0x3b82f6, 0.4), 0, 0.55, 0.26));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Balcão de atendimento (recepção). */
export function buildCounter(width = 4): THREE.Group {
  const g = new THREE.Group();
  g.add(b(width, 1.05, 0.7, std(0xf4f7fd, 0.5), 0, 0, 0));
  g.add(b(width + 0.1, 0.08, 0.85, std(0x394454, 0.5), 0, 1.05, 0));       // tampo
  g.add(b(width - 0.3, 0.3, 0.05, std(0xe96b2c, 0.4), 0, 0.55, 0.36));     // frente painel
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** TV de parede (moldura + tela emissiva com a textura passada). Encosta no eixo Z=0 (parede atrás). */
export function buildTV(tex: THREE.Texture, w = 1.7, h = 0.95): { group: THREE.Group; screen: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  g.add(b(0.08, 0.5, 0.08, std(0x1a2236, 0.5, 0.6), 0, -0.15, 0.1));               // suporte
  g.add(b(w + 0.08, h + 0.08, 0.05, std(0x111722, 0.3, 0.5), 0, 0.3, 0.02));       // moldura
  const screen = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.3 });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screen); pl.position.set(0, 0.3, 0.051); g.add(pl);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, screen };
}

/** Rack de servidor com LEDs piscantes. */
export function buildServerRack(): { group: THREE.Group; leds: THREE.Mesh[] } {
  const g = new THREE.Group();
  const body = std(0x1f2430, 0.4, 0.5), trim = std(0x2b3550, 0.4, 0.5);
  g.add(b(0.7, 1.9, 0.75, body, 0, 0, 0));
  g.add(b(0.72, 0.08, 0.77, trim, 0, 1.9, 0));
  const leds: THREE.Mesh[] = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 3; col++) {
      const m = new THREE.MeshStandardMaterial({ color: 0x22b573, emissive: 0x22b573, emissiveIntensity: 1 });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), m);
      led.position.set(-0.22 + col * 0.22, 1.7 - row * 0.28, 0.38); g.add(led); leds.push(led);
    }
  }
  // grades de ventilação
  for (let i = 0; i < 4; i++) g.add(b(0.6, 0.015, 0.02, std(0x11151d, 0.5), 0, 0.15 + i * 0.05, 0.38));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh && !leds.includes(o as THREE.Mesh)) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, leds };
}

/** Armário/arquivo de escritório. */
export function buildCabinet(w = 0.9, h = 1.8, d = 0.5, color = 0x8b93a6): THREE.Group {
  const g = new THREE.Group();
  const body = std(color, 0.5, 0.3), trim = std(0x2b3550, 0.4, 0.4), handle = std(0xd4dcea, 0.3, 0.7);
  g.add(b(w, h, d, body, 0, 0, 0));
  const drawers = 3;
  for (let i = 0; i < drawers; i++) {
    const y = (h / drawers) * i + (h / drawers) * 0.5 - h / 2 + h / 2;
    g.add(b(w - 0.08, h / drawers - 0.06, 0.03, trim, 0, y, d / 2 + 0.015));
    g.add(b(0.28, 0.04, 0.04, handle, 0, y, d / 2 + 0.04));
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Sofá de 2 lugares (área de espera). */
export function buildSofa(w = 1.8, color = 0x3b5578): THREE.Group {
  const g = new THREE.Group();
  const fab = std(color, 0.85), wood = std(0x6b4a30, 0.6);
  g.add(b(w, 0.1, 0.78, wood, 0, 0, 0));                                   // base
  g.add(b(w - 0.1, 0.34, 0.68, fab, 0, 0.1, 0));                          // assento
  g.add(b(w - 0.1, 0.55, 0.14, fab, 0, 0.3, -0.32));                      // encosto
  for (const sx of [-1, 1]) g.add(b(0.16, 0.5, 0.74, fab, sx * (w / 2 - 0.08), 0.25, 0));  // braços
  // almofadas
  for (const cx of [-w / 4.2, w / 4.2]) g.add(b(0.5, 0.14, 0.5, std(color > 0x808080 ? 0x1f2a44 : 0xbfcbe0, 0.8), cx, 0.5, -0.05));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Mesinha de centro baixa. */
export function buildCoffeeTable(): THREE.Group {
  const g = new THREE.Group();
  const top = std(0x3a4252, 0.3, 0.4), leg = std(0x1a2236, 0.4, 0.6);
  g.add(b(0.85, 0.05, 0.5, top, 0, 0.32, 0));
  for (const [x, z] of [[-0.37, -0.2], [0.37, -0.2], [-0.37, 0.2], [0.37, 0.2]]) g.add(b(0.05, 0.32, 0.05, leg, x as number, 0, z as number));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Cadeira de espera avulsa (sem braços). */
export function buildWaitChair(color = 0x3b5578): THREE.Group {
  const g = new THREE.Group();
  const fab = std(color, 0.8), leg = std(0x2b3550, 0.4, 0.5);
  g.add(b(0.46, 0.08, 0.46, fab, 0, 0.42, 0), b(0.46, 0.5, 0.08, fab, 0, 0.66, 0.2));
  for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) g.add(b(0.04, 0.42, 0.04, leg, x as number, 0, z as number));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Vitrine/pedestal de produto para o showroom (peça genérica em exibição). */
export function buildProductDisplay(color = 0xf26a1b): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.34, 0.75, std(0xe3e9f2, 0.4, 0.2), 0, 0, 0, 24));            // pedestal
  g.add(b(0.04, 0.02, 0.76, std(0x394454, 0.5), 0, 0.751, 0));             // aro no topo (achatado, decorativo)
  const prod = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), std(color, 0.35, 0.5));
  prod.position.y = 0.75 + 0.3; prod.rotation.y = 0.4; g.add(prod);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Carro simples (cliente chegando). */
export function buildCar(color = 0xd7262c): THREE.Group {
  const g = new THREE.Group();
  const body = std(color, 0.4, 0.4), glass = std(0x8fb3de, 0.2, 0.4), tyre = std(0x15202e, 0.7), trim = std(0x1a2236, 0.5);
  g.add(b(2.0, 0.55, 4.2, body, 0, 0.4, 0));          // carroceria
  g.add(b(1.85, 0.6, 2.2, body, 0, 0.9, -0.1));       // cabine
  g.add(b(1.7, 0.45, 2.0, glass, 0, 0.95, -0.1));     // vidros
  g.add(b(2.02, 0.12, 4.2, trim, 0, 0.3, 0));
  for (const [x, z] of [[1.0, 1.3], [-1.0, 1.3], [1.0, -1.3], [-1.0, -1.3]]) { const w = cyl(0.34, 0.24, tyre, x, 0.34, z, 16); w.rotation.z = Math.PI / 2; g.add(w); }
  g.add(b(0.3, 0.16, 0.08, std(0xfff3c4, 0.3, 0.4), 0.7, 0.45, 2.1), b(0.3, 0.16, 0.08, std(0xfff3c4, 0.3, 0.4), -0.7, 0.45, 2.1));
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Caminhão (baú + cabine), reutilizável (expedição/recebimento). */
export function buildTruck(): THREE.Group {
  const t = new THREE.Group();
  const red = std(0xd7262c, 0.5, 0.2), boxBody = std(0xeef2f8, 0.6), chassis = std(0x24303f, 0.6), tyre = std(0x15202e, 0.7), glass = std(0x7fa8d9, 0.2, 0.3);
  t.add(b(2.5, 2.3, 4.2, boxBody, 0, 0.9, -0.6));
  t.add(b(2.52, 0.2, 4.22, red, 0, 2.15, -0.6));
  t.add(b(2.5, 2.0, 1.4, red, 0, 0.9, 2.3));
  t.add(b(2.2, 0.9, 0.08, glass, 0, 1.6, 3.02));
  t.add(b(2.6, 0.5, 5.8, chassis, 0, 0.35, 0.2));
  for (const [x, z] of [[1.15, 2.2], [-1.15, 2.2], [1.15, -0.8], [-1.15, -0.8], [1.15, -1.9], [-1.15, -1.9]]) { const w = cyl(0.42, 0.3, tyre, x, 0.42, z, 18); w.rotation.z = Math.PI / 2; t.add(w); }
  t.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return t;
}

// --- amostragem de caminho (one-way, 0..1) ---
function pathInfo(path: [number, number][]) {
  const pts = path.map(([x, z]) => new THREE.Vector2(x, z));
  const seg: number[] = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); seg.push(l); total += l; }
  return { pts, seg, total: total || 1 };
}
function sampleAt(info: ReturnType<typeof pathInfo>, u: number) {
  u = Math.max(0, Math.min(1, u)); const s = u * info.total; let acc = 0;
  for (let i = 0; i < info.seg.length; i++) {
    if (s <= acc + info.seg[i] || i === info.seg.length - 1) {
      const uu = info.seg[i] ? (s - acc) / info.seg[i] : 0;
      const p = info.pts[i].clone().lerp(info.pts[i + 1], uu);
      const d = info.pts[i + 1].clone().sub(info.pts[i]).normalize();
      return { x: p.x, z: p.y, ang: Math.atan2(d.x, d.y) };
    }
    acc += info.seg[i];
  }
  return { x: info.pts[0].x, z: info.pts[0].y, ang: 0 };
}

/** Figura civil (cliente) com pernas/braços animáveis. */
function buildCivilian(seed: number) {
  const g = new THREE.Group();
  const shirt = std(SHIRTS[Math.floor(hash(seed) * SHIRTS.length)], 0.7);
  const skin = std(SKINS[Math.floor(hash(seed + 1) * SKINS.length)], 0.8, 0);
  const pants = std(hash(seed + 2) > 0.5 ? 0x2b3550 : 0x3a4252, 0.8), shoe = std(0x1a2236, 0.6);
  const legs = [-0.1, 0.1].map((x) => { const l = new THREE.Group(); l.position.set(x, 0.5, 0); l.add(b(0.14, 0.5, 0.15, pants, 0, -0.25, 0), b(0.16, 0.1, 0.24, shoe, 0, -0.52, 0.03)); g.add(l); return l; });
  g.add(b(0.4, 0.54, 0.24, shirt, 0, 0.64, 0), b(0.09, 0.08, 0.09, skin, 0, 1.16, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), skin); head.position.set(0, 1.31, 0);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), std(hash(seed + 4) > 0.5 ? 0x2a1f1a : 0x5a4030, 0.9)); hair.position.y = 0.02; head.add(hair); g.add(head);
  const arms = [-0.26, 0.26].map((x) => { const a = new THREE.Group(); a.position.set(x, 0.9, 0); a.add(b(0.09, 0.44, 0.11, shirt, 0, -0.2, 0), b(0.08, 0.1, 0.09, skin, 0, -0.42, 0)); g.add(a); return a; });
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, legs, arms };
}

export interface CustomerOpts {
  carColor: number; seed: number; offset: number; stallAng?: number;
  approach: [number, number][]; walk: [number, number][]; depart: [number, number][];
  dur?: { in: number; park: number; walk: number; order: number; out: number; idle: number };
}
/** Cliente completo: chega de carro, estaciona, caminha ao balcão, faz pedido e vai embora (loop). */
export function buildCustomer(o: CustomerOpts): Prop {
  const g = new THREE.Group();
  const car = buildCar(o.carColor); g.add(car);
  const civ = buildCivilian(o.seed); civ.group.visible = false; g.add(civ.group);
  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 520; labelCanvas.height = 112;
  const labelCtx = labelCanvas.getContext('2d')!;
  const labelTexture = new THREE.CanvasTexture(labelCanvas); labelTexture.colorSpace = THREE.SRGBColorSpace;
  const labelMaterial = new THREE.SpriteMaterial({
    map: labelTexture, transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
  });
  const visitorLabel = new THREE.Sprite(labelMaterial);
  visitorLabel.position.set(0, 2.12, 0);
  visitorLabel.scale.set(1.85, 0.4, 1);
  visitorLabel.renderOrder = 15;
  visitorLabel.visible = false;
  civ.group.add(visitorLabel);
  const setLabel = (text: string) => {
    labelCtx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
    if (!text.trim()) { visitorLabel.visible = false; labelTexture.needsUpdate = true; return; }
    labelCtx.fillStyle = 'rgba(25,39,56,0.96)';
    roundRect(labelCtx, 3, 3, 514, 106, 18); labelCtx.fill();
    labelCtx.fillStyle = '#e96b2c';
    roundRect(labelCtx, 12, 13, 7, 86, 4); labelCtx.fill();
    labelCtx.fillStyle = 'rgba(220,230,240,0.86)';
    labelCtx.font = '700 19px "IBM Plex Sans", Arial';
    labelCtx.textBaseline = 'middle'; labelCtx.textAlign = 'left';
    labelCtx.fillText('CLIENTE EM ATENDIMENTO', 39, 37, 455);
    labelCtx.fillStyle = '#ffffff';
    labelCtx.font = '650 30px "IBM Plex Sans", Arial';
    labelCtx.fillText(text.toLocaleUpperCase('pt-BR'), 39, 77, 455);
    visitorLabel.visible = true;
    labelTexture.needsUpdate = true;
  };
  const AP = pathInfo(o.approach), WK = pathInfo(o.walk), DP = pathInfo(o.depart);
  const D = o.dur ?? { in: 8, park: 1.5, walk: 5, order: 6, out: 9, idle: 5 };
  const T = D.in + D.park + D.walk + D.order + D.walk + D.out + D.idle;
  const stallAng = o.stallAng ?? Math.PI;
  const put = (obj: THREE.Object3D, x: number, z: number, ang: number) => { obj.position.x = x; obj.position.z = z; obj.rotation.y = ang; };
  const swing = (walking: boolean, t: number) => {
    const s = walking ? Math.sin(t * 7 + o.seed) : 0;
    civ.legs[0].rotation.x = s * 0.6; civ.legs[1].rotation.x = -s * 0.6;
    civ.arms[0].rotation.x = -s * 0.5; civ.arms[1].rotation.x = s * 0.5;
    civ.group.position.y = walking ? Math.abs(Math.cos(t * 7 + o.seed)) * 0.04 : 0;
  };
  return { group: g, setLabel, update(t: number) {
    const tt = (((t + o.offset) % T) + T) % T;
    const b1 = D.in, b2 = b1 + D.park, b3 = b2 + D.walk, b4 = b3 + D.order, b5 = b4 + D.walk, b6 = b5 + D.out;
    if (tt < b1) {                       // dirigindo até a vaga
      car.visible = true; civ.group.visible = false;
      const s = sampleAt(AP, tt / D.in); put(car, s.x, s.z, s.ang);
    } else if (tt < b2) {                // estacionado
      car.visible = true; civ.group.visible = false;
      const s = sampleAt(AP, 1); put(car, s.x, s.z, stallAng);
    } else if (tt < b3) {                // caminhando ao balcão
      const s = sampleAt(AP, 1); put(car, s.x, s.z, stallAng); car.visible = true;
      civ.group.visible = true; const p = sampleAt(WK, (tt - b2) / D.walk); put(civ.group, p.x, p.z, p.ang); swing(true, t);
    } else if (tt < b4) {                // fazendo pedido no balcão
      const s = sampleAt(AP, 1); put(car, s.x, s.z, stallAng); car.visible = true;
      civ.group.visible = true; const p = sampleAt(WK, 1); put(civ.group, p.x, p.z, p.ang); swing(false, t);
      civ.arms[0].rotation.x = -0.5 + Math.sin(t * 2 + o.seed) * 0.15; // gesticula no balcão
    } else if (tt < b5) {                // voltando ao carro
      const s = sampleAt(AP, 1); put(car, s.x, s.z, stallAng); car.visible = true;
      civ.group.visible = true; const p = sampleAt(WK, 1 - (tt - b4) / D.walk); put(civ.group, p.x, p.z, p.ang + Math.PI); swing(true, t);
    } else if (tt < b6) {                // indo embora
      car.visible = true; civ.group.visible = false;
      const s = sampleAt(DP, (tt - b5) / D.out); put(car, s.x, s.z, s.ang);
    } else {                             // fora de cena (ocioso)
      car.visible = false; civ.group.visible = false;
    }
  } };
}

/** Pátio externo com grama, rua/loop (asfalto), estacionamento e faixas.
 *  Expandido para envolver a fábrica 104×72. */
export function buildYard(): THREE.Mesh {
  const YW = 180, YD = 150, W = 3600, H = 3000;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d')!;
  const X = (wx: number) => (wx + YW / 2) / YW * W, Z = (wz: number) => (wz + YD / 2) / YD * H, S = (u: number) => (u / YW) * W;
  // grama
  g.fillStyle = '#cde0c4'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(160,195,150,.35)'; for (let i = 0; i < 2200; i++) { const x = Math.random() * W, y = Math.random() * H; g.fillRect(x, y, 3, 7); }
  // asfalto helper
  const road = (x0: number, z0: number, x1: number, z1: number, wpx: number) => { g.strokeStyle = '#5b626e'; g.lineWidth = wpx; g.lineCap = 'square'; g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };
  const rw = S(6);
  // loop externo (retângulo de rua ao redor da fábrica 104×72)
  const L = -66, R = 66, B = -50, F = 50;
  road(L, B, R, B, rw); road(L, F, R, F, rw); road(L, B, L, F, rw); road(R, B, R, F, rw);
  // conectores: entrada de caminhão pela frente (expedição/doca) — 2 pistas
  road(-36, F, -36, 36, rw);
  road(-38, F, -38, 36, rw);
  // entrada de clientes pela frente-centro
  road(-12, F, -12, 36, rw);
  // linhas tracejadas centrais do loop
  g.strokeStyle = '#f3f4f6'; g.lineWidth = 4; g.setLineDash([30, 26]);
  g.strokeRect(X(L), Z(B), X(R) - X(L), Z(F) - Z(B)); g.setLineDash([]);
  // estacionamento (asfalto) dentro da fábrica (frente-centro, entre expedição e escritório)
  g.fillStyle = '#6b7280'; g.fillRect(X(-22), Z(15), X(-2) - X(-22), Z(36) - Z(15));
  // vagas (linhas brancas)
  g.strokeStyle = '#eef2f6'; g.lineWidth = 5;
  for (let x = -20; x <= -4; x += 4) { g.beginPath(); g.moveTo(X(x), Z(16)); g.lineTo(X(x), Z(30)); g.stroke(); }
  g.beginPath(); g.moveTo(X(-22), Z(30)); g.lineTo(X(-2), Z(30)); g.stroke();
  // faixa de pedestre na entrada do escritório
  g.fillStyle = '#f7fafc'; for (let i = 0; i < 5; i++) g.fillRect(X(3) + i * S(1.1), Z(14), S(0.5), S(2.2));
  // setas no loop (frente, indo para a direita)
  g.strokeStyle = 'rgba(245,197,24,.85)'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let x = -50; x <= 50; x += 14) { g.beginPath(); g.moveTo(X(x) - S(1), Z(F) - S(1)); g.lineTo(X(x), Z(F)); g.lineTo(X(x) - S(1), Z(F) + S(1)); g.stroke(); }
  // setas no loop (traseiro, indo para a esquerda)
  for (let x = 50; x >= -50; x -= 14) { g.beginPath(); g.moveTo(X(x) + S(1), Z(B) - S(1)); g.lineTo(X(x), Z(B)); g.lineTo(X(x) + S(1), Z(B) + S(1)); g.stroke(); }

  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(YW, YD), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.y = -0.02; m.receiveShadow = true;
  return m;
}

/** Plaquinha com texto (canvas) para sinalização. */
function signBoard(text: string): THREE.Mesh {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 72; const c = cv.getContext('2d')!;
  c.fillStyle = '#1f2a44'; roundRect(c, 0, 0, 320, 72, 12); c.fill();
  c.fillStyle = '#f26a1b'; c.fillRect(0, 60, 320, 12);
  c.fillStyle = '#fff'; c.font = 'bold 40px "IBM Plex Sans", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 160, 32);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.76), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  return m;
}
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
