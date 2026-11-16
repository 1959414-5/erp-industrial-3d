// ai.ts — painel do assistente de IA (chat) + orquestração.
//  • Modo "Claude": se a API (VITE_API_URL) responder /api/ai/status com llm=true, as perguntas vão para
//    POST /api/ai/chat (LLM + ferramentas sobre o MySQL).
//  • Modo "local": motor de análise offline (ai-local.ts) — funciona sem chave, sem API e no site estático.
//  • Se a chamada ao Claude falhar (rede, limite, chave), cai automaticamente para o motor local.
import type { Dataset, Selection, TabKey } from './data';
import { answerLocal, buildInsights, norm, resolveRef, smartSuggestions } from './ai-local';
import type { AiAction, AiChart, AiReply, Insight } from './ai-local';

export interface AiHost {
  data: Dataset;
  getContext(): { tab: TabKey; selected: Selection | null };
  openTab(t: TabKey): void;
  focus(sel: Selection): void;
}
type Turn = { role: 'user' | 'assistant'; content: string };
interface Quota { at: number; reqLimit: string | null; reqRemaining: string | null; tokLimit: string | null; tokRemaining: string | null; reqReset: string | null; tokReset: string | null }
interface Health { ok: boolean; code?: string; message?: string; at: number }
interface ProviderInfo { name: string; label: string; free: boolean; primary: boolean; current: string; models: string[]; recommended: string; health: Health | null; quota: Quota | null; spent: { questions: number; tokens: number }; console: string | null }
interface ModelsInfo { providers: ProviderInfo[]; dailyCap: number; questionsToday: number }
interface Pick { provider: string; model?: string }
const PICK_KEY = 'erp3d-ai-model-v1';
const loadPick = (): Pick | null => { try { const j = JSON.parse(localStorage.getItem(PICK_KEY) || 'null'); return j && typeof j.provider === 'string' ? j : null; } catch { return null; } };
const savePick = (p: Pick | null) => { try { p ? localStorage.setItem(PICK_KEY, JSON.stringify(p)) : localStorage.removeItem(PICK_KEY); } catch { /* sem storage */ } };
const fmtN = (v: string | number | null | undefined) => v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SEV = { critical: '!', warn: '!', info: 'i', good: '✓' } as const;
const KIND_TAB: Record<Selection['kind'], TabKey> = { machine: 'producao', lot: 'estoque', seller: 'comercial' };

/** Markdown mínimo e seguro: **negrito**, *itálico*, listas "- " e quebras de linha. Escapa HTML antes. */
export function md(text: string): string {
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  const out: string[] = []; let list = false;
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*[-•]\s+(.*)$/);
    if (m) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    out.push(line.trim() ? `<p>${inline(line)}</p>` : '');
  }
  if (list) out.push('</ul>');
  return out.join('');
}

function chartHtml(c: AiChart): string {
  const max = Math.max(...c.items.map((i) => i.value), 1);
  return `<div class="ai-chart"><small>${esc(c.title)}</small>${c.items.map((i) => `<div class="ai-bar${i.forecast ? ' fc' : ''}"><span class="l">${esc(i.label)}</span><span class="t"><span style="width:${Math.max((i.value / max) * 100, 2)}%"></span></span><b>${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(i.value)}${c.unit ?? ''}</b></div>`).join('')}${c.items.some((i) => i.forecast) ? '<em>listradas = projeção</em>' : ''}</div>`;
}

