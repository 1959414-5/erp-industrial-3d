import './style.css';
import type { Dataset, Selection, TabKey } from './data';
import { Factory, type WallMode } from './scene';
import { mountUi } from './ui';
import { mountAi } from './ai';
import { mountLayout } from './layout';

type ConnectionStep = 'api' | 'database' | 'data';
const CONNECTION_STEPS: ConnectionStep[] = ['api', 'database', 'data'];
const API_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

function setConnectionStage(step: ConnectionStep, title: string, description: string, status: string) {
  const screen = document.getElementById('connection-screen');
  screen?.classList.remove('has-error');
  screen?.setAttribute('aria-busy', 'true');
  const titleEl = document.getElementById('connection-title');
  const descriptionEl = document.getElementById('connection-description');
  const statusEl = document.getElementById('connection-status-text');
  const errorPanel = document.getElementById('connection-error');
  const spinner = document.getElementById('connection-spinner');
  const retryButton = document.getElementById('connection-retry') as HTMLButtonElement | null;
  if (titleEl) titleEl.textContent = title;
  if (descriptionEl) descriptionEl.textContent = description;
  if (statusEl) statusEl.textContent = status;
  if (errorPanel) errorPanel.hidden = true;
  if (spinner) spinner.hidden = false;
  if (retryButton) {
    retryButton.disabled = true;
    retryButton.textContent = 'Conectando...';
  }

  const activeIndex = CONNECTION_STEPS.indexOf(step);
  document.querySelectorAll<HTMLElement>('[data-connection-step]').forEach((node) => {
    const key = node.dataset.connectionStep as ConnectionStep;
    const index = CONNECTION_STEPS.indexOf(key);
    node.classList.toggle('is-done', index < activeIndex);
    node.classList.toggle('is-active', index === activeIndex);
    const state = node.querySelector<HTMLElement>('.connection-step-state');
    if (state) state.textContent = index < activeIndex ? 'Concluído' : index === activeIndex ? 'Em andamento' : 'Aguardando';
  });
}

function showConnectionError(message: string) {
  const screen = document.getElementById('connection-screen');
  screen?.classList.add('has-error');
  screen?.setAttribute('aria-busy', 'false');
  const title = document.getElementById('connection-title');
  const description = document.getElementById('connection-description');
  const status = document.getElementById('connection-status-text');
  const spinner = document.getElementById('connection-spinner');
  const panel = document.getElementById('connection-error');
  const messageEl = document.getElementById('connection-error-text');
  const retryButton = document.getElementById('connection-retry') as HTMLButtonElement | null;
  if (title) title.textContent = 'Conexão não estabelecida';
  if (description) description.textContent = 'A fábrica permanece bloqueada até que a conexão com o banco de dados seja confirmada.';
  if (status) status.textContent = 'Aguardando uma conexão válida';
  if (spinner) spinner.hidden = true;
  if (panel) panel.hidden = false;
  if (messageEl) messageEl.textContent = message;
  if (retryButton) {
    retryButton.disabled = false;
    retryButton.textContent = '↻ Tentar novamente';
  }
  document.querySelectorAll<HTMLElement>('[data-connection-step]').forEach((node) => {
    node.classList.remove('is-active');
    const state = node.querySelector<HTMLElement>('.connection-step-state');
    if (state && !node.classList.contains('is-done')) state.textContent = 'Pendente';
  });
}

async function requestJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Tempo limite excedido');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function isDataset(value: unknown): value is Dataset {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<Dataset>;
  return Boolean(
    data.tabs?.producao && data.tabs?.estoque && data.tabs?.comercial
    && Array.isArray(data.machines)
    && Array.isArray(data.occupancy)
    && Array.isArray(data.lots)
    && Array.isArray(data.sellers)
  );
}

function connectionErrorMessage(step: ConnectionStep): string {
  if (step === 'api') {
    return 'Não foi possível alcançar a API na nuvem. O serviço pode estar iniciando ou indisponível. A tela continuará bloqueada até a API responder.';
  }
  if (step === 'database') {
    return 'A API respondeu, mas não confirmou o acesso ao MySQL. Verifique se o cluster TiDB Cloud está ativo e se as credenciais do banco estão corretas no servidor.';
  }
  return 'O banco MySQL respondeu, mas a API não conseguiu carregar os dados industriais. Verifique a estrutura do banco e os logs do serviço de API.';
}

