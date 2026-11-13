import type { Dataset, Selection, TabKey } from './data';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const num = (n: number, d = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(n);
const M_STATUS = { run: ['Operando', '#22b573'], idle: ['Parada', '#f5b83d'], down: ['Com falha', '#e5484d'] } as const;
const S_STATUS = { online: ['Disponível', '#22b573'], busy: ['Em atendimento', '#f26a1b'], away: ['Ausente', '#9aa5b8'] } as const;
const TYPE_LABEL = { laser: 'Corte a laser', pressBrake: 'Dobradeira', cnc: 'Usinagem CNC', robotWelder: 'Solda robotizada', paintBooth: 'Pintura', punchPress: 'Puncionadeira', bandSaw: 'Serra de fita' } as const;

function lotLevel(occ: number, qty: number, min: number): [string, string] {
  if (occ < 0.15) return ['Vazio', '#9aa5b8'];
  if (qty < min) return ['Abaixo do mínimo', '#e5484d'];
  if (occ > 0.8) return ['Cheio', '#f26a1b'];
  return occ > 0.5 ? ['Médio', '#f5a25d'] : ['Baixo', '#3b82f6'];
}

export function mountUi(data: Dataset, onTab: (t: TabKey) => void, onSelect: (s: Selection | null) => void) {
  const tabs = $('tabs'), left = $('left'), right = $('right'), bottom = $('bottom'), tip = $('tip'), card = $('card');
  (Object.keys(data.tabs) as TabKey[]).forEach((k) => {
    const b = document.createElement('button'); b.textContent = data.tabs[k].title; b.dataset.k = k; b.onclick = () => select(k); tabs.appendChild(b);
  });

  const heat = (v: number) => (v < 0.15 ? '#e8edf6' : v > 0.8 ? '#f26a1b' : v > 0.5 ? '#f5b783' : '#aab3c2');
  function bottomFor(k: TabKey) {
    if (k === 'producao') {
      const oee = Math.round(data.machines.reduce((s, m) => s + m.oee, 0) / data.machines.length);
      bottom.innerHTML = `<div style="flex:1"><h3>Máquinas · OEE médio ${oee}%</h3><div class="chips">${data.machines.map((m, i) =>
        `<button class="chip" data-k="machine" data-i="${i}"><span class="dot" style="background:${M_STATUS[m.status][1]}"></span>${m.name}<b>${m.oee}%</b></button>`).join('')}</div></div>`;
    } else if (k === 'estoque') {
      const cnt = [0, 0, 0, 0]; data.occupancy.forEach((v) => { cnt[v < 0.15 ? 3 : v > 0.8 ? 0 : v > 0.5 ? 1 : 2]++; });
      bottom.innerHTML = `<div style="flex:1"><h3>Lotes de chapas · ocupação</h3><div class="heat">${data.occupancy.map((v, i) =>
        `<button class="cell" data-k="lot" data-i="${i}" title="${data.lots[i]?.id ?? ''}" style="background:${heat(v)}"></button>`).join('')}</div></div>
        <div class="legend">${[['Cheio', '#f26a1b'], ['Médio', '#f5b783'], ['Baixo', '#aab3c2'], ['Vazio', '#e8edf6']].map(([t, c], i) =>
        `<div><span class="dot" style="background:${c}"></span>${t}: <b>${cnt[i]}</b></div>`).join('')}</div>`;
    } else {
      const goal = Math.round(data.sellers.reduce((s, v) => s + v.goalPct, 0) / data.sellers.length);
      bottom.innerHTML = `<div style="flex:1"><h3>Vendedores · meta média ${goal}%</h3><div class="chips">${data.sellers.map((v, i) =>
        `<button class="chip" data-k="seller" data-i="${i}"><span class="dot" style="background:${S_STATUS[v.status][1]}"></span>${v.name.split(' ')[0]}<b>${v.goalPct}%</b></button>`).join('')}</div></div>`;
    }
  }
  bottom.onclick = (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-k]'); if (!el) return;
    onSelect({ kind: el.dataset.k as Selection['kind'], index: Number(el.dataset.i) });
  };

  function select(k: TabKey) {
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.k === k));
    const t = data.tabs[k];
    left.className = 'glass' + (t.kpis.length > 4 ? ' two' : '');
    left.innerHTML = t.kpis.map((x) => `<div class="kpi"><small>${x.label}</small><b>${x.value}</b>${
      x.delta === undefined ? '' : `<i class="${x.delta >= 0 ? 'up' : 'down'}">${x.delta >= 0 ? '▲' : '▼'} ${num(Math.abs(x.delta), 1)}%</i>`}</div>`).join('');
    const max = Math.max(...t.series.items.map((i) => i.value));
    right.innerHTML = `<h3>${t.series.title}</h3><div class="bars">${t.series.items
      .map((i) => `<div class="bar"><span style="height:0" data-h="${(i.value / max) * 100}"></span>${i.label}</div>`).join('')}</div>`;
    requestAnimationFrame(() => right.querySelectorAll<HTMLElement>('span[data-h]').forEach((s) => { s.style.height = s.dataset.h + '%'; }));
    bottomFor(k); onTab(k);
  }

  const row = (r: [string, string][]) => `<div class="rows">${r.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div>`;
  const meter = (label: string, pct: number, c: string) => `<div class="mlabel"><span>${label}</span><b>${num(pct)}%</b></div><div class="meter"><span style="width:${Math.min(pct, 100)}%;background:${c}"></span></div>`;

  function detail(s: Selection) {
    if (s.kind === 'machine') {
      const m = data.machines[s.index], [st, c] = M_STATUS[m.status];
      return { kicker: m.type ? TYPE_LABEL[m.type] : 'Máquina', title: m.name, st, c, body: row([
        ...(m.order ? [['Ordem atual', m.order] as [string, string]] : []),
        ...(m.producedToday !== undefined ? [['Produzido hoje', num(m.producedToday) + ' un'] as [string, string]] : []),
        ...(m.scrapPct !== undefined ? [['Refugo', num(m.scrapPct, 1) + '%'] as [string, string]] : [])]) + meter('OEE', m.oee, c) };
    }
    if (s.kind === 'lot') {
      const l = data.lots[s.index], occ = data.occupancy[s.index] ?? 0, [st, c] = lotLevel(occ, l.qty, l.minQty);
      return { kicker: 'Lote de chapas', title: l.id, st, c, body: row([['Material', l.material], ['Espessura', num(l.thickness, 2) + ' mm'], ['Dimensão', l.size],
        ['Chapas', num(l.qty) + ' un'], ['Peso', num(l.weightKg) + ' kg'], ['Valor estimado', brl(l.value)], ['Estoque mínimo', num(l.minQty) + ' un'], ['Local', l.location]]) + meter('Ocupação', occ * 100, c) };
    }
    const v = data.sellers[s.index], [st, c] = S_STATUS[v.status];
    return { kicker: 'Vendedor(a)', title: v.name, st, c, body: row([['Faturamento', brl(v.revenue)], ['Pedidos', num(v.orders)], ['Em aberto', num(v.openOrders)],
      ['Ticket médio', brl(v.revenue / Math.max(v.orders, 1))], ['Principal cliente', v.topClient]]) + meter('Meta do período', v.goalPct, v.goalPct >= 100 ? '#22b573' : '#f26a1b') };
  }

  // posição vazia = lote sem dados (o pátio 3D tem mais posições do que lotes cadastrados)
  const isEmpty = (s: Selection) => s.kind === 'lot' && !data.lots[s.index];
  const name = (s: Selection) => {
    if (isEmpty(s)) return 'Posição vazia';
    return (s.kind === 'machine' ? data.machines[s.index]?.name : s.kind === 'lot' ? `Lote ${data.lots[s.index]?.id} · ${data.lots[s.index]?.material}` : data.sellers[s.index]?.name) ?? '';
  };
  return {
    select,
    showTip(s: Selection | null, x: number, y: number) {
      if (!s) { tip.style.display = 'none'; return; }
      tip.style.display = 'block'; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.textContent = name(s);
    },
    pin(s: Selection | null) {
      if (!s || isEmpty(s)) { card.style.display = 'none'; return; }
      const d = detail(s);
      card.innerHTML = `<button class="x" aria-label="Fechar">×</button><small>${d.kicker}</small><h4>${d.title}</h4><span class="st" style="background:${d.c}22;color:${d.c}">${d.st}</span>${d.body}`;
      card.querySelector('.x')!.addEventListener('click', () => onSelect(null)); card.style.display = 'block'; tip.style.display = 'none';
    },
    place(x: number, y: number, visible: boolean) {
      if (card.style.display !== 'block') return;
      card.style.visibility = visible ? 'visible' : 'hidden';
      card.style.left = Math.min(Math.max(x, 150), innerWidth - 150) + 'px'; card.style.top = Math.max(y - 12, card.offsetHeight + 12) + 'px';
    },
  };
}
