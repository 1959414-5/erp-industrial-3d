import type { Dataset, Selection, TabKey } from './data';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const num = (n: number, d = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(n);
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch] ?? ch));

const M_STATUS = { run: ['Operando', '#394454'], idle: ['Parada', '#98a1ad'], down: ['Com falha', '#f26a1b'] } as const;
const S_STATUS = { online: ['Disponível', '#394454'], busy: ['Em atendimento', '#f26a1b'], away: ['Ausente', '#98a1ad'] } as const;
const TYPE_LABEL = { laser: 'Corte a laser', plasma: 'Corte a plasma', pressBrake: 'Dobradeira', cnc: 'Usinagem CNC', robotWelder: 'Solda robotizada', paintBooth: 'Pintura', punchPress: 'Puncionadeira', bandSaw: 'Serra de fita' } as const;
type LotState = 'empty' | 'critical' | 'full' | 'medium' | 'low';
const LOT_STYLES: Record<LotState, { label: string; color: string; glyph: string }> = {
  empty: { label: 'Sem estoque', color: '#9aa5b8', glyph: '—' },
  critical: { label: 'Abaixo do mínimo', color: '#e5484d', glyph: '!' },
  full: { label: 'Estoque saudável', color: '#394454', glyph: '✓' },
  medium: { label: 'Estoque médio', color: '#7f8997', glyph: '≈' },
  low: { label: 'Estoque baixo', color: '#aab2bd', glyph: '↓' },
};

function lotState(occ: number, qty: number, min: number): LotState {
  if (occ < 0.15 || qty <= 0) return 'empty';
  if (qty < min) return 'critical';
  if (occ > 0.8) return 'full';
  return occ > 0.5 ? 'medium' : 'low';
}

function lotDetailName(data: Dataset, index: number): string {
  const lot = data.lots[index];
  if (!lot) return 'Posição vazia';
  return `Lote ${lot.id} · ${lot.material} · ${num(lot.qty)} un · ${lot.location}`;
}