async function connectToCloud(): Promise<void> {
  if (!API_URL) {
    showConnectionError('A variável API_URL não foi configurada na publicação do GitHub Pages. Configure-a em Settings → Secrets and variables → Actions → Variables e execute novamente o workflow Deploy Pages.');
    return;
  }

  const retryButton = document.getElementById('connection-retry') as HTMLButtonElement | null;
  if (retryButton) retryButton.disabled = true;
  const deadline = Date.now() + 180_000;
  let attempt = 0;
  let step: ConnectionStep = 'api';

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      step = 'api';
      setConnectionStage(step, 'Conectando à API na nuvem',
        'Acordando o serviço e verificando a disponibilidade da aplicação.',
        `Verificando serviço na nuvem · tentativa ${attempt}`);
      const ping = await requestJson<{ ok: boolean }>(`${API_URL}/api/ping`, 90_000);
      if (ping?.ok !== true) throw new Error('API sem confirmação de disponibilidade');

      step = 'database';
      setConnectionStage(step, 'Validando conexão com MySQL',
        'A API respondeu. Agora estamos executando uma consulta real no banco de dados em nuvem.',
        'Executando verificação de conexão com o MySQL...');
      const health = await requestJson<{ ok: boolean; db?: string }>(`${API_URL}/api/health`, 30_000);
      if (health?.ok !== true || !health.db) throw new Error('MySQL não confirmou a conexão');

      step = 'data';
      setConnectionStage(step, 'Carregando dados industriais',
        'MySQL conectado. Buscando indicadores de produção, estoque e comercial.',
        'Consultando dados operacionais...');
      const data = await requestJson<unknown>(`${API_URL}/api/data`, 45_000);
      if (!isDataset(data)) throw new Error('A API retornou um conjunto de dados incompleto');

      const badge = document.querySelector('.badge');
      if (badge) {
        badge.textContent = 'dados ao vivo · MySQL';
        badge.classList.add('live');
      }
      startApplication(data);

      const screen = document.getElementById('connection-screen');
      screen?.classList.add('is-complete');
      screen?.setAttribute('aria-busy', 'false');
      document.body.classList.remove('is-connecting');
      document.body.classList.add('app-ready');
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      screen?.remove();
      return;
    } catch {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const retryStatus = step === 'api'
        ? `A API ainda não respondeu. Nova tentativa em instantes · ${attempt}`
        : step === 'database'
          ? `API localizada; aguardando confirmação do MySQL · ${attempt}`
          : `MySQL conectado; tentando carregar os dados novamente · ${attempt}`;
      const retryTitle = step === 'api' ? 'Conectando à API na nuvem'
        : step === 'database' ? 'Aguardando o banco MySQL' : 'Carregando dados industriais';
      const retryDescription = step === 'api'
        ? 'O serviço pode estar despertando no provedor de nuvem. A conexão será tentada novamente automaticamente.'
        : step === 'database'
          ? 'O serviço está disponível, mas o banco ainda não confirmou a conexão. Vamos tentar novamente.'
          : 'A conexão com o banco foi validada. Estamos repetindo a leitura dos dados operacionais.';
      setConnectionStage(step, retryTitle, retryDescription, retryStatus);
      await new Promise((resolve) => window.setTimeout(resolve, Math.min(3500, remaining)));
    }
  }
  showConnectionError(connectionErrorMessage(step));
}

function startApplication(data: Dataset) {
  const badge = document.querySelector('.badge');
  if (badge) {
    badge.textContent = 'dados ao vivo · MySQL';
    badge.classList.add('live');
  }

  const factory = new Factory(document.getElementById('scene') as HTMLCanvasElement);
  (window as any).__factory = factory;
  factory.setMachines(data.machines);
  const lotStates = data.lots.map((lot, index) => {
    const occupancy = data.occupancy[index] ?? 0;
    if (occupancy < 0.15 || lot.qty <= 0) return 'empty';
    if (lot.qty < lot.minQty) return 'critical';
    if (occupancy > 0.8) return 'full';
    return occupancy > 0.5 ? 'medium' : 'low';
  });
  factory.setOccupancy(data.occupancy, lotStates);

  const dataStamp = document.getElementById('data-stamp');
  if (dataStamp) {
    dataStamp.textContent = 'consultado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  // limpa restos do antigo modo de edição (posições salvas que ignoravam o layout do código)
  try { localStorage.removeItem('erp3d-scene-edits-v1'); localStorage.removeItem('erp3d-scene-edits-v2'); } catch { /* ignora */ }
  const ui = mountUi(data, (tab) => { factory.select(null); factory.focus(tab); }, (sel) => { if (sel) factory.focusSelection(sel); else factory.select(null); });
  factory.onHover = (s, x, y) => ui.showTip(s, x, y);
  factory.onPick = (s) => ui.pin(s);
  factory.onAnchor = (x, y, v) => ui.place(x, y, v);
  ui.select('producao');

  // assistente de IA (chat) — ver src/ai.ts
  let curTab: TabKey = 'producao', curSel: Selection | null = null;
  document.getElementById('tabs')!.addEventListener('click', (e) => { const k = (e.target as HTMLElement).closest<HTMLElement>('button')?.dataset.k; if (k) curTab = k as TabKey; });
  const prevPick = factory.onPick; factory.onPick = (s) => { curSel = s; prevPick(s); };
  mountAi({ data, getContext: () => ({ tab: curTab, selected: curSel }), openTab: (t) => { ui.select(t); curTab = t; }, focus: (s) => factory.focusSelection(s) });
  const focusButton = document.getElementById('focusbtn') as HTMLButtonElement | null;
  const toggleFocusMode = (active: boolean) => {
    document.body.classList.toggle('focus-mode', active);
    if (focusButton) {
      focusButton.setAttribute('aria-pressed', String(active));
      focusButton.classList.toggle('active', active);
      focusButton.textContent = active ? '× Sair do foco' : '◉ Modo foco';
    }
  };
  focusButton?.addEventListener('click', () => toggleFocusMode(!document.body.classList.contains('focus-mode')));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('focus-mode')) toggleFocusMode(false);
  });

  mountLayout();   // painéis arrastáveis (✥) + posição salva

  // botões de paredes (Corte / Altas / Baixas)
  const wallBtns = document.querySelectorAll<HTMLButtonElement>('#wallctl button');
  wallBtns.forEach((b) => b.addEventListener('click', () => {
    factory.setWallMode(b.dataset.wall as WallMode);
    wallBtns.forEach((x) => x.classList.toggle('on', x === b));
  }));
}

document.getElementById('connection-retry')?.addEventListener('click', () => { void connectToCloud(); });
void connectToCloud();
