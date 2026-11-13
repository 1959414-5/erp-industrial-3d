import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { buildCabinet, buildSofa, buildCoffeeTable, buildWaitChair, buildProductDisplay,
  buildCounter, buildPrinter, buildWaterCooler, buildRack } from './props';

// ═══════════════════════════════════════════════════════════════════════
// EDITOR DE CENA — modo de edição manual: selecionar, mover, girar, escalar,
// colorir, agrupar e adicionar objetos, com tudo salvo automaticamente no
// navegador (localStorage), para persistir entre sessões sem precisar editar
// código.
// ═══════════════════════════════════════════════════════════════════════

export interface Editable { id: string; object: THREE.Object3D }

type PrimitiveShape = 'box' | 'cylinder' | 'sphere' | 'cone' | 'rack' | 'cabinet' | 'sofa' | 'table' | 'waitchair' | 'product' | 'counter' | 'printer' | 'watercooler';

const SHAPE_LABEL: Record<PrimitiveShape, string> = {
  box: 'Caixa', cylinder: 'Cilindro', sphere: 'Esfera', cone: 'Cone',
  rack: 'Estante', cabinet: 'Armário', sofa: 'Sofá', table: 'Mesinha',
  waitchair: 'Cadeira', product: 'Vitrine de produto', counter: 'Balcão',
  printer: 'Impressora', watercooler: 'Bebedouro',
};

interface TRS { pos: [number, number, number]; rot: [number, number, number]; scale: [number, number, number] }
interface EditRecord extends TRS { id: string; color?: number; hidden?: boolean }
interface GroupRecord extends TRS { id: string; members: (TRS & { id: string })[] }
interface AddedRecord extends TRS {
  id: string; kind: 'primitive' | 'clone'; shape?: PrimitiveShape; sourceId?: string; color?: number; hidden?: boolean;
}
interface SaveFile { edits: EditRecord[]; groups: GroupRecord[]; added: AddedRecord[] }

const STORAGE_KEY = 'erp3d-scene-edits-v1';
const trs = (o: THREE.Object3D): TRS => ({
  pos: [o.position.x, o.position.y, o.position.z],
  rot: [o.rotation.x, o.rotation.y, o.rotation.z],
  scale: [o.scale.x, o.scale.y, o.scale.z],
});
const applyTrs = (o: THREE.Object3D, t: TRS) => {
  o.position.set(...t.pos); o.rotation.set(...t.rot); o.scale.set(...t.scale);
};

