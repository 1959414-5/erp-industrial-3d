import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Machine, MachineType, Selection, TabKey } from './data';
import { buildMachine, type MachineModel } from './machines';
import { SheetLots } from './stock';
import { buildOffice } from './office';
import { buildWorker, buildForklift, buildExpedition, buildSheetStack, buildMarker, buildRack,
  buildRoamer, buildSectorSign, buildTruck, buildYard, buildCustomer, buildCar, type Prop } from './props';
import { buildFloor } from './floor';
import { loadIndustrialAsset, type IndustrialAssetKey } from './industrial-assets';

export type WallMode = 'cutaway' | 'high' | 'low';

const TYPE_LABEL: Record<MachineType, string> = {
  laser: 'Corte a laser', plasma: 'Corte a plasma', pressBrake: 'Dobradeira', cnc: 'Usinagem CNC',
  robotWelder: 'Solda robotizada', paintBooth: 'Pintura', punchPress: 'Puncionadeira', bandSaw: 'Serra de fita',
};

/* ── Câmeras por aba ────────────────────────────────────────────────── */
const FOCUS: Record<TabKey, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  producao: { pos: new THREE.Vector3(-12, 41, 28), target: new THREE.Vector3(-12, 0.5, -5) },
  estoque:  { pos: new THREE.Vector3(34.25, 25, 24), target: new THREE.Vector3(34.25, 1.0, -3) },
  comercial:{ pos: new THREE.Vector3(27.25, 25, 33.5), target: new THREE.Vector3(27.25, 0.5, 20.5) },
};
const mat = (color: number, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
const same = (a: Selection | null, b: Selection | null) => a?.kind === b?.kind && a?.index === b?.index;
const ring = (color: number, opacity: number) => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.visible = false; return m;
};