export function mountUi(data: Dataset, onTab: (t: TabKey) => void, onSelect: (s: Selection | null) => void) {
  const tabs = $('tabs'), left = $('left'), right = $('right'), bottom = $('bottom'), tip = $('tip'), card = $('card');
  let currentTab: TabKey = 'producao';
  let lotFilter: 'all' | 'critical' | 'low' | 'empty' = 'all';
  let selected: Selection | null = null;
  let searchTerm = '';

  (Object.keys(data.tabs) as TabKey[]).forEach((k) => {
    const b = document.createElement('button');
    const glyph = k === 'producao' ? '▥' : k === 'estoque' ? '▦' : '▤';
    b.className = 'module-link';
    b.innerHTML = `<span class="module-icon" aria-hidden="true">${glyph}</span><span class="module-name">${escapeHtml(data.tabs[k].title)}</span>`;
    b.dataset.k = k;
    b.title = data.tabs[k].title;
    b.onclick = () => { window.location.assign('https://1959414-5.github.io/meu-portfolio/projeto-erp-industrial-3d.html'); };
    tabs.appendChild(b);
  });

  const statusForLot = (index: number): LotState => {
    const lot = data.lots[index];
    return lotState(data.occupancy[index] ?? 0, lot?.qty ?? 0, lot?.minQty ?? 0);
  };

  function bottomFor(k: TabKey) {
    if (k === 'producao') {
      const oee = Math.round(data.machines.reduce((sum, machine) => sum + machine.oee, 0) / Math.max(1, data.machines.length));
      const rows = data.machines.map((m, i) => ({ m, i })).filter(({ m }) => m.name.toLocaleLowerCase('pt-BR').includes(searchTerm));
      bottom.innerHTML = `<div class="bottom-content">
        <div class="bottom-heading"><div><span class="panel-overline">VISÃO OPERACIONAL</span><h3>Máquinas · OEE médio ${oee}%</h3></div><span class="bottom-count">${rows.length} de ${data.machines.length}</span></div>
        <div class="chips">${rows.map(({ m, i }) =>
          `<button class="chip" data-k="machine" data-i="${i}"><span class="dot" style="background:${M_STATUS[m.status][1]}"></span>${escapeHtml(m.name)}<b>${m.oee}%</b></button>`).join('') || '<span class="empty-filter">Nenhuma máquina encontrada.</span>'}</div>
      </div>`;
    } else if (k === 'estoque') {
      const counts: Record<LotState, number> = { empty: 0, critical: 0, full: 0, medium: 0, low: 0 };
      data.lots.forEach((_lot, i) => { counts[statusForLot(i)] += 1; });
      const lotRows = data.lots.map((lot, i) => ({ lot, i, state: statusForLot(i), occ: data.occupancy[i] ?? 0 }))
        .filter((item) => (lotFilter === 'all'
          || (lotFilter === 'critical' && item.state === 'critical')
          || (lotFilter === 'low' && (item.state === 'low' || item.state === 'medium'))
          || (lotFilter === 'empty' && item.state === 'empty'))
          && [item.lot.id, item.lot.material, item.lot.location].some((value) => value.toLocaleLowerCase('pt-BR').includes(searchTerm)));
      const filters = [
        ['all', 'Todos', data.lots.length],
        ['critical', 'Críticos', counts.critical],
        ['low', 'Atenção', counts.low + counts.medium],
        ['empty', 'Vazios', counts.empty],
      ] as const;
      bottom.innerHTML = `<div class="bottom-content stock-bottom">
        <div class="bottom-heading"><div><span class="panel-overline">MAPA DE ARMAZENAGEM</span><h3>Lotes de chapas · ocupação</h3></div><span class="bottom-count">${lotRows.length} de ${data.lots.length} lotes</span></div>
        <div class="stock-toolbar">
          <div class="stock-filters">${filters.map(([key, label, count]) =>
            `<button class="stock-filter ${lotFilter === key ? 'on' : ''}" data-lot-filter="${key}" aria-pressed="${lotFilter === key}">${label}<b>${count}</b></button>`).join('')}</div>
          <div class="stock-legend">
            <span><i style="background:${LOT_STYLES.full.color}"></i> Saudável</span>
            <span><i style="background:${LOT_STYLES.medium.color}"></i> Médio</span>
            <span><i style="background:${LOT_STYLES.critical.color}"></i> Crítico</span>
            <span><i style="background:${LOT_STYLES.empty.color}"></i> Vazio</span>
          </div>
        </div>
        <div class="heat" aria-label="Selecione um lote para localizar na fábrica 3D">${lotRows.length
          ? lotRows.map(({ lot, i, state, occ }) =>
            `<button class="cell state-${state} ${selected?.kind === 'lot' && selected.index === i ? 'is-selected' : ''}" data-k="lot" data-i="${i}"
              title="${escapeHtml(lotDetailName(data, i))}" aria-label="${escapeHtml(lotDetailName(data, i))}"
              style="--lot-fill:${Math.round(Math.max(0, Math.min(1, occ)) * 100)}%"><span>${i + 1}</span></button>`).join('')
          : '<div class="empty-filter">Nenhum lote corresponde a este filtro.</div>'}</div>
        <div class="stock-hint">Selecione um lote para abrir os detalhes e localizar sua posição na fábrica.</div>
      </div>`;
    } else {
      const goal = Math.round(data.sellers.reduce((sum, seller) => sum + seller.goalPct, 0) / Math.max(1, data.sellers.length));
      const rows = data.sellers.map((v, i) => ({ v, i })).filter(({ v }) => v.name.toLocaleLowerCase('pt-BR').includes(searchTerm));
      bottom.innerHTML = `<div class="bottom-content">
        <div class="bottom-heading"><div><span class="panel-overline">DESEMPENHO COMERCIAL</span><h3>Vendedores · meta média ${goal}%</h3></div><span class="bottom-count">${rows.length} de ${data.sellers.length}</span></div>
        <div class="chips">${rows.map(({ v, i }) =>
          `<button class="chip" data-k="seller" data-i="${i}"><span class="dot" style="background:${S_STATUS[v.status][1]}"></span>${escapeHtml(v.name.split(' ')[0])}<b>${v.goalPct}%</b></button>`).join('') || '<span class="empty-filter">Nenhum vendedor encontrado.</span>'}</div>
      </div>`;
    }
  }

  bottom.onclick = (e) => {
    const target = e.target as HTMLElement;
    const filter = target.closest<HTMLButtonElement>('[data-lot-filter]');
    if (filter) {
      lotFilter = filter.dataset.lotFilter as typeof lotFilter;
      bottomFor('estoque');
      return;
    }
    const el = target.closest<HTMLElement>('[data-k][data-i]');
    if (!el) return;
    const kind = el.dataset.k as Selection['kind'];
    const index = Number(el.dataset.i);
    if (!Number.isInteger(index) || index < 0) return;
    onSelect({ kind, index } as Selection);
  };

  function kpiGlyph(label: string): string {
    const value = label.toLowerCase();
    if (value.includes('valor') || value.includes('faturamento') || value.includes('ticket')) return 'R$';
    if (value.includes('pedido') || value.includes('ordem')) return '▤';
    if (value.includes('estoque') || value.includes('produto')) return '▦';
    if (value.includes('refugo') || value.includes('falha') || value.includes('abaixo')) return '!';
    if (value.includes('aprovação') || value.includes('cumprimento')) return '✓';
    return '◈';
  }

  function select(k: TabKey) {
    currentTab = k;
    if (k !== 'estoque') lotFilter = 'all';
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.k === k));
    const current = document.getElementById('current-module');
    const inspectorTitle = document.getElementById('inspector-title');
    if (current) current.textContent = data.tabs[k].title;
    if (inspectorTitle) inspectorTitle.textContent = data.tabs[k].title;
    const tab = data.tabs[k];
    left.className = 'glass';
    left.innerHTML = `<div class="panel-heading"><div><span class="panel-overline">RESUMO OPERACIONAL</span><h3>Indicadores</h3></div><button class="panel-collapse" data-collapse="left" aria-label="Recolher indicadores" aria-expanded="true">−</button></div>
      <div class="kpi-grid">${tab.kpis.map((item, index) => `<article class="kpi" style="--kpi-index:${index}">
        <div class="kpi-head"><span class="kpi-icon">${escapeHtml(kpiGlyph(item.label))}</span><small>${escapeHtml(item.label)}</small></div>
        <div class="kpi-value-line"><b class="kpi-value" title="${escapeHtml(item.value)}">${escapeHtml(item.value)}</b>
        ${item.delta === undefined ? '' : `<i class="${item.delta >= 0 ? 'up' : 'down'}">${item.delta >= 0 ? '▲' : '▼'} ${num(Math.abs(item.delta), 1)}%</i>`}</div>
      </article>`).join('')}</div>`;

    const maxValue = Math.max(1, ...tab.series.items.map((item) => item.value));
    right.innerHTML = `<div class="panel-heading"><div><span class="panel-overline">INDICADORES NO TEMPO</span><h3>${escapeHtml(tab.series.title)}</h3></div><button class="panel-collapse" data-collapse="right" aria-label="Recolher gráfico" aria-expanded="true">−</button></div>
      <div class="bars">${tab.series.items.map((item, index) => {
        const percent = Math.max(0, Math.min(100, (item.value / maxValue) * 100));
        return `<div class="bar-row"><div class="bar-meta"><span>${escapeHtml(item.label)}</span><b>${num(item.value)}</b></div>
          <div class="bar-track"><span class="bar-fill tone-${index % 4}" style="width:${percent}%"></span></div></div>`;
      }).join('')}</div>`;
    bottomFor(k);
    onTab(k);
  }

  const search = document.getElementById('inspector-search') as HTMLInputElement | null;
  search?.addEventListener('input', () => {
    searchTerm = search.value.trim().toLocaleLowerCase('pt-BR');
    bottomFor(currentTab);
  });

  left.onclick = (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-collapse]');
    if (!button) return;
    const target = button.dataset.collapse === 'left' ? left : right;
    const collapsed = target.classList.toggle('collapsed');
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? 'Expandir painel' : 'Recolher painel');
    button.textContent = collapsed ? '+' : '−';
  };
  right.onclick = (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-collapse]');
    if (!button) return;
    const target = button.dataset.collapse === 'left' ? left : right;
    const collapsed = target.classList.toggle('collapsed');
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? 'Expandir gráfico' : 'Recolher gráfico');
    button.textContent = collapsed ? '+' : '−';
  };

  const row = (items: [string, string][]) => `<div class="rows">${items.map(([label, value]) => `<span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b>`).join('')}</div>`;
  const meter = (label: string, pct: number, color: string) => `<div class="mlabel"><span>${escapeHtml(label)}</span><b>${num(pct)}%</b></div><div class="meter"><span style="width:${Math.max(0, Math.min(pct, 100))}%;background:${color}"></span></div>`;

  function detail(selection: Selection) {
    if (selection.kind === 'machine') {
      const machine = data.machines[selection.index], [status, color] = M_STATUS[machine.status];
      return { kicker: machine.type ? TYPE_LABEL[machine.type] : 'Máquina', title: machine.name, status, color, body: row([
        ...(machine.order ? [['Ordem atual', machine.order] as [string, string]] : []),
        ...(machine.producedToday !== undefined ? [['Produzido no período', num(machine.producedToday) + ' un'] as [string, string]] : []),
        ...(machine.scrapPct !== undefined ? [['Refugo', num(machine.scrapPct, 1) + '%'] as [string, string]] : []),
      ]) + meter('OEE estimado', machine.oee, color) };
    }
    if (selection.kind === 'lot') {
      const lot = data.lots[selection.index];
      const occ = data.occupancy[selection.index] ?? 0;
      const state = LOT_STYLES[statusForLot(selection.index)];
      return { kicker: 'Lote de chapas', title: lot.id, status: state.label, color: state.color, body: row([
        ['Material', lot.material], ['Espessura', num(lot.thickness, 2) + ' mm'], ['Dimensão', lot.size],
        ['Chapas', num(lot.qty) + ' un'], ['Peso', num(lot.weightKg) + ' kg'], ['Valor estimado', brl(lot.value)],
        ['Estoque mínimo', num(lot.minQty) + ' un'], ['Local', lot.location],
      ]) + meter('Ocupação', occ * 100, state.color) };
    }
    const seller = data.sellers[selection.index], [status, color] = S_STATUS[seller.status];
    return { kicker: 'Vendedor(a)', title: seller.name, status, color, body: row([
      ['Faturamento', brl(seller.revenue)], ['Pedidos', num(seller.orders)], ['Em aberto', num(seller.openOrders)],
      ['Ticket médio', brl(seller.revenue / Math.max(seller.orders, 1))], ['Principal cliente', seller.topClient],
    ]) + meter('Meta do período', seller.goalPct, seller.goalPct >= 100 ? '#22b573' : '#f26a1b') };
  }

  const isEmpty = (selection: Selection) => selection.kind === 'lot' && !data.lots[selection.index];
  const name = (selection: Selection) => {
    if (isEmpty(selection)) return 'Posição vazia';
    if (selection.kind === 'machine') return data.machines[selection.index]?.name ?? 'Máquina';
    if (selection.kind === 'lot') return lotDetailName(data, selection.index);
    return data.sellers[selection.index]?.name ?? 'Vendedor(a)';
  };

  function paintSelected() {
    bottom.querySelectorAll<HTMLElement>('[data-k][data-i]').forEach((el) => {
      const sameItem = selected?.kind === el.dataset.k && selected?.index === Number(el.dataset.i);
      el.classList.toggle('is-selected', Boolean(sameItem));
    });
  }

  return {
    select,
    showTip(selection: Selection | null, x: number, y: number) {
      if (!selection) { tip.style.display = 'none'; return; }
      tip.style.display = 'block';
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
      tip.textContent = name(selection);
    },
    pin(selection: Selection | null) {
      selected = selection;
      paintSelected();
      if (!selection || isEmpty(selection)) { card.style.display = 'none'; card.classList.remove('is-below'); return; }
      const detailData = detail(selection);
      card.innerHTML = `<button class="x" aria-label="Fechar">×</button><small>${escapeHtml(detailData.kicker)}</small><h4>${escapeHtml(detailData.title)}</h4>
        <span class="st" style="background:${detailData.color}22;color:${detailData.color}">${escapeHtml(detailData.status)}</span>${detailData.body}`;
      card.querySelector('.x')!.addEventListener('click', () => onSelect(null));
      card.style.display = 'block';
      tip.style.display = 'none';
    },
    place(x: number, y: number, visible: boolean) {
      if (card.style.display !== 'block') return;
      const canvas = document.getElementById('scene');
      const rect = canvas?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        card.style.visibility = 'hidden';
        return;
      }

      const width = card.offsetWidth || 220;
      const height = card.offsetHeight || 180;
      const withinFrame = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      card.style.visibility = visible && withinFrame ? 'visible' : 'hidden';
      if (!visible || !withinFrame) return;

      const minX = rect.left + width / 2 + 8;
      const maxX = rect.right - width / 2 - 8;
      const left = minX <= maxX ? Math.min(Math.max(x, minX), maxX) : rect.left + rect.width / 2;
      card.style.left = left + 'px';

      // Sempre tenta manter o cartão acima do objeto; só o coloca abaixo quando
      // não existe altura livre suficiente no topo do quadro 3D.
      const canStayAbove = y - height - 14 >= rect.top + 6;
      card.classList.toggle('is-below', !canStayAbove);
      if (canStayAbove) {
        card.style.top = Math.min(y - 12, rect.bottom - 8) + 'px';
      } else {
        card.style.top = Math.min(y + 12, rect.bottom - height - 8) + 'px';
      }
    },
  };
}