export class SceneEditor {
  active = false;
  private xform: TransformControls;
  private ray = new THREE.Raycaster();
  private selected: THREE.Object3D[] = [];
  private helpers: THREE.BoxHelper[] = [];
  private colorOverrides = new Map<string, number>();
  private addedMeta = new Map<string, { kind: 'primitive' | 'clone'; shape?: PrimitiveShape; sourceId?: string }>();
  private groupSeq = 0; private addedSeq = 0;
  private saveTimer: number | null = null;
  private down = { x: 0, y: 0 };
  private dom!: {
    toggle: HTMLButtonElement; panel: HTMLElement; hint: HTMLElement;
    modeBtns: Record<'translate' | 'rotate' | 'scale', HTMLButtonElement>;
    color: HTMLInputElement; group: HTMLButtonElement; ungroup: HTMLButtonElement;
    dup: HTMLButtonElement; remove: HTMLButtonElement; addSel: HTMLSelectElement; addBtn: HTMLButtonElement;
    reset: HTMLButtonElement; status: HTMLElement;
  };

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private canvas: HTMLCanvasElement,
    private orbit: OrbitControls,
    private registry: Editable[],
  ) {
    this.xform = new TransformControls(camera, canvas);
    this.xform.setSize(0.9);
    this.scene.add(this.xform.getHelper());
    this.xform.getHelper().visible = false;
    this.xform.addEventListener('dragging-changed', (ev: any) => { this.orbit.enabled = !ev.value; });
    this.xform.addEventListener('objectChange', () => { this.refreshHelpers(); this.scheduleSave(); });

    this.buildDom();
    canvas.addEventListener('pointerdown', (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.key === 'Escape') this.setSelection([]);
      else if (e.key === 'g' || e.key === 'G') this.setMode('translate');
      else if (e.key === 'r' || e.key === 'R') this.setMode('rotate');
      else if (e.key === 'e' || e.key === 'E') this.setMode('scale');
      else if (e.key === 'Delete' || e.key === 'Backspace') this.removeSelected();
    });

    this.applySaved();
  }

  /** Chamado a cada frame pelo loop principal (atualiza o contorno de seleção). */
  tick() { this.helpers.forEach((h) => h.update()); }

  // ── UI ────────────────────────────────────────────────────────────
  private buildDom() {
    const style = document.createElement('style');
    style.textContent = `
      .sed-toggle{position:fixed;right:32px;bottom:24px;z-index:20;border:0;border-radius:999px;padding:12px 20px;
        font:700 13px Inter,system-ui,sans-serif;cursor:pointer;background:rgba(255,255,255,.85);color:#1f2a44;
        box-shadow:0 10px 28px rgba(124,141,181,.3);backdrop-filter:blur(14px);transition:.15s}
      .sed-toggle.on{background:#d7262c;color:#fff}
      .sed-panel{position:fixed;right:32px;bottom:76px;z-index:20;width:280px;max-height:72vh;overflow:auto;
        background:rgba(255,255,255,.92);backdrop-filter:blur(18px) saturate(1.2);border:1px solid rgba(255,255,255,.9);
        border-radius:18px;box-shadow:0 14px 40px rgba(124,141,181,.28);padding:16px 18px;font:500 12.5px/1.4 Inter,system-ui,sans-serif;
        color:#1f2a44;display:none}
      .sed-panel.on{display:block}
      .sed-panel h4{margin:0 0 8px;font-size:13px}
      .sed-hint{color:#6b7690;font-size:11px;margin-bottom:12px}
      .sed-row{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
      .sed-row label{font-size:11px;color:#6b7690;width:100%;margin-bottom:2px}
      .sed-btn{flex:1;border:0;border-radius:10px;padding:8px 6px;font:600 11.5px Inter,system-ui,sans-serif;
        background:#eef1f7;color:#1f2a44;cursor:pointer;transition:.15s;min-width:60px}
      .sed-btn:hover:not(:disabled){background:#ffe9dd}
      .sed-btn.on{background:#1f2a44;color:#fff}
      .sed-btn:disabled{opacity:.4;cursor:not-allowed}
      .sed-color{width:100%;height:32px;border:0;border-radius:8px;cursor:pointer;padding:0;background:transparent}
      .sed-select{flex:1;border-radius:8px;border:1px solid #d9dfec;padding:7px 8px;font:600 11.5px Inter,system-ui,sans-serif;color:#1f2a44}
      .sed-status{font-size:10.5px;color:#6b7690;margin-top:10px;border-top:1px solid #e6ebf4;padding-top:8px}
      .sed-reset{background:none;border:0;color:#d7262c;font:600 11px Inter,system-ui,sans-serif;cursor:pointer;padding:0;margin-top:6px}
    `;
    document.head.appendChild(style);

    const toggle = document.createElement('button');
    toggle.className = 'sed-toggle'; toggle.textContent = '✏️ Editar cena';
    toggle.addEventListener('click', () => this.setActive(!this.active));

    const panel = document.createElement('div'); panel.className = 'sed-panel';
    panel.innerHTML = `
      <h4>Modo edição</h4>
      <div class="sed-hint">Clique num objeto para selecionar. Shift+clique para selecionar vários (para agrupar). Teclas: G mover · R girar · E escalar · Delete remover · Esc desseleciona.</div>
      <label>Transformar</label>
      <div class="sed-row">
        <button class="sed-btn" data-mode="translate">Mover</button>
        <button class="sed-btn" data-mode="rotate">Girar</button>
        <button class="sed-btn" data-mode="scale">Escalar</button>
      </div>
      <label>Cor do objeto selecionado</label>
      <div class="sed-row"><input type="color" class="sed-color" value="#3b82f6" /></div>
      <div class="sed-row">
        <button class="sed-btn" data-act="dup">Duplicar</button>
        <button class="sed-btn" data-act="group">Agrupar</button>
        <button class="sed-btn" data-act="ungroup">Desagrupar</button>
        <button class="sed-btn" data-act="remove">Ocultar</button>
      </div>
      <label>Adicionar objeto</label>
      <div class="sed-row">
        <select class="sed-select"></select>
        <button class="sed-btn" data-act="add" style="flex:0 0 auto">+ Adicionar</button>
      </div>
      <div class="sed-status">Alterações são salvas automaticamente neste navegador.</div>
      <button class="sed-reset">Resetar todas as edições</button>
    `;
    document.body.appendChild(toggle); document.body.appendChild(panel);

    const sel = panel.querySelector('.sed-select') as HTMLSelectElement;
    (Object.keys(SHAPE_LABEL) as PrimitiveShape[]).forEach((k) => {
      const opt = document.createElement('option'); opt.value = k; opt.textContent = SHAPE_LABEL[k]; sel.appendChild(opt);
    });

    const modeBtns = {
      translate: panel.querySelector('[data-mode="translate"]') as HTMLButtonElement,
      rotate: panel.querySelector('[data-mode="rotate"]') as HTMLButtonElement,
      scale: panel.querySelector('[data-mode="scale"]') as HTMLButtonElement,
    };
    (Object.keys(modeBtns) as (keyof typeof modeBtns)[]).forEach((k) => modeBtns[k].addEventListener('click', () => this.setMode(k)));

    const color = panel.querySelector('.sed-color') as HTMLInputElement;
    color.addEventListener('input', () => this.applyColorToSelection(parseInt(color.value.slice(1), 16)));

    const group = panel.querySelector('[data-act="group"]') as HTMLButtonElement;
    const ungroup = panel.querySelector('[data-act="ungroup"]') as HTMLButtonElement;
    const dup = panel.querySelector('[data-act="dup"]') as HTMLButtonElement;
    const remove = panel.querySelector('[data-act="remove"]') as HTMLButtonElement;
    const addBtn = panel.querySelector('[data-act="add"]') as HTMLButtonElement;
    const reset = panel.querySelector('.sed-reset') as HTMLButtonElement;
    group.addEventListener('click', () => this.groupSelected());
    ungroup.addEventListener('click', () => this.ungroupSelected());
    dup.addEventListener('click', () => this.duplicateSelected());
    remove.addEventListener('click', () => this.removeSelected());
    addBtn.addEventListener('click', () => this.addPrimitive(sel.value as PrimitiveShape));
    reset.addEventListener('click', () => {
      if (!confirm('Isso vai apagar todas as alterações salvas e recarregar a página com o layout original. Continuar?')) return;
      localStorage.removeItem(STORAGE_KEY); location.reload();
    });

    this.dom = { toggle, panel, hint: panel.querySelector('.sed-hint') as HTMLElement, modeBtns, color, group: group, ungroup, dup, remove, addSel: sel, addBtn, reset, status: panel.querySelector('.sed-status') as HTMLElement };
    this.refreshButtons();
  }

  private setActive(on: boolean) {
    this.active = on;
    this.dom.toggle.classList.toggle('on', on);
    this.dom.toggle.textContent = on ? '✓ Editando…' : '✏️ Editar cena';
    this.dom.panel.classList.toggle('on', on);
    if (!on) this.setSelection([]);
  }

  private setMode(mode: 'translate' | 'rotate' | 'scale') {
    this.xform.setMode(mode);
    (Object.keys(this.dom.modeBtns) as (keyof typeof this.dom.modeBtns)[]).forEach((k) => this.dom.modeBtns[k].classList.toggle('on', k === mode));
  }

  private refreshButtons() {
    const n = this.selected.length;
    const isGroup = n === 1 && !!this.selected[0].userData.editId?.toString().startsWith('usergroup-');
    this.dom.group.disabled = n < 2;
    this.dom.ungroup.disabled = !isGroup;
    this.dom.dup.disabled = n < 1;
    this.dom.remove.disabled = n < 1;
    const anyAdded = this.selected.some((o) => this.addedMeta.has(o.userData.editId));
    this.dom.remove.textContent = n >= 1 && this.selected.every((o) => this.addedMeta.has(o.userData.editId)) ? 'Excluir'
      : (anyAdded ? 'Remover/Ocultar' : (n === 1 && !this.selected[0].visible ? 'Mostrar' : 'Ocultar'));
    (Object.keys(this.dom.modeBtns) as (keyof typeof this.dom.modeBtns)[]).forEach((k) => this.dom.modeBtns[k].disabled = n === 0);
    this.dom.color.disabled = n === 0;
    if (n > 0) {
      const id = this.selected[0].userData.editId as string;
      const ov = this.colorOverrides.get(id);
      this.dom.color.value = '#' + (ov ?? 0x3b82f6).toString(16).padStart(6, '0');
    }
  }

  // ── seleção ───────────────────────────────────────────────────────
  private roots(): THREE.Object3D[] { return this.registry.filter((e) => e.object.userData.isEditableRoot).map((e) => e.object); }

  private pick(e: PointerEvent): THREE.Object3D | null {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = this.ray.intersectObjects(this.roots(), true)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o && !o.userData.isEditableRoot) o = o.parent;
    return o;
  }

  private onPointerUp(e: PointerEvent) {
    if (!this.active || this.xform.dragging) return;
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) return;
    const hit = this.pick(e);
    if (!hit) { if (!e.shiftKey) this.setSelection([]); return; }
    if (e.shiftKey) {
      const i = this.selected.indexOf(hit);
      if (i >= 0) this.setSelection(this.selected.filter((o) => o !== hit));
      else this.setSelection([...this.selected, hit]);
    } else this.setSelection([hit]);
  }

  private setSelection(objs: THREE.Object3D[]) {
    this.selected = objs;
    this.helpers.forEach((h) => { this.scene.remove(h); h.dispose(); }); this.helpers = [];
    for (const o of objs) {
      const h = new THREE.BoxHelper(o, o === objs[0] ? 0xf26a1b : 0x3b82f6);
      this.scene.add(h); this.helpers.push(h);
    }
    if (objs.length === 1) { this.xform.attach(objs[0]); this.xform.getHelper().visible = true; }
    else { this.xform.detach(); this.xform.getHelper().visible = false; }
    this.refreshButtons();
  }

  private refreshHelpers() { this.helpers.forEach((h) => h.update()); }

  // ── ações ─────────────────────────────────────────────────────────
  private groupSelected() {
    if (this.selected.length < 2) return;
    const grp = new THREE.Group(); const id = `usergroup-${++this.groupSeq}`;
    grp.name = id; grp.userData.isEditableRoot = true; grp.userData.editId = id;
    const center = new THREE.Vector3();
    this.selected.forEach((o) => center.add(o.getWorldPosition(new THREE.Vector3())));
    center.divideScalar(this.selected.length);
    grp.position.copy(center);
    this.scene.add(grp);
    grp.updateMatrixWorld(true);
    for (const o of this.selected) { o.userData.isEditableRoot = false; grp.attach(o); }
    this.registry.push({ id, object: grp });
    this.setSelection([grp]);
    this.scheduleSave();
  }

  private ungroupSelected() {
    if (this.selected.length !== 1) return;
    const grp = this.selected[0];
    if (!grp.userData.editId?.toString().startsWith('usergroup-')) return;
    const members = [...grp.children];
    for (const m of members) { this.scene.attach(m); m.userData.isEditableRoot = true; }
    this.scene.remove(grp);
    const idx = this.registry.findIndex((e) => e.object === grp); if (idx >= 0) this.registry.splice(idx, 1);
    this.setSelection(members);
    this.scheduleSave();
  }

  private cloneWithMaterials(src: THREE.Object3D): THREE.Object3D {
    const clone = src.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : (mesh.material as THREE.Material).clone();
    });
    return clone;
  }

  private duplicateSelected() {
    if (this.selected.length === 0) return;
    const dups: THREE.Object3D[] = [];
    for (const src of this.selected) {
      const sourceId = src.userData.editId as string;
      const clone = this.cloneWithMaterials(src);
      const id = `added-${++this.addedSeq}`;
      clone.userData.isEditableRoot = true; clone.userData.editId = id;
      clone.position.x += 1.6; clone.position.z += 1.6;
      this.scene.add(clone);
      this.registry.push({ id, object: clone });
      this.addedMeta.set(id, { kind: 'clone', sourceId });
      dups.push(clone);
    }
    this.setSelection(dups);
    this.scheduleSave();
  }

  private removeSelected() {
    if (this.selected.length === 0) return;
    const remaining: THREE.Object3D[] = [];
    for (const o of this.selected) {
      const id = o.userData.editId as string;
      if (this.addedMeta.has(id)) {
        this.scene.remove(o); const idx = this.registry.findIndex((e) => e.object === o); if (idx >= 0) this.registry.splice(idx, 1);
        this.addedMeta.delete(id); this.colorOverrides.delete(id);
      } else {
        o.visible = !o.visible; if (o.visible) remaining.push(o);
      }
    }
    this.setSelection(remaining);
    this.scheduleSave();
  }

  private applyColorToSelection(hex: number) {
    for (const o of this.selected) {
      this.applyColor(o, hex);
      this.colorOverrides.set(o.userData.editId as string, hex);
    }
    this.scheduleSave();
  }
  private applyColor(object: THREE.Object3D, hex: number) {
    object.traverse((o) => {
      const mesh = o as THREE.Mesh; if (!(mesh as any).isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats as any[]) if (m && m.color) m.color.setHex(hex);
    });
  }

  private spawnShape(shape: PrimitiveShape): THREE.Object3D {
    const m = () => new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6, metalness: 0.08 });
    switch (shape) {
      case 'box': { const g = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m()); g.position.y = 0.5; return g; }
      case 'cylinder': { const g = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 24), m()); g.position.y = 0.5; return g; }
      case 'sphere': { const g = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), m()); g.position.y = 0.55; return g; }
      case 'cone': { const g = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 24), m()); g.position.y = 0.55; return g; }
      case 'rack': return buildRack(4);
      case 'cabinet': return buildCabinet();
      case 'sofa': return buildSofa();
      case 'table': return buildCoffeeTable();
      case 'waitchair': return buildWaitChair();
      case 'product': return buildProductDisplay();
      case 'counter': return buildCounter(3);
      case 'printer': return buildPrinter();
      case 'watercooler': return buildWaterCooler();
    }
  }

  private addPrimitive(shape: PrimitiveShape) {
    const obj = this.spawnShape(shape);
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const t = this.orbit.target;
    const jitter = () => (Math.random() - 0.5) * 2;
    obj.position.x += t.x + jitter(); obj.position.z += t.z + jitter();
    const id = `added-${++this.addedSeq}`;
    obj.userData.isEditableRoot = true; obj.userData.editId = id;
    this.scene.add(obj);
    this.registry.push({ id, object: obj });
    this.addedMeta.set(id, { kind: 'primitive', shape });
    this.setSelection([obj]);
    this.scheduleSave();
  }

  // ── persistência ──────────────────────────────────────────────────
  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), 400);
  }

  private saveNow() {
    const edits: EditRecord[] = []; const groups: GroupRecord[] = []; const added: AddedRecord[] = [];
    for (const { id, object } of this.registry) {
      const parentId = (object.parent?.userData as any)?.editId as string | undefined;
      if (parentId?.startsWith('usergroup-')) continue; // coberto como membro do grupo
      if (id.startsWith('usergroup-')) {
        groups.push({
          id, ...trs(object),
          members: object.children.map((c) => ({ id: c.userData.editId as string, ...trs(c) })),
        });
      } else if (this.addedMeta.has(id)) {
        const meta = this.addedMeta.get(id)!;
        added.push({ id, kind: meta.kind, shape: meta.shape, sourceId: meta.sourceId, ...trs(object), color: this.colorOverrides.get(id), hidden: object.visible ? undefined : true });
      } else {
        edits.push({ id, ...trs(object), color: this.colorOverrides.get(id), hidden: object.visible ? undefined : true });
      }
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ edits, groups, added } as SaveFile)); } catch { /* armazenamento indisponível */ }
    this.dom.status.textContent = 'Alterações salvas automaticamente neste navegador · ' + new Date().toLocaleTimeString('pt-BR');
  }

  private findById(id: string): THREE.Object3D | undefined { return this.registry.find((e) => e.id === id)?.object; }

  private applySaved() {
    let raw: string | null = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* ignora */ }
    if (!raw) return;
    let data: SaveFile; try { data = JSON.parse(raw); } catch { return; }

    // 1) recria objetos adicionados/duplicados
    for (const a of data.added ?? []) {
      let obj: THREE.Object3D | undefined;
      if (a.kind === 'primitive' && a.shape) obj = this.spawnShape(a.shape);
      else if (a.kind === 'clone' && a.sourceId) { const src = this.findById(a.sourceId); if (src) obj = this.cloneWithMaterials(src); }
      if (!obj) continue;
      obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      obj.userData.isEditableRoot = true; obj.userData.editId = a.id;
      applyTrs(obj, a);
      if (a.color !== undefined) { this.applyColor(obj, a.color); this.colorOverrides.set(a.id, a.color); }
      if (a.hidden) obj.visible = false;
      this.scene.add(obj);
      this.registry.push({ id: a.id, object: obj });
      this.addedMeta.set(a.id, { kind: a.kind, shape: a.shape, sourceId: a.sourceId });
      const n = parseInt(a.id.split('-')[1] || '0', 10); if (n > this.addedSeq) this.addedSeq = n;
    }

    // 2) recria agrupamentos
    for (const g of data.groups ?? []) {
      const grp = new THREE.Group(); grp.name = g.id; grp.userData.isEditableRoot = true; grp.userData.editId = g.id;
      applyTrs(grp, g);
      this.scene.add(grp);
      for (const mem of g.members) {
        const obj = this.findById(mem.id); if (!obj) continue;
        obj.userData.isEditableRoot = false;
        grp.add(obj); applyTrs(obj, mem);
      }
      this.registry.push({ id: g.id, object: grp });
      const n = parseInt(g.id.split('-')[1] || '0', 10); if (n > this.groupSeq) this.groupSeq = n;
    }

    // 3) aplica transformações/cores/visibilidade salvas aos objetos originais (ainda no nível raiz)
    for (const e of data.edits ?? []) {
      const obj = this.findById(e.id); if (!obj) continue;
      if (!obj.userData.isEditableRoot) continue; // já foi agrupado acima
      applyTrs(obj, e);
      if (e.color !== undefined) { this.applyColor(obj, e.color); this.colorOverrides.set(e.id, e.color); }
      if (e.hidden) obj.visible = false;
    }
  }
}