export class Factory {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500);
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private currentPixelRatio = 0;
  private t = 0;
  private goal: { pos: THREE.Vector3; target: THREE.Vector3 } | null = FOCUS.producao;
  private machineGroups: THREE.Group[] = [];
  private models: MachineModel[] = [];
  private statuses: Machine['status'][] = [];
  private cartons: THREE.Mesh[] = [];
  private lots = new SheetLots();
  private office = buildOffice();
  private props: Prop[] = [];
  private assetMixers: THREE.AnimationMixer[] = [];
  private operators: Prop[] = [];
  private machineProps: THREE.Object3D[] = [];
  private markers: Prop[] = [];
  private highWalls: { group: THREE.Group; normal: THREE.Vector3 }[] = [];
  private wallMode: WallMode = 'cutaway';
  private editables: { id: string; object: THREE.Object3D }[] = [];
  private ray = new THREE.Raycaster();
  private selected: Selection | null = null;
  private hover: Selection | null = null;
  private ringSel = ring(0xf26a1b, 0.95);
  private ringHover = ring(0x3b82f6, 0.55);
  private move: PointerEvent | null = null;
  private cameraDragging = false;
  private shadowMode: boolean | null = null;
  private down = { x: 0, y: 0 };
  onHover: (s: Selection | null, x: number, y: number) => void = () => {};
  onPick: (s: Selection | null) => void = () => {};
  onAnchor: (x: number, y: number, visible: boolean) => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    // Reduz o custo de rasterização sem perder nitidez perceptível durante a navegação.
    this.currentPixelRatio = Math.min(devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(this.currentPixelRatio);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera.position.copy(FOCUS.producao.pos);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: true, screenSpacePanning: true, panSpeed: 0.9, minDistance: 14, maxDistance: 180, maxPolarAngle: Math.PI * 0.49 });
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    addEventListener('keydown', (e) => { if (e.key === 'Control') this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN; });
    addEventListener('keyup', (e) => { if (e.key === 'Control') this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE; });
    this.controls.target.copy(FOCUS.producao.target);
    this.controls.addEventListener('start', () => {
      this.goal = null;
      this.cameraDragging = true;
      this.move = null;
      this.hover = null;
      this.place(this.ringHover, null);
      this.onHover(null, 0, 0);
    });
    this.controls.addEventListener('end', () => {
      this.cameraDragging = false;
      this.move = null;
    });
    this.buildLights(); this.buildWorld(); this.scene.add(this.ringSel, this.ringHover);
    addEventListener('resize', () => this.resize());
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      const observer = new ResizeObserver(() => this.resize());
      observer.observe(canvas.parentElement);
    }
    this.resize();
    canvas.addEventListener('pointermove', (e) => { this.move = e; });
    canvas.addEventListener('pointerdown', (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 6) this.select(this.hit(e));
    });
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Registra um objeto da cena com id estável (usado para filtrar/atualizar as máquinas ao trocar os dados). */
  private addEditable(id: string, object: THREE.Object3D) {
    this.editables.push({ id, object });
  }

  private buildLights() {
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.98;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc4cbd4, 1.05));
    const sun = new THREE.DirectionalLight(0xfff7f0, 1.45); sun.position.set(-30, 52, 36); sun.castShadow = true;
    // 2048² mantém sombras definidas com custo de GPU bem menor que 4096².
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -64, right: 64, top: 50, bottom: -50, near: 1, far: 200 });
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.035; sun.shadow.radius = 3.5; this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xe7ebf0, 0.35); fill.position.set(32, 28, -22); this.scene.add(fill);
  }

  setWallMode(mode: WallMode) {
    this.wallMode = mode;
    if (mode !== 'cutaway') this.highWalls.forEach((w) => (w.group.visible = mode === 'high'));
  }
  private updateCutaway() {
    const c = this.camera.position;
    for (const w of this.highWalls) w.group.visible = w.normal.dot(c) < 0;
  }

  /* ═══════════════════════════════════════════════════════════════════
     MONTAGEM DA CENA — layout 104 × 72 (referência HTML)
     ═══════════════════════════════════════════════════════════════════ */
  private buildWorld() {
    // pátio externo (grama, rua/loop, estacionamento)
    this.scene.add(buildYard());
    // base do piso 104 × 72 + chão pintado
    this.scene.add(box(104, 0.5, 72, mat(0xd5dae1), 0, -0.5, 0));
    this.scene.add(buildFloor());

    // ── muros baixos (perímetro) — frente aberta ─────────────────
    const wallMat = mat(0xd6dbe1, 0.85), cap = mat(0xe96b2c, 0.5);
    const lowWall = (w: number, d: number, x: number, z: number) => {
      this.scene.add(box(w, 0.7, d, wallMat, x, 0, z));
      this.scene.add(box(w + 0.03, 0.06, d + 0.03, cap, x, 0.7, z));
    };
    lowWall(104, 0.3, 0, -36);          // fundo
    lowWall(0.3, 72, -52, 0);           // esquerda
    lowWall(0.3, 72, 52, 0);            // direita
    // frente aberta em z = +36 (doca/expedição, estacionamento, escritório)

    // ── paredes altas alternáveis (corte / altas / baixas) ───────
    this.buildHighWalls();

    // ── ESTOQUE — porta-paletes altos + lotes de chapas ──────────
    this.scene.add(this.lots.group);
    // Roots permanecem estáveis para preservar edição/seleção; o GLB entra como conteúdo visual.
    const stkRack1 = new THREE.Group(); stkRack1.add(buildRack(13.5)); stkRack1.position.set(43.5, 0, -31.5); this.scene.add(stkRack1);
    const stkRack2 = new THREE.Group(); stkRack2.add(buildRack(13.2)); stkRack2.position.set(27.0, 0, -18.5); this.scene.add(stkRack2);
    const stkRack3 = new THREE.Group(); stkRack3.add(buildRack(13.5)); stkRack3.position.set(43.5, 0, -18.5); this.scene.add(stkRack3);
    this.addEditable('rack-stock-1', stkRack1); this.addEditable('rack-stock-2', stkRack2); this.addEditable('rack-stock-3', stkRack3);
    void this.replaceRackModules(stkRack1, 'palletRack', 4, 3.2, 3.2);
    void this.replaceRackModules(stkRack2, 'palletRack', 4, 3.15, 3.2);
    void this.replaceRackModules(stkRack3, 'palletRack', 4, 3.2, 3.2);

    // ── MATÉRIA-PRIMA — estantes para chapas ──────────────────────
    const rawA = new THREE.Group(); rawA.add(buildRack(14)); rawA.position.set(-26, 0, -16); this.scene.add(rawA);
    const rawB = new THREE.Group(); rawB.add(buildRack(14)); rawB.position.set(-4, 0, -16);  this.scene.add(rawB);
    this.addEditable('rack-raw-a', rawA); this.addEditable('rack-raw-b', rawB);
    void this.replaceRackModules(rawA, 'sheetRack', 4, 3.45, 2.75);
    void this.replaceRackModules(rawB, 'sheetRack', 4, 3.45, 2.75);

    // ── ESCRITÓRIO COMERCIAL (frente-direita, 3 salas) ───────────
    this.office.group.position.set(27.25, 0, 20.5);
    this.scene.add(this.office.group);
    for (const ed of this.office.editables) this.addEditable(ed.id, ed.object);

    // ── EXPEDIÇÃO (frente-esquerda) — doca + paletes ─────────────
    const exp = buildExpedition(); exp.position.set(-36.5, 0, 24.5);
    this.scene.add(exp);
    this.addEditable('expedition', exp);
    // caminhões animados na doca (chegam, encostam, carregam e saem) — pista de ENTRADA
    // (z=48.5) e pista de SAÍDA (z=51) são sempre linhas distintas, então nenhum caminhão
    // que esteja chegando cruza de frente outro que esteja saindo, mesmo fora de sincronia.
    const truckRoutes: { in: [number,number][]; out: [number,number][]; speed: number; offset: number }[] = [
      { in:  [[-66, 48.5], [-36, 48.5], [-36, 36], [-36, 27]],
        out: [[-36, 27], [-36, 36], [-36, 51], [-66, 51]], speed: 4.0, offset: 0 },
      { in:  [[-66, 48.5], [-38, 48.5], [-38, 36], [-38, 25]],
        out: [[-38, 25], [-38, 36], [-38, 51], [-66, 51]], speed: 3.5, offset: 24 },
    ];
    for (const tr of truckRoutes) {
      const tk = this.buildAnimTruck(tr.in, tr.out, tr.speed, tr.offset);
      this.props.push(tk); this.scene.add(tk.group);
    }

    // ── CLIENTES: carro → estacionamento → escritório (loop) ─────
    // Cada carro tem sua PRÓPRIA faixa dentro do conector de clientes (x=-15..-9), e a pista
    // de entrada (z=48.5) nunca é a mesma linha da pista de saída (z=51) — elimina colisão
    // de frente tanto entre os 2 carros quanto entre ida/volta do mesmo carro.
    // Balcão da recepção fica encostado no fundo (local z≈-6,45 → mundo z≈14); clientes ficam na frente dele
    // (lado +z), lado a lado, voltados para o balcão. Entram pela porta (mundo x=5,5 z=17) e sobem até lá.
    const counterA: [number, number] = [11.5, 15], counterB: [number, number] = [13.5, 15];
    const customers: Parameters<typeof buildCustomer>[0][] = [
      { carColor: 0x2563c9, seed: 21, offset: 0,
        approach: [[63, 48.5], [-14, 48.5], [-14, 36], [-14, 33], [-13, 24]], stallAng: Math.PI * 0.5,
        walk: [[-12.5, 23], [-5, 20], [5.5, 17], [11.5, 16.3], counterA],
        depart: [[-13, 24], [-14, 33], [-14, 36], [-14, 51], [63, 51]] },
      { carColor: 0xd7262c, seed: 34, offset: 19,
        approach: [[63, 48.5], [-10, 48.5], [-10, 36], [-10, 33], [-10.5, 24]], stallAng: Math.PI * 0.5,
        walk: [[-10, 23], [-5, 20], [5.5, 17], [13.5, 16.3], counterB],
        depart: [[-10.5, 24], [-10, 33], [-10, 36], [-10, 51], [63, 51]] },
    ];
    for (const c of customers) {
      const cu = buildCustomer(c); this.props.push(cu); this.scene.add(cu.group);
    }

    // ── placas de setor ──────────────────────────────────────────
    const signs: [string, number, number, number][] = [
      ['PRODUÇÃO',  0x3b82f6, -15,  6],
      ['ESTOQUE',   0xf26a1b,  35, -8],
      ['EXPEDIÇÃO', 0x22b573, -36, 16],
    ];
    for (const [t, c, x, z] of signs) {
      const s = buildSectorSign(t as string, c as number);
      s.position.set(x as number, 0, z as number); this.scene.add(s);
      this.addEditable(`sign-${(t as string).toLowerCase()}`, s);
    }

    // ── cones de segurança nos cruzamentos ───────────────────────
    const coneSpots: [number, number][] = [[-38, -19.5], [15.8, -19.5], [15.8, 8], [-25, 15], [-48, 33], [-25, 33]];
    coneSpots.forEach(([x, z], i) => {
      const c = this.cone(x, z); this.scene.add(c); this.addEditable(`cone-${i}`, c);
    });

    // ── empilhadeiras nos corredores ─────────────────────────────
    const routes: { path: [number, number][]; speed?: number; carry?: boolean }[] = [
      { path: [[-38, -30], [-38, 5]],       speed: 2.6, carry: true },   // corredor lateral esq.
      { path: [[15.8, -28], [15.8, 8]],     speed: 3.0, carry: false },  // corredor empilhadeira (prod↔est)
      { path: [[-38, -19.5], [14, -19.5]],  speed: 2.8, carry: true },   // corredor traseiro
    ];
    for (const r of routes) {
      const f = buildForklift(r); this.props.push(f); this.scene.add(f.group); void this.replaceMovingForklift(f.group);
    }

    // ── trabalhadores caminhando (rotas SEPARADAS das empilhadeiras) ──
    const walkers: { path: [number, number][]; seed: number; speed: number }[] = [
      // corredor pedestre paralelo ao traseiro (z=-22 em vez de -19.5)
      { path: [[-40, -22], [14, -22]],  seed: 3,  speed: 1.4 },
      // corredor pedestre lateral (x=13 em vez de 15.8)
      { path: [[13, -25], [13, 5]],     seed: 8,  speed: 1.1 },
      // corredor frontal (faixa de pedestre)
      { path: [[-45, 13], [-25, 13], [4, 13]], seed: 14, speed: 1.3 },
      // pedestre entre escritório e estoque (x=4 para não colar na parede do escritório em x=5.5)
      { path: [[4, 12], [4, 28]],       seed: 20, speed: 1.0 },
    ];
    for (const w of walkers) {
      const r = buildRoamer(w.path, w.seed, w.speed); this.props.push(r); this.scene.add(r.group);
    }

    // ── carros estacionados no parking (nas vagas corretas) ─────
    const parkColors = [0x9ca3af, 0x1d4ed8, 0x15803d, 0x7c3aed, 0xdc2626, 0xf59e0b];
    // fileira de cima (z≈18.5, virados para norte) e fileira de baixo (z≈30.5, virados para sul)
    const parkSpots: [number, number, number][] = [
      [-19, 18.5, 0],  [-15, 18.5, 0],  [-7, 18.5, 0],     // fileira de cima
      [-19, 30.5, Math.PI], [-11, 30.5, Math.PI], [-7, 30.5, Math.PI],  // fileira de baixo
    ];
    for (let i = 0; i < parkSpots.length; i++) {
      const [px, pz, ry] = parkSpots[i];
      const pc = buildCar(parkColors[i]); pc.position.set(px, 0, pz);
      pc.rotation.y = ry; pc.scale.setScalar(1.0);
      this.scene.add(pc);
      this.addEditable(`parkedcar-${i}`, pc);
    }
  }

  /** Três paredes altas (fundo, esq, dir) + pilares; frente aberta. */
  private buildHighWalls() {
    const wm = mat(0xe3e9f2, 0.9), capm = mat(0x9fb0c7, 0.6), pil = mat(0xcad2de, 0.5);
    const HH = 5.0;
    const side = (w: number, d: number, x: number, z: number, normal: THREE.Vector3, pil0: [number, number][]) => {
      const grp = new THREE.Group();
      grp.add(box(w, HH, d, wm, x, 0, z), box(w + 0.04, 0.12, d + 0.04, capm, x, HH, z));
      for (const [px, pz] of pil0) grp.add(box(0.6, HH + 0.2, 0.6, pil, px, 0, pz));
      grp.visible = this.wallMode === 'high'; this.scene.add(grp);
      this.highWalls.push({ group: grp, normal });
    };
    // fundo z = -36
    side(104, 0.3, 0, -36, new THREE.Vector3(0, 0, -1),
      [[-51, -36], [-34, -36], [-17, -36], [0, -36], [17, -36], [34, -36], [51, -36]]);
    // esquerda x = -52
    side(0.3, 72, -52, 0, new THREE.Vector3(-1, 0, 0),
      [[-52, -35], [-52, -17.5], [-52, 0], [-52, 17.5], [-52, 35]]);
    // direita x = +52
    side(0.3, 72, 52, 0, new THREE.Vector3(1, 0, 0),
      [[52, -35], [52, -17.5], [52, 0], [52, 17.5], [52, 35]]);
  }

  /** Cone de segurança laranja/branco. */
  private cone(x: number, z: number) {
    const g = new THREE.Group();
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 18), new THREE.MeshStandardMaterial({ color: 0xf26a1b, roughness: 0.6 }));
    c1.position.y = 0.3; g.add(c1);
    g.add(box(0.5, 0.05, 0.5, new THREE.MeshStandardMaterial({ color: 0xf26a1b, roughness: 0.6 }), 0, 0, 0));
    const rng = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.1, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    rng.position.y = 0.34; g.add(rng);
    g.position.set(x, 0, z); g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  /** Ajusta um GLB ao envelope visual do equipamento sem mudar o root de seleção. */
  private fitImportedModel(model: THREE.Group, maxFootprint: number, maxHeight: number) {
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const footprint = Math.max(size.x, size.z, 0.001);
    const height = Math.max(size.y, 0.001);
    const scale = Math.min(maxFootprint / footprint, maxHeight / height);
    model.scale.multiplyScalar(scale);
    const fitted = new THREE.Box3().setFromObject(model);
    model.position.y -= fitted.min.y;
  }

  /** Efeito de arco e respingos sincronizado ao status da célula de solda. */
  private createWeldingArcEffect(model: THREE.Group): (dt: number, status: Machine['status']) => void {
    const effect = new THREE.Group();
    effect.name = 'welding-arc-effect';
    // O GLB original usa Z como eixo vertical; loadIndustrialAsset converte para Y-up.
    // O arco fica na altura aproximada do gabarito/peça de trabalho.
    effect.position.set(0, 0, 0.98);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffa04a, transparent: true, opacity: 0.95 })
    );
    effect.add(core);

    const sparks = Array.from({ length: 7 }, (_, index) => {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.018 + (index % 3) * 0.004, 7, 6),
        new THREE.MeshBasicMaterial({ color: 0xe96b2c, transparent: true, opacity: 0.9 })
      );
      effect.add(spark);
      return spark;
    });
    model.add(effect);

    let elapsed = 0;
    return (dt, status) => {
      elapsed += dt;
      const active = status === 'run';
      effect.visible = active;
      if (!active) return;

      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 34);
      core.scale.setScalar(0.72 + pulse * 0.55);
      sparks.forEach((spark, index) => {
        const phase = elapsed * (4.2 + index * 0.31) + index * 1.71;
        spark.position.set(
          Math.sin(phase) * (0.055 + (index % 3) * 0.025),
          Math.abs(Math.sin(phase * 1.37)) * (0.07 + (index % 2) * 0.045),
          Math.cos(phase * 1.13) * 0.06
        );
        const fade = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(phase * 2.4));
        spark.scale.setScalar(fade);
      });
    };
  }
  /** Substitui apenas o conteúdo visual; o grupo raiz, índice, posição e eventos permanecem iguais. */
  private async replaceMachineVisual(index: number, key: IndustrialAssetKey) {
    const root = this.machineGroups[index];
    if (!root) return;
    try {
      const asset = await loadIndustrialAsset(key);
      if (this.machineGroups[index] !== root || !root.parent) return;

      const maxFootprint = key === 'roboticWeldingCell' ? 5.25 : key === 'plasmaCutter' ? 5.55 : key === 'bandSaw' ? 3.5 : 4.0;
      const maxHeight = key === 'roboticWeldingCell' ? 2.7 : key === 'plasmaCutter' ? 2.9 : key === 'bandSaw' ? 2.65 : 3.1;
      this.fitImportedModel(asset.scene, maxFootprint, maxHeight);
      root.clear();
      root.add(asset.scene);

      if (key === 'roboticWeldingCell') {
        const updateArc = this.createWeldingArcEffect(asset.scene);
        this.models[index] = { group: root, update: updateArc };
        return;
      }

      const clip = key === 'bandSaw'
        ? asset.animations.find((item) => /blade|spin|saw/i.test(item.name))
        : undefined;
      if (clip) {
        const mixer = new THREE.AnimationMixer(asset.scene);
        const action = mixer.clipAction(clip);
        this.models[index] = {
          group: root,
          update: (dt, status) => {
            if (status === 'run') {
              if (!action.isRunning()) action.reset().play();
              mixer.update(dt);
            } else if (action.isRunning()) {
              action.stop();
            }
          },
        };
      } else {
        this.models[index] = { group: root, update: () => {} };
      }
    } catch (error) {
      // O equipamento procedural continua visível se a rede/CDN estiver indisponível.
      console.warn(`Não foi possível carregar o modelo GLB ${key}; mantendo o modelo local.`, error);
    }
  }

  /** Carrega um conjunto de módulos GLB dentro do mesmo root de layout/edição. */
  private async replaceRackModules(root: THREE.Group, key: 'palletRack' | 'sheetRack', count: number, spacing: number, targetHeight: number) {
    try {
      const asset = await loadIndustrialAsset(key);
      if (!root.parent) return;
      this.fitImportedModel(asset.scene, spacing * 0.94, targetHeight);
      root.clear();
      for (let i = 0; i < count; i++) {
        const module = asset.scene.clone(true);
        module.position.x = (i - (count - 1) / 2) * spacing;
        root.add(module);
      }
    } catch (error) {
      console.warn(`Não foi possível carregar a estante GLB ${key}; mantendo a estante local.`, error);
    }
  }

  /** Troca o modelo das empilhadeiras sem alterar o movimento/rota já calculado no root. */
  private async replaceMovingForklift(root: THREE.Group) {
    try {
      const asset = await loadIndustrialAsset('forklift');
      if (!root.parent) return;

      // O modelo da biblioteca usa o eixo +Z como frente; as rotas existentes usam +X.
      asset.scene.rotation.y = Math.PI / 2;
      this.fitImportedModel(asset.scene, 3.45, 2.7);
      root.clear();
      root.add(asset.scene);

      const clip = asset.animations.find((item) => /wheel|roll|drive/i.test(item.name));
      if (clip) {
        const mixer = new THREE.AnimationMixer(asset.scene);
        mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
        this.assetMixers.push(mixer);
      }
    } catch (error) {
      console.warn('Não foi possível carregar a empilhadeira GLB; mantendo o modelo local.', error);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     MÁQUINAS — layout de referência (2 fileiras)
     Fileira superior z = -11.5: laser×3, dobradeira×2, CNC×3
     Fileira inferior z = +2.5 : solda×3, pintura×2, puncionadeira×1, serra×1
     ═══════════════════════════════════════════════════════════════════ */
  setMachines(ms: Machine[]) {
    this.machineGroups.forEach((g) => this.scene.remove(g));
    this.operators.forEach((o) => this.scene.remove(o.group));
    this.machineProps.forEach((p) => this.scene.remove(p));
    this.markers.forEach((m) => this.scene.remove(m.group));
    this.machineGroups = []; this.models = []; this.statuses = []; this.operators = []; this.machineProps = []; this.markers = [];
    const kept = this.editables.filter((e) => !/^(machine|stack|marker)-/.test(e.id));
    this.editables.splice(0, this.editables.length, ...kept);
    const seen = new Set<MachineType>();
    const fallback: MachineType[] = ['laser', 'laser', 'laser', 'pressBrake', 'pressBrake', 'cnc', 'cnc', 'cnc', 'robotWelder', 'robotWelder', 'robotWelder', 'paintBooth', 'paintBooth', 'punchPress', 'bandSaw'];
    // Posições extraídas do layout de referência
    const BACK_Z = -11.5, FRONT_Z = 2.5;
    const backX  = [-33, -27, -21, -14.5, -8.5, -2, 4, 10];   // 8 máq. (fileira superior)
    const frontX = [-33, -26.5, -20, -12.5, -5.5, 2, 9.5];     // 7 máq. (fileira inferior)
    ms.slice(0, 15).forEach((m, i) => {
      const ty = (m.type ?? fallback[i % fallback.length]);
      const model = buildMachine(ty);
      const back = i < 8;
      const mx = back ? backX[i] : frontX[i - 8];
      const mz = back ? BACK_Z : FRONT_Z;
      model.group.position.set(mx, 0, mz);
      model.group.rotation.y = back ? 0 : Math.PI;
      this.scene.add(model.group); this.machineGroups.push(model.group); this.models.push(model); this.statuses.push(m.status);
      this.addEditable(`machine-${i}`, model.group);
      const importedType: IndustrialAssetKey | null = ty === 'cnc' ? 'cnc'
        : ty === 'pressBrake' ? 'pressBrake'
          : ty === 'bandSaw' ? 'bandSaw'
            : ty === 'plasma' ? 'plasmaCutter'
              : ty === 'robotWelder' ? 'roboticWeldingCell' : null;
      if (importedType) void this.replaceMachineVisual(i, importedType);
      // operador no lado do corredor
      const opZ = back ? mz + 2.8 : mz - 2.8;
      const op = buildWorker(i + 1); op.group.position.set(mx, 0, opZ); op.group.rotation.y = back ? Math.PI : 0;
      this.scene.add(op.group); this.operators.push(op);
      // pilha de chapas no lado externo
      const stackZ = back ? mz - 2.8 : mz + 2.8;
      const stack = buildSheetStack(5); stack.scale.setScalar(0.65); stack.position.set(mx, 0, stackZ);
      this.scene.add(stack); this.machineProps.push(stack);
      this.addEditable(`stack-${i}`, stack);
      // pino flutuante com status (cor) e rótulo no 1º de cada tipo
      const color = m.status === 'run' ? 0x22b573 : m.status === 'down' ? 0xe5484d : 0xf5b83d;
      const label = seen.has(ty) ? null : TYPE_LABEL[ty]; seen.add(ty);
      const mk = buildMarker(label, color); mk.group.position.set(mx, 4.2, mz);
      this.scene.add(mk.group); this.markers.push(mk);
      this.addEditable(`marker-${i}`, mk.group);
    });
  }
  setOccupancy(values: number[], states: string[] = []) { this.lots.setOccupancy(values, states); }
  focus(tab: TabKey) { this.goal = { pos: FOCUS[tab].pos.clone(), target: FOCUS[tab].target.clone() }; }

  /** Seleciona e leva a câmera até o objeto (usado pelo assistente de IA). */
  focusSelection(sel: Selection) {
    this.select(sel);
    const c = this.foot(sel).c.clone(); c.y = 0.8;
    const off = sel.kind === 'machine' ? new THREE.Vector3(6, 7, 9) : sel.kind === 'lot' ? new THREE.Vector3(5, 6.5, 8) : new THREE.Vector3(2.5, 6, 8.5);
    this.goal = { pos: c.clone().add(off), target: c };
  }
  /** Teleport camera instantly (no animation) */
  teleport(px: number, py: number, pz: number, tx: number, ty: number, tz: number) {
    this.goal = null;
    this.camera.position.set(px, py, pz);
    this.controls.target.set(tx, ty, tz);
    this.controls.update();
  }

  /** Amostrador de polilinha: devolve {total, sample(u)} para um caminho [x,z][]. */
  private static pathSampler(path: [number, number][]) {
    const pts = path.map(([x, z]) => new THREE.Vector2(x, z));
    const seg: number[] = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); seg.push(l); total += l; }
    total = total || 1;
    const sample = (u: number) => {
      const s = Math.max(0, Math.min(1, u)) * total; let acc = 0;
      for (let i = 0; i < seg.length; i++) {
        if (s <= acc + seg[i] || i === seg.length - 1) {
          const uu = seg[i] ? (s - acc) / seg[i] : 0;
          const p = pts[i].clone().lerp(pts[i + 1], uu);
          const d = pts[i + 1].clone().sub(pts[i]).normalize();
          return { x: p.x, z: p.y, ang: Math.atan2(d.x, d.y) };
        }
        acc += seg[i];
      }
      return { x: pts[0].x, z: pts[0].y, ang: 0 };
    };
    return { total, sample };
  }

  /** Caminhão animado: chega pela rua (pista de entrada), encosta na doca, espera (carrega) e
   *  sai pela MESMA via x da doca, mas pela pista de saída (z diferente) — nunca cruza de frente
   *  outro veículo que esteja entrando. */
  private buildAnimTruck(inPath: [number, number][], outPath: [number, number][], speed: number, offset: number): Prop {
    const g = new THREE.Group();
    const truck = buildTruck(); g.add(truck);
    const inS = Factory.pathSampler(inPath);
    const outS = Factory.pathSampler(outPath);
    const driveIn = inS.total / speed, park = 12, driveOut = outS.total / speed, idle = 10;
    const T = driveIn + park + driveOut + idle;
    return { group: g, update(t: number) {
      const tt = (((t + offset) % T) + T) % T;
      if (tt < driveIn) {                             // chegando
        truck.visible = true;
        const s = inS.sample(tt / driveIn); g.position.set(s.x, 0, s.z); g.rotation.y = s.ang;
      } else if (tt < driveIn + park) {              // estacionado na doca
        truck.visible = true;
        const s = inS.sample(1); g.position.set(s.x, 0, s.z); g.rotation.y = s.ang + Math.PI;
      } else if (tt < driveIn + park + driveOut) {   // saindo
        truck.visible = true;
        const s = outS.sample((tt - driveIn - park) / driveOut); g.position.set(s.x, 0, s.z); g.rotation.y = s.ang;
      } else {                                        // fora de cena
        truck.visible = false;
      }
    }};
  }

  select(sel: Selection | null) {
    this.selected = sel; this.place(this.ringSel, sel);
    if (same(sel, this.hover)) this.ringHover.visible = false;
    this.onPick(sel);
  }

  private rootIndex(o: THREE.Object3D, groups: THREE.Object3D[]) { let c: THREE.Object3D | null = o; while (c && !groups.includes(c)) c = c.parent; return c ? groups.indexOf(c) : -1; }

  private hit(e: PointerEvent): Selection | null {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    let best: { d: number; s: Selection } | null = null;
    const take = (d: number, s: Selection) => { if (!best || d < best.d) best = { d, s }; };
    const m = this.ray.intersectObjects(this.machineGroups, true)[0]; if (m) take(m.distance, { kind: 'machine', index: this.rootIndex(m.object, this.machineGroups) });
    const v = this.ray.intersectObjects(this.office.sellers, true)[0]; if (v) take(v.distance, { kind: 'seller', index: this.rootIndex(v.object, this.office.sellers) });
    const l = this.lots.pick(this.ray); if (l) take(l.distance, { kind: 'lot', index: l.index });
    return (best as { d: number; s: Selection } | null)?.s ?? null;
  }

  private foot(s: Selection) {
    if (s.kind === 'machine') {
      const root = this.machineGroups[s.index];
      const c = root.position.clone();
      const bounds = new THREE.Box3().setFromObject(root);
      const top = Number.isFinite(bounds.max.y) ? bounds.max.y : 3.1;
      return { c, a: 1.9, b: 1.5, anchor: new THREE.Vector3(c.x, top + 0.42, c.z) };
    }
    if (s.kind === 'lot') {
      const c = this.lots.center(s.index);
      return { c, a: 1.45, b: 1.0, anchor: c.clone().setY(this.lots.top(s.index) + 0.4) };
    }
    const w = new THREE.Vector3(); this.office.sellers[s.index].getWorldPosition(w);
    return { c: w.clone().add(new THREE.Vector3(0, 0, 0.45)), a: 1.2, b: 1.5, anchor: w.clone().add(new THREE.Vector3(0, 2.0, 0.95)) };
  }
  private place(r: THREE.Mesh, s: Selection | null) {
    if (!s) { r.visible = false; return; }
    const f = this.foot(s); r.position.set(f.c.x, 0.04, f.c.z); r.scale.set(f.a, f.b, 1); r.visible = true;
  }

  private resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1); this.t += dt; const t = this.t;
    // Em visão geral, a fábrica inteira fica visível. Reduzimos a resolução de
    // renderização e suspendemos o passe de sombras, que é o custo mais alto nesse enquadramento.
    const cameraDistance = this.camera.position.distanceTo(this.controls.target);
    // Durante gestos e transições de câmera, prioriza fluidez sobre nitidez.
    // A resolução volta ao nível normal assim que a navegação termina.
    const cameraNavigating = this.cameraDragging || this.goal !== null;
    const targetPixelRatio = cameraNavigating ? Math.min(devicePixelRatio, 0.68)
      : cameraDistance > 85 ? Math.min(devicePixelRatio, 0.7)
        : cameraDistance > 38 ? Math.min(devicePixelRatio, 0.9)
          : Math.min(devicePixelRatio, 1.15);
    if (Math.abs(targetPixelRatio - this.currentPixelRatio) > 0.05) {
      this.currentPixelRatio = targetPixelRatio;
      this.renderer.setPixelRatio(targetPixelRatio);
      const rect = this.canvas.parentElement?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect();
      this.renderer.setSize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), false);
    }
    // Sombras são o passe mais caro da cena. Não as calcula durante gestos
    // nem enquanto a câmera está interpolando para Produção/Estoque/Comercial.
    const enableShadows = cameraDistance <= 40 && !cameraNavigating;
    if (this.shadowMode !== enableShadows) {
      this.shadowMode = enableShadows;
      this.renderer.shadowMap.enabled = enableShadows;
      if (enableShadows) this.renderer.shadowMap.needsUpdate = true;
    }
    if (this.move && !this.cameraDragging) {
      const e = this.move; this.move = null; const h = this.hit(e);
      if (!same(h, this.hover)) { this.hover = h; this.place(this.ringHover, same(h, this.selected) ? null : h); }
      this.canvas.style.cursor = h ? 'pointer' : 'grab'; this.onHover(h, e.clientX, e.clientY);
    }
    if (this.goal) {
      // Transição mais responsiva: reduz a sensação de atraso ao trocar de módulo.
      this.camera.position.lerp(this.goal.pos, 0.19); this.controls.target.lerp(this.goal.target, 0.19);
      if (this.camera.position.distanceTo(this.goal.pos) < 0.05) this.goal = null;
    }
    if (this.wallMode === 'cutaway') this.updateCutaway();
    this.cartons.forEach((c, i) => { c.position.x = ((t * 1.6 + i * 2.5) % 30) - 20; });
    // Mantém todas as animações ativas em qualquer distância de câmera.
    // As rotinas recebem o tempo global (t), então continuam sincronizadas
    // mesmo durante zoom e transições entre os módulos.
    this.models.forEach((m, i) => m.update(dt, this.statuses[i]));
    this.operators.forEach((o) => o.update(t));
    this.markers.forEach((m) => m.update(t));
    this.props.forEach((p) => p.update(t));
    this.office.update(t);
    this.assetMixers.forEach((mixer) => mixer.update(dt));
    if (this.selected) {
      const projected = this.foot(this.selected).anchor.clone().project(this.camera);
      const rect = this.canvas.getBoundingClientRect();
      const x = rect.left + (projected.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-projected.y * 0.5 + 0.5) * rect.height;
      const inFront = projected.z >= -1 && projected.z <= 1;
      const insideFrame = projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1;
      this.onAnchor(x, y, inFront && insideFrame);
      this.ringSel.material.opacity = 0.7 + 0.25 * Math.sin(t * 4);
    }
    this.controls.update(); this.renderer.render(this.scene, this.camera);
  }
}