export function mountAi(host: AiHost) {
  const root = document.getElementById('ui')!;
  const btn = document.getElementById('aibtn') as HTMLButtonElement;
  const panel = document.createElement('section');
  panel.id = 'ai'; panel.className = 'glass'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Assistente de IA');
  panel.innerHTML = `
    <div class="ai-head"><div><b>✨ Assistente IA</b><small id="ai-mode">verificando…</small></div><button class="x" aria-label="Fechar">×</button></div>
    <div class="ai-body" id="ai-body" aria-live="polite"></div>
    <div class="ai-chips" id="ai-chips"></div>
    <div class="ai-models" id="ai-models" role="menu" aria-label="Modelos de IA" hidden></div>
    <form class="ai-form" autocomplete="off"><button type="button" class="ai-mbtn" id="ai-mbtn" aria-haspopup="true" aria-expanded="false" title="Modelos de IA" aria-label="Escolher modelo de IA"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></svg></button><input id="ai-input" maxlength="400" placeholder="Pergunte sobre produção, estoque ou vendas…" aria-label="Pergunta"/><button type="submit" aria-label="Enviar">➤</button></form>`;
  root.appendChild(panel);
  const body = panel.querySelector<HTMLDivElement>('#ai-body')!, chips = panel.querySelector<HTMLDivElement>('#ai-chips')!;
  const input = panel.querySelector<HTMLInputElement>('#ai-input')!, form = panel.querySelector<HTMLFormElement>('.ai-form')!, modeEl = panel.querySelector<HTMLElement>('#ai-mode')!;
  const mbtn = panel.querySelector<HTMLButtonElement>('#ai-mbtn')!, mpop = panel.querySelector<HTMLDivElement>('#ai-models')!;

  const api = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  let llm = false, model = '', label = 'Claude', busy = false, greeted = false; const history: Turn[] = [];
  let pick: Pick | null = loadPick(); let info: ModelsInfo | null = null; let lastReply: AiReply | undefined; const asked: string[] = []; let aiChips: string[] | null = null;

  // detecta se o backend tem chave da Anthropic configurada (tenta de novo ao abrir o painel se a 1ª tentativa falhar)
  let detected = false;
  async function detect() {
    if (api && !detected) {
      try { const r = await fetch(`${api}/api/ai/status`, { signal: AbortSignal.timeout(8000) }); if (r.ok) { const j = await r.json(); llm = !!j.llm; model = j.model ?? ''; label = j.label ?? 'IA'; detected = true; } } catch { /* sem API: motor local */ }
    }
    paintMode();
  }
  function paintMode() {
    const pv = pick && pick.provider !== 'auto' ? info?.providers.find((x) => x.name === pick!.provider) : null;
    modeEl.textContent = !llm ? 'Motor de análise local · offline' : pv ? `${pv.label} · ${pick!.model ?? pv.current} · escolhido por você` : `${label} · ${model} · automático`;
    modeEl.className = llm ? 'live' : '';
    mbtn.classList.toggle('picked', !!pv);
  }
  void detect().then(() => loadModels());

  // ── ações (câmera 3D / abas) ──
  function run(a: AiAction) {
    if (a.type === 'tab') { host.openTab(a.tab); return; }
    const index = resolveRef(host.data, a.kind, a.ref); if (index < 0) return;
    const tab = KIND_TAB[a.kind];
    if (host.getContext().tab !== tab) host.openTab(tab);
    host.focus({ kind: a.kind, index });
  }
  const actionBtns = (acts: AiAction[] = []) => acts.length ? `<div class="ai-acts">${acts.map((a, i) => `<button data-a="${i}">${a.type === 'focus' ? '🎯' : '↗'} ${esc(a.label)}</button>`).join('')}</div>` : '';

  function add(role: 'user' | 'bot', html: string, acts?: AiAction[]) {
    const el = document.createElement('div'); el.className = `ai-msg ${role}`; el.innerHTML = html;
    if (acts?.length) el.querySelectorAll<HTMLButtonElement>('.ai-acts button').forEach((b) => b.addEventListener('click', () => run(acts[Number(b.dataset.a)])));
    body.appendChild(el); body.scrollTop = body.scrollHeight; return el;
  }

  function briefing() {
    const list: Insight[] = buildInsights(host.data).filter((i) => i.severity !== 'good').slice(0, 3);
    const el = add('bot', `<p><b>Olá! 👋</b> Analisei os dados agora e separei o que merece atenção:</p>` +
      `<div class="ai-ins">${list.map((i, k) => `<div class="ai-card ${i.severity}"><div>${SEV[i.severity]} <b>${esc(i.title)}</b></div><small>${esc(i.detail)}</small>${i.action ? `<button data-i="${k}">${i.action.type === 'focus' ? '🎯 Ver no 3D' : '↗ Abrir'}</button>` : ''}</div>`).join('')}</div>` +
      `<p class="muted">Pergunte em linguagem natural — ou toque numa sugestão abaixo.</p>`);
    el.querySelectorAll<HTMLButtonElement>('.ai-card button').forEach((b) => b.addEventListener('click', () => { const a = list[Number(b.dataset.i)].action; if (a) run(a); }));
  }

  function renderChips() {
    const ctx = host.getContext();
    const list = (aiChips && aiChips.length ? aiChips : smartSuggestions(host.data, ctx, asked, lastReply)).filter(Boolean).slice(0, 6);
    chips.innerHTML = list.map((s) => `<button type="button" title="${esc(s)}">${esc(s)}</button>`).join('');
    chips.scrollLeft = 0; edge();
  }
  // chips: clique envia a pergunta; arrastar rola a fila (mouse/toque) — o clique logo após um arrasto é ignorado
  let drag: { x: number; sl: number; moved: boolean } | null = null, justDragged = false;
  const edge = () => { chips.classList.toggle('more-r', chips.scrollLeft + chips.clientWidth < chips.scrollWidth - 4); chips.classList.toggle('more-l', chips.scrollLeft > 4); };
  chips.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; drag = { x: e.clientX, sl: chips.scrollLeft, moved: false }; });
  chips.addEventListener('pointermove', (e) => {
    if (!drag) return; const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; chips.classList.add('dragging'); try { chips.setPointerCapture(e.pointerId); } catch { /* ok */ } }
    if (drag.moved) { chips.scrollLeft = drag.sl - dx; edge(); }
  });
  const endDrag = () => { if (drag?.moved) { justDragged = true; setTimeout(() => (justDragged = false), 60); } drag = null; chips.classList.remove('dragging'); };
  chips.addEventListener('pointerup', endDrag); chips.addEventListener('pointercancel', endDrag);
  chips.addEventListener('scroll', edge, { passive: true });
  chips.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { chips.scrollLeft += e.deltaY; e.preventDefault(); edge(); } }, { passive: false });
  chips.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (!b || justDragged) return; void ask(b.textContent ?? ''); });
  window.addEventListener('resize', edge);

  // ── seletor de modelos (como o "+" do chat) ──
  async function loadModels() {
    if (!api || !llm) return;
    try { const r = await fetch(`${api}/api/ai/models`, { signal: AbortSignal.timeout(12000) }); if (r.ok) info = await r.json(); } catch { /* mantém o anterior */ }
    // escolha salva que não existe mais (provedor removido/modelo aposentado) volta para o automático
    if (info && pick && pick.provider !== 'auto') {
      const pv = info.providers.find((x) => x.name === pick!.provider);
      if (!pv || (pick.model && pv.models.length && !pv.models.includes(pick.model))) { pick = null; savePick(null); }
    }
    paintMode();
  }
  const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`; };
  function healthBadge(h: Health | null) {
    if (!h) return '<span class="hb n">⚪ ainda não usado</span>';
    if (h.ok) return `<span class="hb ok">🟢 funcionando · ${ago(h.at)}</span>`;
    const lab = h.code === 'no_credit' ? '🔴 sem crédito' : h.code === 'auth' ? '🔴 chave inválida' : h.code === 'model' ? '🟠 modelo indisponível' : h.code === 'rate_limit' ? '🟠 limite atingido' : '🟠 instável';
    return `<span class="hb bad" title="${esc(h.message ?? '')}">${lab} · ${ago(h.at)}</span>`;
  }
  function quotaHtml(p: ProviderInfo) {
    const q = p.quota, lines: string[] = [];
    if (q && (q.reqRemaining != null || q.tokRemaining != null)) {
      if (q.reqRemaining != null) lines.push(`Requisições restantes: <b>${fmtN(q.reqRemaining)}</b>${q.reqLimit ? ` de ${fmtN(q.reqLimit)}` : ''}${q.reqReset ? ` · renova em ${esc(q.reqReset)}` : ''}`);
      if (q.tokRemaining != null) lines.push(`Tokens restantes: <b>${fmtN(q.tokRemaining)}</b>${q.tokLimit ? ` de ${fmtN(q.tokLimit)}` : ''}${q.tokReset ? ` · renova em ${esc(q.tokReset)}` : ''}`);
    } else lines.push('Cota em tempo real: aparece depois da 1ª pergunta neste provedor.');
    lines.push(`Uso hoje (medido aqui): <b>${fmtN(p.spent.questions)}</b> pergunta(s) · <b>${fmtN(p.spent.tokens)}</b> tokens`);
    return `<div class="q">${lines.map((l) => `<div>${l}</div>`).join('')}${p.console ? `<a href="${esc(p.console)}" target="_blank" rel="noopener noreferrer">ver saldo/limites no painel do provedor ↗</a>` : ''}</div>`;
  }
  const expanded = new Set<string>();
  function renderModels() {
    if (!llm) { mpop.innerHTML = `<div class="mh"><b>Modelos de IA</b></div><div class="mrow on" style="cursor:default"><span class="dot"></span><span><b>Motor de análise local</b><small>Estatística + regras rodando no seu navegador. Sem chave, sem custo, sem cota.</small></span></div><p class="mnote">Para usar um modelo de linguagem, configure uma chave no <code>api/.env</code> (Groq e Gemini têm plano gratuito) e reinicie a API.</p>`; return; }
    if (!info) { mpop.innerHTML = '<div class="mh"><b>Modelos de IA</b></div><p class="mnote">Carregando…</p>'; return; }
    const auto = !pick || pick.provider === 'auto';
    let h = `<div class="mh"><b>Modelos de IA</b><small>Hoje: ${fmtN(info.questionsToday)} / ${fmtN(info.dailyCap)} perguntas da demo</small></div>`;
    h += `<button type="button" class="mrow${auto ? ' on' : ''}" data-p="auto"><span class="dot"></span><span><b>Automático <em>recomendado</em></b><small>Usa o provedor principal e troca para o próximo se ele falhar.</small></span></button>`;
    for (const p of info.providers) {
      const all = p.models.length ? p.models : [p.current], open = expanded.has(p.name), shown = open ? all : all.slice(0, 6);
      h += `<div class="mprov"><div class="mpn"><b>${esc(p.label)}</b>${p.free ? '<i class="free">gratuito</i>' : '<i class="paid">pago</i>'}${p.primary ? '<i class="prim">principal</i>' : ''}${healthBadge(p.health)}</div>`;
      h += shown.map((id) => { const on = !auto && pick!.provider === p.name && (pick!.model ?? p.current) === id; return `<button type="button" class="mrow${on ? ' on' : ''}" data-p="${esc(p.name)}" data-m="${esc(id)}"><span class="dot"></span><span><b>${esc(id)}</b>${id === p.recommended ? '<em>recomendado</em>' : ''}${id === p.current && id !== p.recommended ? '<em class="cur">em uso</em>' : ''}</span></button>`; }).join('');
      if (all.length > 6) h += `<button type="button" class="mmore" data-more="${esc(p.name)}">${open ? 'mostrar menos' : `mostrar todos (${all.length})`}</button>`;
      h += quotaHtml(p) + '</div>';
    }
    h += `<p class="mnote">ℹ️ Os provedores não informam o <b>saldo em créditos</b> pela API. A cota acima vem dos limites que eles devolvem a cada resposta, mais o uso medido por este servidor. Ao escolher um modelo, o painel usa só ele — sem trocar por conta própria.</p>`;
    mpop.innerHTML = h;
  }
  mpop.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const more = t.closest<HTMLElement>('[data-more]'); if (more) { const n = more.dataset.more!; expanded.has(n) ? expanded.delete(n) : expanded.add(n); renderModels(); return; }
    const row = t.closest<HTMLElement>('.mrow[data-p]'); if (!row) return;
    const prov = row.dataset.p!; pick = prov === 'auto' ? null : { provider: prov, model: row.dataset.m }; savePick(pick);
    paintMode(); renderModels(); toggleModels(false);
  });
  function toggleModels(v: boolean) {
    mpop.hidden = !v; mbtn.classList.toggle('on', v); mbtn.setAttribute('aria-expanded', String(v));
    if (v) { renderModels(); void loadModels().then(() => { if (!mpop.hidden) renderModels(); }); }
  }
  mbtn.addEventListener('click', (e) => { e.stopPropagation(); toggleModels(mpop.hidden); });
  panel.addEventListener('click', (e) => { if (!mpop.hidden && !mpop.contains(e.target as Node) && !mbtn.contains(e.target as Node)) toggleModels(false); });

  const selectedLabel = () => {
    const s = host.getContext().selected; if (!s) return undefined;
    const d = host.data; const n = s.kind === 'machine' ? d.machines[s.index]?.name : s.kind === 'seller' ? d.sellers[s.index]?.name : d.lots[s.index]?.id;
    return n ? `${s.kind === 'machine' ? 'máquina' : s.kind === 'seller' ? 'vendedor(a)' : 'lote'} ${n}` : undefined;
  };

  async function viaClaude(q: string): Promise<AiReply> {
    const ctx = host.getContext();
    const r = await fetch(`${api}/api/ai/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ messages: [...history, { role: 'user', content: q }], context: { tab: ctx.tab, selected: selectedLabel() }, ...(pick && pick.provider !== 'auto' ? { provider: pick.provider, model: pick.model } : {}) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || `HTTP ${r.status}`);
    const meta = `${j.provider ?? label}${j.model ? ' · ' + j.model : ''} · ${j.tools?.length ? '🔍 consultou ' + j.tools.join(', ') + ' · ' : ''}${((j.usage?.input_tokens ?? 0) + (j.usage?.output_tokens ?? 0)).toLocaleString('pt-BR')} tokens`;
    return { text: j.text, actions: j.actions, meta, suggestions: Array.isArray(j.suggestions) ? j.suggestions : undefined };
  }

  async function ask(question: string) {
    const q = question.trim(); if (!q || busy) return;
    asked.push(q); if (asked.length > 20) asked.shift(); toggleModels(false);
    busy = true; input.value = ''; input.disabled = true;
    add('user', `<p>${esc(q)}</p>`);
    const typing = add('bot', '<div class="typing"><i></i><i></i><i></i></div>');
    let reply: AiReply, note = '', meta = '';
    try {
      if (llm) { reply = await viaClaude(q); meta = reply.meta ?? ''; }
      else { await new Promise((r) => setTimeout(r, 350)); reply = answerLocal(host.data, q, host.getContext()); meta = 'motor local · calculado no navegador'; }
    } catch (e) {
      note = `<p class="warn">⚠️ ${esc((e as Error).message || 'IA em nuvem indisponível')} — respondi com o motor local.</p>`;
      reply = answerLocal(host.data, q, host.getContext()); meta = 'motor local (fallback)';
    }
    typing.remove();
    add('bot', note + md(reply.text) + (reply.chart ? chartHtml(reply.chart) : '') + actionBtns(reply.actions) + `<small class="meta">${esc(meta)}</small>`, reply.actions);
    // pedidos de "mostrar/ver/onde fica" já levam a câmera sem precisar clicar
    if (reply.actions?.length && /\b(mostr\w+|ver|veja|leve|levar|onde|localiz\w+|abr\w+|foc\w+|va|ir)\b/.test(norm(q))) run(reply.actions[0]);
    lastReply = reply; aiChips = reply.suggestions?.length ? reply.suggestions : null;
    history.push({ role: 'user', content: q }, { role: 'assistant', content: reply.text }); if (history.length > 12) history.splice(0, history.length - 12);
    busy = false; input.disabled = false; input.focus(); renderChips();
  }

  // ── abrir/fechar ──
  function open(v: boolean) {
    panel.classList.toggle('open', v); btn.classList.toggle('on', v); btn.setAttribute('aria-expanded', String(v));
    if (v) { if (!greeted) { greeted = true; briefing(); } if (!detected) void detect().then(() => loadModels()); renderChips(); setTimeout(() => input.focus(), 50); }
  }
  btn.addEventListener('click', () => open(!panel.classList.contains('open')));
  panel.querySelector('.x')!.addEventListener('click', () => open(false));
  form.addEventListener('submit', (e) => { e.preventDefault(); void ask(input.value); });
  // teclas digitadas aqui não devem acionar atalhos do editor/câmera
  panel.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { if (!mpop.hidden) toggleModels(false); else open(false); } });
  document.getElementById('tabs')?.addEventListener('click', () => setTimeout(() => { aiChips = null; renderChips(); }, 0));
  (window as unknown as { __ai: unknown }).__ai = { ask, open, answer: (q: string) => answerLocal(host.data, q, host.getContext()) };
}
