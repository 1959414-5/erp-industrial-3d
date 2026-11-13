// layout.ts — arrastar os painéis (KPIs, gráfico, lista inferior, paredes e chat da IA) e lembrar a posição (localStorage).
// Botão ✥ no topo liga o "modo mover": os painéis ganham contorno e podem ser arrastados; Esc ou "Concluir" sai do modo.
const KEY = 'erp3d-ui-layout-v1';
const IDS = ['left', 'right', 'bottom', 'wallctl', 'ai'] as const;
type Pos = { fx: number; fy: number; h?: number };           // fx/fy = fração da janela (adapta a telas diferentes)
type Saved = Partial<Record<(typeof IDS)[number], Pos>>;

const load = (): Saved => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Saved; } catch { return {}; } };
const store = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* armazenamento indisponível */ } };

export function mountLayout() {
  const btn = document.getElementById('movebtn') as HTMLButtonElement | null; if (!btn) return;
  const els = IDS.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
  els.forEach((e) => { e.dataset.movable = ''; });
  const saved = load();

  const free = (el: HTMLElement) => { el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none'; };
  const clamp = (el: HTMLElement, x: number, y: number) => {
    const w = el.offsetWidth || 200;                                   // mantém o painel dentro da janela (x) e com uma faixa visível (y)
    return { x: Math.min(Math.max(x, 0), Math.max(0, innerWidth - w)), y: Math.min(Math.max(y, 0), innerHeight - 60) };
  };
  function place(el: HTMLElement, p: Pos) {
    free(el);
    if (p.h) el.style.height = Math.min(p.h, innerHeight - 24) + 'px';
    const c = clamp(el, p.fx * innerWidth, p.fy * innerHeight);
    el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  }
  const applyAll = () => els.forEach((e) => { const p = saved[e.id as keyof Saved]; if (p) place(e, p); });
  applyAll();
  addEventListener('resize', applyAll);

  // ── arrastar ──
  let drag: { el: HTMLElement; dx: number; dy: number } | null = null;
  document.addEventListener('pointerdown', (e) => {
    if (!document.body.classList.contains('arrange')) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-movable]'); if (!el) return;
    const r = el.getBoundingClientRect();
    if (el.id === 'ai') el.style.height = r.height + 'px';             // o chat usa top+bottom; fixa a altura antes de soltar o "bottom"
    free(el); el.style.left = r.left + 'px'; el.style.top = r.top + 'px';
    drag = { el, dx: e.clientX - r.left, dy: e.clientY - r.top };
    el.setPointerCapture(e.pointerId); el.classList.add('dragging'); e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return; const c = clamp(drag.el, e.clientX - drag.dx, e.clientY - drag.dy);
    drag.el.style.left = c.x + 'px'; drag.el.style.top = c.y + 'px';
  });
  const end = () => {
    if (!drag) return; const { el } = drag; el.classList.remove('dragging'); drag = null;
    const r = el.getBoundingClientRect();
    saved[el.id as keyof Saved] = { fx: r.left / innerWidth, fy: r.top / innerHeight, ...(el.id === 'ai' ? { h: r.height } : {}) };
    store(saved);
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);

  // ── modo mover / restaurar ──
  const bar = document.createElement('div'); bar.id = 'arrbar';
  bar.innerHTML = '<span>✥ Arraste os painéis para onde quiser — a posição fica salva neste navegador</span><button data-a="reset">Restaurar posições</button><button data-a="done" class="primary">Concluir</button>';
  document.getElementById('ui')!.appendChild(bar);
  const set = (on: boolean) => { document.body.classList.toggle('arrange', on); btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on)); };
  btn.addEventListener('click', () => set(!document.body.classList.contains('arrange')));
  bar.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.a;
    if (a === 'done') set(false);
    if (a === 'reset') {
      for (const k of Object.keys(saved)) delete saved[k as keyof Saved];
      try { localStorage.removeItem(KEY); } catch { /* ignora */ }
      els.forEach((el) => { for (const p of ['left', 'top', 'right', 'bottom', 'transform', 'height'] as const) el.style[p] = ''; });
    }
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('arrange')) set(false); });
}
