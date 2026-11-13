import './style.css';
import { loadData } from './data';
import type { DataSource, Selection, TabKey } from './data';
import { Factory, type WallMode } from './scene';
import { mountUi } from './ui';
import { mountAi } from './ai';
import { mountLayout } from './layout';

const SOURCE_LABEL: Record<DataSource, string> = {
  api: 'dados ao vivo · MySQL',
  snapshot: 'snapshot · data.json',
  sample: 'dados de exemplo',
};

async function main() {
  const { data, source } = await loadData();

  // atualiza o badge com a fonte real dos dados
  const badge = document.querySelector('.badge');
  if (badge) {
    badge.textContent = SOURCE_LABEL[source];
    badge.classList.toggle('live', source === 'api');
  }

  const factory = new Factory(document.getElementById('scene') as HTMLCanvasElement);
  (window as any).__factory = factory;
  factory.setMachines(data.machines);
  factory.setOccupancy(data.occupancy);
  // limpa restos do antigo modo de edição (posições salvas que ignoravam o layout do código)
  try { localStorage.removeItem('erp3d-scene-edits-v1'); localStorage.removeItem('erp3d-scene-edits-v2'); } catch { /* ignora */ }
  const ui = mountUi(data, (tab) => { factory.select(null); factory.focus(tab); }, (sel) => factory.select(sel));
  factory.onHover = (s, x, y) => ui.showTip(s, x, y);
  factory.onPick = (s) => ui.pin(s);
  factory.onAnchor = (x, y, v) => ui.place(x, y, v);
  ui.select('producao');

  // assistente de IA (chat) — ver src/ai.ts
  let curTab: TabKey = 'producao', curSel: Selection | null = null;
  document.getElementById('tabs')!.addEventListener('click', (e) => { const k = (e.target as HTMLElement).closest<HTMLElement>('button')?.dataset.k; if (k) curTab = k as TabKey; });
  const prevPick = factory.onPick; factory.onPick = (s) => { curSel = s; prevPick(s); };
  mountAi({ data, getContext: () => ({ tab: curTab, selected: curSel }), openTab: (t) => { ui.select(t); curTab = t; }, focus: (s) => factory.focusSelection(s) });
  mountLayout();   // painéis arrastáveis (✥) + posição salva

  // botões de paredes (Corte / Altas / Baixas)
  const wallBtns = document.querySelectorAll<HTMLButtonElement>('#wallctl button');
  wallBtns.forEach((b) => b.addEventListener('click', () => {
    factory.setWallMode(b.dataset.wall as WallMode);
    wallBtns.forEach((x) => x.classList.toggle('on', x === b));
  }));
}
main();
