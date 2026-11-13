// ai-local.ts — motor de análise OFFLINE do assistente.
// Roda 100% no navegador sobre o Dataset já carregado (API, snapshot ou exemplo). Não usa nenhum serviço externo.
// Faz: detecção de intenção em PT-BR, reconhecimento de entidades (máquina/vendedor/lote), estatística (média, desvio,
// z-score, regressão linear p/ projeção) e geração de insights com ação no 3D.
// Quando a API com Claude está ativa, este mesmo módulo fornece os "insights automáticos" e é o fallback das respostas.
import type { Dataset, Machine, Seller, Lot, Selection, TabKey } from './data';

export type AiAction =
  | { type: 'focus'; kind: Selection['kind']; ref: string; label: string }
  | { type: 'tab'; tab: TabKey; label: string };
export interface AiChart { title: string; unit?: string; items: { label: string; value: number; forecast?: boolean }[] }
export interface AiReply { text: string; actions?: AiAction[]; chart?: AiChart; meta?: string; suggestions?: string[] }
export interface AiContext { tab: TabKey; selected?: Selection | null }
export interface Insight { severity: 'critical' | 'warn' | 'info' | 'good'; title: string; detail: string; tab: TabKey; action?: AiAction }

// ───────────────────────── utilitários ─────────────────────────
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const nf = (n: number, d = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n);
const brl = (v: number) => (Math.abs(v) >= 1e6 ? `R$ ${nf(v / 1e6, 2)} mi` : Math.abs(v) >= 1e3 ? `R$ ${nf(v / 1e3, 1)} mil` : `R$ ${nf(v)}`);
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const std = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const first = (n: string) => n.split(' ')[0];
const TAB_LABEL: Record<TabKey, string> = { producao: 'Produção', estoque: 'Estoque', comercial: 'Comercial' };

/** "R$ 2,41 mi" → 2410000 · "96,8%" → 96.8 · "12.480" → 12480 */
export function parseKpi(s: string): number {
  const low = s.toLowerCase(); const mult = /\bmi\b/.test(low) ? 1e6 : /\bmil\b/.test(low) ? 1e3 : 1;
  const v = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v * mult : NaN;
}

export function linreg(y: number[]) {
  const n = y.length, xs = y.map((_, i) => i), mx = mean(xs), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (y[i] - my); sxx += (xs[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  const slope = sxx ? sxy / sxx : 0, intercept = my - slope * mx, r2 = syy && sxx ? (sxy * sxy) / (sxx * syy) : 0;
  const resid = y.map((v, i) => v - (intercept + slope * i));
  return { slope, intercept, r2, sd: std(resid) };
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function nextLabels(labels: string[], n: number): string[] {
  const last = norm(labels[labels.length - 1] ?? ''), cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const mi = MONTHS.indexOf(last.slice(0, 3));
  if (mi >= 0) return Array.from({ length: n }, (_, k) => cap(MONTHS[(mi + k + 1) % 12]));
  const WK = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], wi = WK.indexOf(last.slice(0, 3));   // semana útil (seg–sáb)
  if (wi >= 0) return Array.from({ length: n }, (_, k) => cap(['seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][(wi + k + 1) % 6]));
  const m = last.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) { const d = new Date(2024, Number(m[2]) - 1, Number(m[1])); return Array.from({ length: n }, () => { d.setDate(d.getDate() + 1); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; }); }
  return Array.from({ length: n }, (_, k) => `P+${k + 1}`);
}

// ───────────────────────── resolução de entidades ─────────────────────────
export function resolveRef(data: Dataset, kind: Selection['kind'], ref: string): number {
  const r = norm(ref);
  const list: string[] = kind === 'machine' ? data.machines.map((m) => m.id) : kind === 'seller' ? data.sellers.map((s) => s.id) : data.lots.map((l) => l.id);
  let i = list.findIndex((id) => norm(id) === r); if (i >= 0) return i;
  const names: string[] = kind === 'machine' ? data.machines.map((m) => m.name) : kind === 'seller' ? data.sellers.map((s) => s.name) : data.lots.map((l) => l.id);
  i = names.findIndex((n) => norm(n) === r); if (i >= 0) return i;
  i = names.findIndex((n) => norm(n).includes(r) || r.includes(norm(n))); return i;
}

const TYPE_WORDS: [RegExp, Machine['type']][] = [
  [/\b(laser|corte)\b/, 'laser'], [/\b(dobradeira|dobra)s?\b/, 'pressBrake'], [/\b(usinagem|centro de usinagem|cnc)\b/, 'cnc'],
  [/\b(solda|soldagem|soldador\w*)\b/, 'robotWelder'], [/\b(pintura|cabine)s?\b/, 'paintBooth'], [/\b(puncion\w+|punch)\b/, 'punchPress'], [/\b(serra|fita)s?\b/, 'bandSaw'],
];
const machineNo = (m: Machine) => { const x = m.name.match(/(\d+)\s*$/); return x ? Number(x[1]) : NaN; };

interface Found { kind: Selection['kind']; index: number }
function findEntities(q: string, d: Dataset, ctx: AiContext): { items: Found[]; type?: Machine['type'] } {
  const items: Found[] = []; const add = (f: Found) => { if (!items.some((x) => x.kind === f.kind && x.index === f.index)) items.push(f); };
  // vendedores: nome completo ou primeiro nome
  d.sellers.forEach((s, index) => { const n = norm(s.name); if (q.includes(n) || new RegExp(`\\b${norm(first(s.name))}\\b`).test(q)) add({ kind: 'seller', index }); });
  // lotes: id (L-012 / código do produto)
  d.lots.forEach((l, index) => { const id = norm(l.id); if (id.length > 2 && q.includes(id)) add({ kind: 'lot', index }); });
  const lm = q.match(/\bl-?(\d{1,3})\b/); if (lm) { const idx = d.lots.findIndex((l) => norm(l.id) === `l-${lm[1].padStart(3, '0')}`); if (idx >= 0) add({ kind: 'lot', index: idx }); }
  // máquinas: id (m10), nome completo, ou "tipo + número"
  d.machines.forEach((m, index) => { if (q.includes(norm(m.name))) add({ kind: 'machine', index }); });
  const mid = q.match(/\bm(\d{1,2})\b/); if (mid) { const idx = d.machines.findIndex((m) => m.id === `m${mid[1]}`); if (idx >= 0) add({ kind: 'machine', index: idx }); }
  // tipo de máquina citado (vale a palavra que aparece primeiro: "puncionadeira cnc 01" → puncionadeira)
  let type: Machine['type'] | undefined, best: { t: Machine['type']; idx: number; len: number } | undefined;
  for (const [re, t] of TYPE_WORDS) { const m = re.exec(q); if (m && (!best || m.index < best.idx)) best = { t, idx: m.index, len: m[0].length }; }
  if (best) {
    type = best.t; const num = q.slice(best.idx + best.len).match(/^\D{0,12}?(\d{1,2})\b/);
    if (num) d.machines.forEach((mc, index) => { if (mc.type === best!.t && machineNo(mc) === Number(num[1])) add({ kind: 'machine', index }); });
  }
  if (!items.length && /\b(essa|esse|esta|este|ela|ele|dela|dele|selecionad[oa]|aquela|aquele)\b/.test(q) && ctx.selected && (ctx.selected.kind !== 'lot' || d.lots[ctx.selected.index])) add({ kind: ctx.selected.kind, index: ctx.selected.index });
  return { items, type };
}

// ───────────────────────── insights automáticos ─────────────────────────
const act = (kind: Selection['kind'], ref: string, label: string): AiAction => ({ type: 'focus', kind, ref, label });
const SEV_ORDER = { critical: 0, warn: 1, info: 2, good: 3 } as const;
const SEV_ICON = { critical: '🔴', warn: '🟠', info: '🔵', good: '🟢' } as const;

export function buildInsights(d: Dataset): Insight[] {
  const out: Insight[] = [];
  const ms = d.machines, ss = d.sellers;

  // — Produção —
  if (ms.length) {
    const avgOee = mean(ms.map((m) => m.oee));
    for (const m of ms.filter((x) => x.status === 'down')) {
      out.push({ severity: 'critical', tab: 'producao', title: `${m.name} com falha`, detail: `OEE ${m.oee}%${m.order ? `, ordem ${m.order} interrompida` : ''}. Acionar manutenção e realocar a ordem para outra máquina do mesmo tipo.`, action: act('machine', m.id, `Ver ${m.name} no 3D`) });
    }
    const scraps = ms.map((m) => m.scrapPct ?? 0), sMean = mean(scraps), sSd = std(scraps);
    const worstScrap = ms.reduce((a, b) => ((b.scrapPct ?? 0) > (a.scrapPct ?? 0) ? b : a));
    if ((worstScrap.scrapPct ?? 0) > Math.max(sMean + sSd, 3)) {
      out.push({ severity: 'warn', tab: 'producao', title: `Refugo alto em ${worstScrap.name}`, detail: `${nf(worstScrap.scrapPct ?? 0, 1)}% contra média de ${nf(sMean, 1)}% da fábrica. Verificar parâmetros/ferramental.`, action: act('machine', worstScrap.id, `Ver ${worstScrap.name}`) });
    }
    const low = ms.filter((m) => m.status !== 'down' && m.oee < avgOee - 10).sort((a, b) => a.oee - b.oee);
    if (low[0]) out.push({ severity: 'warn', tab: 'producao', title: `OEE baixo: ${low[0].name} (${low[0].oee}%)`, detail: `${nf(avgOee - low[0].oee)} p.p. abaixo da média da fábrica (${nf(avgOee)}%).${low.length > 1 ? ` Também abaixo: ${low.slice(1, 3).map((m) => m.name).join(', ')}.` : ''}`, action: act('machine', low[0].id, `Ver ${low[0].name}`) });
    const idle = ms.filter((m) => m.status === 'idle');
    if (idle.length) out.push({ severity: 'info', tab: 'producao', title: `${idle.length} máquina${idle.length > 1 ? 's' : ''} parada${idle.length > 1 ? 's' : ''}`, detail: idle.map((m) => m.name).join(', ') + '. Avaliar balanceamento de carga.', action: act('machine', idle[0].id, `Ver ${idle[0].name}`) });
    const best = ms.reduce((a, b) => (b.oee > a.oee ? b : a));
    out.push({ severity: 'good', tab: 'producao', title: `Melhor desempenho: ${best.name} (${best.oee}%)`, detail: `Referência de boas práticas para as demais ${TYPE_PT[best.type ?? 'laser']?.toLowerCase() ?? 'máquinas'}.`, action: act('machine', best.id, `Ver ${best.name}`) });
  }
  const pItems = d.tabs.producao.series.items;
  if (pItems.length >= 4) {
    const v = pItems.map((i) => i.value), m = mean(v.slice(0, -1)), sd = std(v.slice(0, -1)), last = v[v.length - 1];
    if (sd > 0 && (m - last) / sd > 1.5) out.push({ severity: 'warn', tab: 'producao', title: `Queda na produção em ${pItems[pItems.length - 1].label}`, detail: `${nf(last)} un, ${nf(((m - last) / m) * 100)}% abaixo da média dos dias anteriores (${nf(m)}). Pode ser turno parcial — confirmar.`, action: { type: 'tab', tab: 'producao', label: 'Abrir Produção' } });
  }

  // — Estoque —
  const below = d.lots.map((l, i) => ({ l, i, occ: d.occupancy[i] ?? 0 })).filter((x) => x.l.qty < x.l.minQty);
  if (below.length) {
    const worst = below.sort((a, b) => (b.l.minQty - b.l.qty) - (a.l.minQty - a.l.qty));
    out.push({ severity: worst.some((x) => x.l.qty === 0) ? 'critical' : 'warn', tab: 'estoque', title: `${below.length} lote${below.length > 1 ? 's' : ''} abaixo do estoque mínimo`, detail: `Maior déficit: ${worst[0].l.id} · ${worst[0].l.material} (${worst[0].l.qty}/${worst[0].l.minQty} chapas). Gerar solicitação de compra.`, action: act('lot', worst[0].l.id, `Ver ${worst[0].l.id}`) });
  }
  const totalVal = sum(d.lots.map((l) => l.value));
  if (totalVal > 0 && d.lots.length >= 6) {
    const top = [...d.lots].sort((a, b) => b.value - a.value).slice(0, 3), share = (sum(top.map((l) => l.value)) / totalVal) * 100;
    if (share > 35) out.push({ severity: 'info', tab: 'estoque', title: `Capital concentrado: 3 lotes = ${nf(share)}% do estoque`, detail: `${top.map((l) => l.id).join(', ')} somam ${brl(sum(top.map((l) => l.value)))} de ${brl(totalVal)}.`, action: act('lot', top[0].id, `Ver ${top[0].id}`) });
  }
  const full = d.occupancy.filter((o) => o > 0.8).length;
  if (full > 0 && d.occupancy.length) out.push({ severity: 'info', tab: 'estoque', title: `${full} posições do pátio com ocupação acima de 80%`, detail: `${nf((full / d.occupancy.length) * 100)}% do pátio quase cheio — planejar giro/escoamento.`, action: { type: 'tab', tab: 'estoque', label: 'Abrir Estoque' } });

  // — Comercial —
  if (ss.length) {
    const avgGoal = mean(ss.map((s) => s.goalPct));
    const lowS = ss.filter((s) => s.goalPct < 70).sort((a, b) => a.goalPct - b.goalPct);
    if (lowS[0]) out.push({ severity: 'warn', tab: 'comercial', title: `${lowS.length} vendedor${lowS.length > 1 ? 'es' : ''} abaixo de 70% da meta`, detail: `${lowS.slice(0, 3).map((s) => `${first(s.name)} (${s.goalPct}%)`).join(', ')}. Meta média do time: ${nf(avgGoal)}%.`, action: act('seller', lowS[0].id, `Ver ${first(lowS[0].name)}`) });
    const awayOpen = ss.filter((s) => s.status === 'away' && s.openOrders >= 3).sort((a, b) => b.openOrders - a.openOrders)[0];
    if (awayOpen) out.push({ severity: 'warn', tab: 'comercial', title: `${first(awayOpen.name)} ausente com ${awayOpen.openOrders} pedidos em aberto`, detail: 'Redistribuir o atendimento para não atrasar os pedidos.', action: act('seller', awayOpen.id, `Ver ${first(awayOpen.name)}`) });
    const top = ss.reduce((a, b) => (b.revenue > a.revenue ? b : a)), totalRev = sum(ss.map((s) => s.revenue));
    out.push({ severity: 'good', tab: 'comercial', title: `Destaque: ${first(top.name)} — ${brl(top.revenue)}`, detail: `${nf((top.revenue / Math.max(totalRev, 1)) * 100)}% do faturamento do time, meta em ${top.goalPct}%.`, action: act('seller', top.id, `Ver ${first(top.name)}`) });
    const top3 = [...ss].sort((a, b) => b.revenue - a.revenue).slice(0, 3), sh = (sum(top3.map((s) => s.revenue)) / Math.max(totalRev, 1)) * 100;
    if (ss.length >= 6 && sh > 50) out.push({ severity: 'info', tab: 'comercial', title: `Receita concentrada: top 3 = ${nf(sh)}% do faturamento`, detail: `${top3.map((s) => first(s.name)).join(', ')}. Risco de dependência — desenvolver o restante do time.`, action: { type: 'tab', tab: 'comercial', label: 'Abrir Comercial' } });
  }
  const cItems = d.tabs.comercial.series.items;
  if (cItems.length >= 4 && cItems.some((i) => i.value > 0)) {
    const v = cItems.map((i) => i.value), r = linreg(v), nxt = Math.max(0, r.intercept + r.slope * v.length);
    out.push({ severity: r.slope < 0 ? 'warn' : 'info', tab: 'comercial', title: `Pedidos: tendência ${r.slope >= 0 ? 'de alta' : 'de queda'} (${r.slope >= 0 ? '+' : ''}${nf(r.slope, 1)} mil/mês)`, detail: `Projeção linear p/ ${nextLabels(cItems.map((i) => i.label), 1)[0]}: ≈ R$ ${nf(nxt)} mil (confiança ${confWord(r.r2)}).`, action: { type: 'tab', tab: 'comercial', label: 'Abrir Comercial' } });
  }
  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}
const confWord = (r2: number) => (r2 > 0.7 ? 'alta' : r2 > 0.4 ? 'moderada' : 'baixa');
const TYPE_PT: Record<string, string> = { laser: 'Corte a laser', pressBrake: 'Dobradeira', cnc: 'Usinagem CNC', robotWelder: 'Solda robotizada', paintBooth: 'Pintura', punchPress: 'Puncionadeira', bandSaw: 'Serra de fita' };

export function suggestions(tab: TabKey): string[] {
  return ({
    producao: ['Resumo executivo', 'Quais máquinas têm problema?', 'Qual máquina tem mais refugo?', 'Projeção da produção'],
    estoque: ['Quais lotes estão abaixo do mínimo?', 'Onde está o capital parado?', 'Resumo do estoque', 'Sugira uma reposição'],
    comercial: ['Quem está abaixo da meta?', 'Ranking de vendedores', 'Projeção de pedidos', 'Compare os dois melhores vendedores'],
  } as const)[tab].slice();
}

/** Sugestões "inteligentes": nascem dos dados atuais (insights), do item selecionado e da última resposta — não são fixas. */
export function smartSuggestions(d: Dataset, ctx: AiContext, asked: string[] = [], last?: AiReply): string[] {
  const out: string[] = [], seen = new Set(asked.map(norm));
  const add = (q: string) => { const k = norm(q); if (!seen.has(k)) { seen.add(k); out.push(q); } };
  const nameOf = (a: AiAction) => { if (a.type !== 'focus') return ''; const i = resolveRef(d, a.kind, a.ref); return i < 0 ? '' : a.kind === 'machine' ? d.machines[i].name : a.kind === 'seller' ? d.sellers[i].name : d.lots[i].id; };
  if (ctx.selected) { const s = ctx.selected, nm = s.kind === 'machine' ? d.machines[s.index]?.name : s.kind === 'seller' ? d.sellers[s.index]?.name : d.lots[s.index]?.id; if (nm) add(s.kind === 'lot' ? `Preciso repor o lote ${nm}?` : `Como está ${s.kind === 'seller' ? first(nm) : nm}?`); }
  const f = (last?.actions ?? []).filter((a): a is Extract<AiAction, { type: 'focus' }> => a.type === 'focus');
  const ms = f.filter((a) => a.kind === 'machine'), ss = f.filter((a) => a.kind === 'seller');
  if (ms.length >= 2) add(`Compare ${nameOf(ms[0])} e ${nameOf(ms[1])}`);
  if (ss.length >= 2) add(`Compare ${first(nameOf(ss[0]))} e ${first(nameOf(ss[1]))}`);
  for (const i of buildInsights(d)) {
    if (i.severity === 'good') continue;
    const a = i.action;
    if (a?.type === 'focus') { const n = nameOf(a); if (a.kind === 'lot') add('Sugira uma reposição'); else if (n) add(`Como está ${a.kind === 'seller' ? first(n) : n}?`); }
    else if (a?.type === 'tab' && i.tab !== 'estoque') add(i.tab === 'comercial' ? 'Projeção de pedidos' : 'Projeção da produção');
    if (out.length >= 4) break;
  }
  for (const g of suggestions(ctx.tab)) { if (out.length >= 6) break; add(g); }
  return out.slice(0, 6);
}

// ───────────────────────── respostas ─────────────────────────
const HELP = [
  'Sou o **assistente de dados** da fábrica. Posso:',
  '- 📊 **Resumir** a operação e apontar **riscos** ("resumo executivo", "quais os problemas?")',
  '- 🏭 Analisar **máquinas** (OEE, refugo, falhas, paradas) · 📦 **estoque** (abaixo do mínimo, capital parado, reposição) · 💼 **vendas** (metas, ranking, ticket)',
  '- 📈 **Projetar** tendências ("projeção de pedidos") e **comparar** ("compare Ana e Bruno")',
  '- 🎯 **Levar a câmera 3D** até o que você perguntar ("mostre a Solda Robotizada 02")',
].join('\n');

function bullets(rows: string[]) { return rows.map((r) => `- ${r}`).join('\n'); }
function machineLine(m: Machine) { return `**${m.name}** — OEE ${m.oee}%${m.scrapPct !== undefined ? `, refugo ${nf(m.scrapPct, 1)}%` : ''}`; }
const mAct = (m: Machine) => act('machine', m.id, `Ver ${m.name}`);

function describeMachine(d: Dataset, m: Machine): AiReply {
  const avg = mean(d.machines.map((x) => x.oee)), rank = [...d.machines].sort((a, b) => b.oee - a.oee).findIndex((x) => x.id === m.id) + 1;
  const sAvg = mean(d.machines.map((x) => x.scrapPct ?? 0)), st = { run: 'operando', idle: 'parada', down: 'COM FALHA' }[m.status];
  const lines = [`**${m.name}** (${m.type ? TYPE_PT[m.type] : 'máquina'}) está **${st}**.`, bullets([
    `OEE **${m.oee}%** — ${m.oee >= avg ? 'acima' : 'abaixo'} da média da fábrica (${nf(avg)}%), ${rank}º de ${d.machines.length}`,
    ...(m.scrapPct !== undefined ? [`Refugo **${nf(m.scrapPct, 1)}%** (média ${nf(sAvg, 1)}%)`] : []),
    ...(m.producedToday !== undefined ? [`Produzido hoje: **${nf(m.producedToday)} un**${m.order ? ` · ordem ${m.order}` : ''}`] : []),
  ])];
  if (m.status === 'down') lines.push('**Recomendação:** acionar manutenção corretiva e redistribuir a ordem para outra máquina do mesmo tipo.');
  else if (m.status === 'idle') lines.push('**Recomendação:** verificar se há ordem aguardando material/setup; avaliar balanceamento de carga.');
  else if ((m.scrapPct ?? 0) > sAvg * 1.3) lines.push('**Atenção:** refugo bem acima da média — revisar parâmetros e ferramental.');
  return { text: lines.join('\n'), actions: [mAct(m)] };
}
function describeSeller(d: Dataset, s: Seller): AiReply {
  const rank = [...d.sellers].sort((a, b) => b.revenue - a.revenue).findIndex((x) => x.id === s.id) + 1, avg = mean(d.sellers.map((x) => x.goalPct));
  const st = { online: 'disponível', busy: 'em atendimento', away: 'ausente' }[s.status];
  const lines = [`**${s.name}** está **${st}**.`, bullets([
    `Faturamento **${brl(s.revenue)}** — ${rank}º de ${d.sellers.length}`, `Meta **${s.goalPct}%** (média do time ${nf(avg)}%)`,
    `${nf(s.orders)} pedidos · **${nf(s.openOrders)} em aberto** · ticket médio ${brl(s.revenue / Math.max(s.orders, 1))}`, `Principal cliente: ${s.topClient}`])];
  if (s.goalPct < 70) lines.push('**Atenção:** abaixo de 70% da meta — avaliar pipeline e acompanhamento.');
  else if (s.goalPct >= 100) lines.push('**Meta batida** 🎉 — bom candidato a compartilhar práticas com o time.');
  return { text: lines.join('\n'), actions: [act('seller', s.id, `Ver ${first(s.name)}`)] };
}
function describeLot(d: Dataset, i: number): AiReply {
  const l = d.lots[i], occ = d.occupancy[i] ?? 0, cover = l.minQty ? (l.qty / l.minQty) * 100 : 0;
  const lines = [`**${l.id}** — ${l.material}${l.thickness ? `, ${nf(l.thickness, 2)} mm` : ''}.`, bullets([
    `Saldo **${nf(l.qty)}** chapas (mínimo ${nf(l.minQty)}) — cobertura ${nf(cover)}% do mínimo`, `Valor estimado **${brl(l.value)}** · ${nf(l.weightKg)} kg`, `Ocupação da posição: ${nf(occ * 100)}% · ${l.location}`])];
  if (l.qty < l.minQty) lines.push(`**Ação:** repor pelo menos **${nf(l.minQty - l.qty)}** chapas para voltar ao mínimo (sugiro +25% de folga → **${nf(Math.ceil((l.minQty - l.qty) * 1.25))}**).`);
  return { text: lines.join('\n'), actions: [act('lot', l.id, `Ver ${l.id}`)] };
}
function describe(d: Dataset, f: Found): AiReply { return f.kind === 'machine' ? describeMachine(d, d.machines[f.index]) : f.kind === 'seller' ? describeSeller(d, d.sellers[f.index]) : describeLot(d, f.index); }

function compare(d: Dataset, a: Found, b: Found): AiReply {
  if (a.kind === 'seller' && b.kind === 'seller') {
    const x = d.sellers[a.index], y = d.sellers[b.index], w = (p: number, q: number) => (p > q ? '✅' : p < q ? '' : '=');
    return { text: `**${first(x.name)} vs ${first(y.name)}**\n` + bullets([
      `Faturamento: ${brl(x.revenue)} ${w(x.revenue, y.revenue)} · ${brl(y.revenue)} ${w(y.revenue, x.revenue)}`, `Meta: ${x.goalPct}% ${w(x.goalPct, y.goalPct)} · ${y.goalPct}% ${w(y.goalPct, x.goalPct)}`,
      `Pedidos: ${x.orders} · ${y.orders}`, `Em aberto: ${x.openOrders} · ${y.openOrders}`, `Ticket médio: ${brl(x.revenue / Math.max(x.orders, 1))} · ${brl(y.revenue / Math.max(y.orders, 1))}`]),
      actions: [act('seller', x.id, `Ver ${first(x.name)}`), act('seller', y.id, `Ver ${first(y.name)}`)], chart: { title: 'Faturamento (mil R$)', items: [x, y].map((s) => ({ label: first(s.name), value: Math.round(s.revenue / 1000) })) } };
  }
  if (a.kind === 'machine' && b.kind === 'machine') {
    const x = d.machines[a.index], y = d.machines[b.index];
    return { text: `**${x.name} vs ${y.name}**\n` + bullets([`OEE: ${x.oee}% ${x.oee > y.oee ? '✅' : ''} · ${y.oee}% ${y.oee > x.oee ? '✅' : ''}`, `Refugo: ${nf(x.scrapPct ?? 0, 1)}% · ${nf(y.scrapPct ?? 0, 1)}%`, `Produzido hoje: ${nf(x.producedToday ?? 0)} · ${nf(y.producedToday ?? 0)}`]),
      actions: [mAct(x), mAct(y)], chart: { title: 'OEE (%)', unit: '%', items: [x, y].map((m) => ({ label: m.name.replace(/ \d+$/, ' ' + (machineNo(m) || '')), value: m.oee })) } };
  }
  return { text: 'Só consigo comparar dois itens do mesmo tipo (dois vendedores ou duas máquinas).' };
}

function forecast(d: Dataset, tab: TabKey): AiReply {
  if (tab === 'estoque') {
    const below = d.lots.filter((l) => l.qty < l.minQty);
    return { text: `A série do **Estoque** é por *origem de movimentação* (categorias), não temporal — não dá para projetar tendência com ela.\nO que posso afirmar com os dados: **${below.length}** lote(s) já estão abaixo do mínimo e **${d.occupancy.filter((o) => o > 0.8).length}** posições estão acima de 80% de ocupação. Quer a lista de reposição?` };
  }
  const s = d.tabs[tab].series, v = s.items.map((i) => i.value);
  if (v.length < 3) return { text: 'Poucos pontos para projetar (mínimo 3).' };
  const r = linreg(v), labels = nextLabels(s.items.map((i) => i.label), 2), f = [1, 2].map((k) => Math.max(0, r.intercept + r.slope * (v.length - 1 + k)));
  const avg = mean(v), pct = (r.slope / Math.max(avg, 1)) * 100, unit = tab === 'comercial' ? ' mil R$' : ' un';
  return {
    text: [`**${s.title}** — tendência **${r.slope >= 0 ? 'de alta' : 'de queda'}** (${r.slope >= 0 ? '+' : ''}${nf(r.slope, 1)}${unit}/período, ${nf(Math.abs(pct), 1)}% da média).`,
      bullets(f.map((x, k) => `**${labels[k]}**: ≈ ${nf(x)}${unit} (faixa ${nf(Math.max(0, x - r.sd))}–${nf(x + r.sd)})`)),
      `Confiança **${confWord(r.r2)}** (R² = ${nf(r.r2, 2)}, ${v.length} pontos). É uma regressão linear simples — serve como indicação, não como previsão firme.`].join('\n'),
    chart: { title: s.title + ' · projeção', items: [...s.items.map((i) => ({ label: i.label, value: i.value })), ...f.map((x, k) => ({ label: labels[k], value: Math.round(x), forecast: true }))] },
    actions: [{ type: 'tab', tab, label: `Abrir ${TAB_LABEL[tab]}` }],
  };
}

function insightsReply(list: Insight[], title: string, max = 5): AiReply {
  if (!list.length) return { text: 'Nada crítico encontrado com os dados atuais. ✅' };
  const shown = list.slice(0, max);
  return { text: `**${title}**\n` + shown.map((i) => `${SEV_ICON[i.severity]} **${i.title}** — ${i.detail}`).join('\n'), actions: shown.map((i) => i.action).filter((a): a is AiAction => !!a).slice(0, 4) };
}

function summary(d: Dataset, tab?: TabKey): AiReply {
  const parts: string[] = [], tabs: TabKey[] = tab ? [tab] : ['producao', 'estoque', 'comercial'];
  if (tabs.includes('producao') && d.machines.length) {
    const c = { run: 0, idle: 0, down: 0 }; d.machines.forEach((m) => c[m.status]++);
    parts.push(`**🏭 Produção** — OEE médio **${nf(mean(d.machines.map((m) => m.oee)))}%** · ${c.run} operando, ${c.idle} paradas, ${c.down} com falha. ${kpiText(d, 'producao', /refugo/)}${kpiText(d, 'producao', /plano/)}`);
  }
  if (tabs.includes('estoque')) {
    const below = d.lots.filter((l) => l.qty < l.minQty).length;
    parts.push(`**📦 Estoque** — ${kpiText(d, 'estoque', /estimado/)}${d.lots.length} lotes de chapas monitorados, **${below}** abaixo do mínimo.`);
  }
  if (tabs.includes('comercial') && d.sellers.length) {
    parts.push(`**💼 Comercial** — ${d.sellers.length} vendedores, meta média **${nf(mean(d.sellers.map((s) => s.goalPct)))}%**, ${brl(sum(d.sellers.map((s) => s.revenue)))} faturados. ${kpiText(d, 'comercial', /percentual/)}${kpiText(d, 'comercial', /aberto/)}`);
  }
  const ins = buildInsights(d).filter((i) => i.severity !== 'good' && (!tab || i.tab === tab)).slice(0, 4);
  if (ins.length) parts.push('**Pontos de atenção:**\n' + ins.map((i) => `${SEV_ICON[i.severity]} ${i.title}`).join('\n'));
  return { text: parts.join('\n\n'), actions: ins.map((i) => i.action).filter((a): a is AiAction => !!a).slice(0, 3) };
}
function kpiText(d: Dataset, tab: TabKey, re: RegExp) { const k = d.tabs[tab].kpis.find((x) => re.test(norm(x.label))); return k ? `${k.label}: ${k.value}. ` : ''; }

function rankChart(title: string, rows: { label: string; value: number }[], unit?: string): AiChart { return { title, unit, items: rows }; }

// ───────────────────────── roteador de intenções ─────────────────────────
const tabHint = (q: string): TabKey | undefined => /\b(estoque|lotes?|chapas?|patio|material|capital|reposi\w+|comprar|inox|aluminio|galvaniz\w+)\b/.test(q) ? 'estoque' : /\b(vendas?|vendedor\w*|comercial|pedidos?|faturamento|cliente\w*|meta|ticket)\b/.test(q) ? 'comercial' : /\b(producao|maquina\w*|oee|refugo|fabrica|ordem|ordens|falha\w*|operando)\b/.test(q) ? 'producao' : undefined;
const STOP = new Set(['de', 'da', 'do', 'em', 'dos', 'das', 'com', 'por', 'a', 'o']);

export function answerLocal(d: Dataset, question: string, ctx: AiContext): AiReply {
  const q = norm(question);
  if (!q) return { text: HELP };
  const ents = findEntities(q, d, ctx), hint = tabHint(q);
  const has = (re: RegExp) => re.test(q);

  if ((has(/^(oi|ola|bom dia|boa tarde|boa noite|e ai|hey|opa)\b/) && q.length < 20) || has(/\b(ajuda|help|o que (voce|vc) (faz|sabe|pode)|como (te |voce )?uso|quem e voce|o que e isso)\b/)) return { text: HELP };

  // comparação
  if (has(/\b(compar\w+|versus|vs|x)\b/) && ents.items.length >= 2) return compare(d, ents.items[0], ents.items.find((e) => e.kind === ents.items[0].kind && e.index !== ents.items[0].index) ?? ents.items[1]);
  if (has(/\bcompar\w+\b/) && has(/\b(dois|2)\b/) && has(/\b(melhores|top)\b/) && d.sellers.length >= 2) { const t = [...d.sellers.keys()].sort((a, b) => d.sellers[b].revenue - d.sellers[a].revenue); return compare(d, { kind: 'seller', index: t[0] }, { kind: 'seller', index: t[1] }); }

  // navegação para uma entidade
  if (ents.items.length && has(/\b(mostr\w+|ver|veja|abr\w+|vai|va|ir|foc\w+|leve|levar|localiz\w+|onde|achar|encontr\w+|cade)\b/)) { const r = describe(d, ents.items[0]); return { ...r, text: '🎯 Levei a câmera até lá.\n' + r.text }; }
  const tabWord = q.match(/\b(?:aba|painel|tela|guia|ir para|va para|abrir?)\s+(?:de |da |do )?(producao|estoque|comercial)\b/);
  if (tabWord) { const t = tabWord[1] as TabKey; return { text: `Abrindo **${TAB_LABEL[t]}**.`, actions: [{ type: 'tab', tab: t, label: `Abrir ${TAB_LABEL[t]}` }] }; }

  if (has(/\b(previs\w+|proje\w+|tendencia|prever|proximo mes|proximos dias|proxim[oa]s? (semana|mes|periodo)|vai (cair|subir|crescer|aumentar)|futuro)\b/)) return forecast(d, hint === 'estoque' ? 'estoque' : hint ?? (ctx.tab === 'estoque' ? 'comercial' : ctx.tab));
  if (has(/\b(devo|preciso|tenho que|temos que) fazer\b|\bpor onde (comeco|comecar)\b|\bplano de acao\b/)) {
    const list = buildInsights(d).filter((i) => i.severity === 'critical' || i.severity === 'warn');
    return insightsReply(list, 'Prioridades de hoje (da mais urgente para a menos)', 5);
  }
  if (has(/\b(problema\w*|alerta\w*|risco\w*|atencao|critic[oa]s?|preocup\w+|anomalia\w*|urgente|prioridade\w*|gargalo\w*|o que (esta|ta) (errado|ruim|pior|mal))\b/) && !has(/\b(maquinas? .*problema|problema.* maquina)\b/)) {
    const list = buildInsights(d).filter((i) => i.severity === 'critical' || i.severity === 'warn');
    return insightsReply(hint ? list.filter((i) => i.tab === hint) : list, hint ? `Pontos de atenção — ${TAB_LABEL[hint]}` : 'Pontos de atenção da operação');
  }
  if (!ents.items.length && has(/\b(resum\w+|panorama|visao geral|situacao|como (esta|estao|vai|anda|andam)|briefing|relatorio|diagnostico|balanco)\b/)) return summary(d, hint);

  // contagens
  const cnt = q.match(/\bquant[oa]s?\b.*\b(maquinas?|vendedor\w*|lotes?|chapas?)\b/);
  if (cnt && !has(/\b(abaixo|parad\w*|falha\w*|operand\w*|vazi\w*|zerad\w*|sem estoque|criticos?)\b/)) {
    const w = cnt[1]; if (/maq/.test(w)) return { text: `A fábrica tem **${d.machines.length} máquinas** cadastradas.` };
    if (/vend/.test(w)) return { text: `O time comercial tem **${d.sellers.length} vendedores**.` };
    return { text: `Há **${d.lots.length} lotes** de chapas, com **${nf(sum(d.lots.map((l) => l.qty)))}** chapas no total.` };
  }

  // KPI direto ("qual a taxa de refugo?")
  if (has(/^(qual|quais|quanto|quantos|quantas|me (diga|fale|passe)|valor)\b/)) {
    const cand: { k: { label: string; value: string; delta?: number }; tab: TabKey; len: number }[] = [];
    (Object.keys(d.tabs) as TabKey[]).forEach((t) => d.tabs[t].kpis.forEach((k) => {
      if (hint && hint !== t && /estoque|lote|vend|produc/.test(q)) return;
      const words = norm(k.label).split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));
      if (words.length && words.every((w) => q.includes(w.slice(0, Math.max(4, w.length - 1))))) cand.push({ k, tab: t, len: words.length });
    }));
    cand.sort((a, b) => b.len - a.len);
    if (cand[0]) { const { k, tab } = cand[0]; return { text: `**${k.label}**: **${k.value}**${k.delta !== undefined ? ` (${k.delta >= 0 ? '▲' : '▼'} ${nf(Math.abs(k.delta), 1)}% vs período anterior)` : ''} — aba ${TAB_LABEL[tab]}.`, actions: [{ type: 'tab', tab, label: `Abrir ${TAB_LABEL[tab]}` }] }; }
  }

  // entidade citada sem verbo específico → detalhe
  if (ents.items.length && !has(/\b(melhor\w*|pior\w*|ranking|top|todos|todas)\b/)) {
    if (ents.items.length === 1) return describe(d, ents.items[0]);
    const r = ents.items.slice(0, 3).map((e) => describe(d, e)); return { text: r.map((x) => x.text).join('\n\n'), actions: r.flatMap((x) => x.actions ?? []).slice(0, 4) };
  }

  // ── máquinas ──
  if (hint === 'producao' || (!hint && (ents.type || has(/\b(maquinas?|oee|equipamento\w*|operando|parad[ao]s?|falha\w*|refugo|sucata|quebrad\w+)\b/)))) {
    let ms = d.machines;
    if (ents.type) ms = ms.filter((m) => m.type === ents.type);
    const label = ents.type ? TYPE_PT[ents.type] : 'máquinas';
    if (ents.type && ms.length === 1) return describeMachine(d, ms[0]);   // tipo com uma única máquina → detalhe dela
    if (has(/\b(falha\w*|quebrad\w+|defeito|down|problema\w*|parou)\b/)) { const x = ms.filter((m) => m.status === 'down'); return x.length ? { text: `**${x.length} máquina(s) com falha:**\n` + bullets(x.map(machineLine)) + '\n**Recomendação:** acionar manutenção e realocar as ordens.', actions: x.slice(0, 3).map(mAct) } : { text: `Nenhuma ${label === 'máquinas' ? 'máquina' : label.toLowerCase()} com falha no momento. ✅` }; }
    if (has(/\b(parad[ao]s?|ociosa\w*|idle)\b/)) { const x = ms.filter((m) => m.status === 'idle'); return x.length ? { text: `**${x.length} parada(s):**\n` + bullets(x.map(machineLine)), actions: x.slice(0, 3).map(mAct) } : { text: 'Nenhuma máquina parada. ✅' }; }
    if (has(/\b(operando|funcionando|rodando|ativas?)\b/)) { const x = ms.filter((m) => m.status === 'run'); return { text: `**${x.length}** de ${ms.length} ${label} estão operando.`, actions: [] }; }
    if (has(/\b(refugo|sucata|perda\w*|desperdicio)\b/)) {
      const x = [...ms].sort((a, b) => (b.scrapPct ?? 0) - (a.scrapPct ?? 0)).slice(0, 5), avg = mean(ms.map((m) => m.scrapPct ?? 0));
      return { text: `**Maiores taxas de refugo** (média ${nf(avg, 1)}%):\n` + bullets(x.map((m) => `**${m.name}** — ${nf(m.scrapPct ?? 0, 1)}%`)) + (((x[0].scrapPct ?? 0) > avg * 1.4) ? `\n**Atenção:** ${x[0].name} está ${nf((((x[0].scrapPct ?? 0) / Math.max(avg, 0.1)) - 1) * 100)}% acima da média.` : ''), actions: x.slice(0, 3).map(mAct), chart: rankChart('Refugo (%)', x.map((m) => ({ label: m.name.replace(/(Corte a |Centro de |Cabine de |Solda |Dobradeira |Puncionadeira |Serra de )/, '').slice(0, 14), value: m.scrapPct ?? 0 })), '%') };
    }
    const worstQ = has(/\b(pior\w*|menor\w*|baixo|ruim|fraca?)\b/), bestQ = has(/\b(melhor\w*|maior\w*|top|destaque|eficien\w+)\b/);
    if (worstQ || bestQ || has(/\b(ranking|oee)\b/)) {
      const x = [...ms].sort((a, b) => (worstQ ? a.oee - b.oee : b.oee - a.oee)).slice(0, 5);
      return { text: `**${worstQ ? 'Menores' : 'Maiores'} OEE** (média da fábrica ${nf(mean(d.machines.map((m) => m.oee)))}%):\n` + bullets(x.map(machineLine)), actions: x.slice(0, 3).map(mAct), chart: rankChart('OEE (%)', x.map((m) => ({ label: m.name.replace(/(Corte a |Centro de |Cabine de |Solda |Dobradeira |Puncionadeira |Serra de )/, '').slice(0, 14), value: m.oee })), '%') };
    }
    const c = { run: 0, idle: 0, down: 0 }; ms.forEach((m) => c[m.status]++);
    const w = [...ms].sort((a, b) => a.oee - b.oee)[0], b = [...ms].sort((a, b2) => b2.oee - a.oee)[0];
    return { text: `**${label[0].toUpperCase() + label.slice(1)}**: OEE médio **${nf(mean(ms.map((m) => m.oee)))}%** · ${c.run} operando, ${c.idle} paradas, ${c.down} com falha.\n- Melhor: ${machineLine(b)}\n- Pior: ${machineLine(w)}`, actions: [mAct(b), mAct(w)] };
  }

  // ── estoque ──
  if (hint === 'estoque' || has(/\b(estoque|lotes?|chapas?|patio|reposi\w+|comprar|compra|inox|aluminio|galvaniz\w+|carbono|capital|imobilizado)\b/)) {
    const mat = ['inox', 'aluminio', 'galvaniz', 'carbono'].find((m) => q.includes(m));
    let ls = d.lots.map((l, i) => ({ l, i })); if (mat) ls = ls.filter((x) => norm(x.l.material).includes(mat));
    const lAct = (x: { l: Lot }) => act('lot', x.l.id, `Ver ${x.l.id}`);
    if (has(/\b(abaixo|minimo|falta\w*|reposi\w+|comprar|compra|ruptura|critic\w+|acabando|baixo)\b/)) {
      const x = ls.filter((y) => y.l.qty < y.l.minQty).sort((a, b) => (b.l.minQty - b.l.qty) - (a.l.minQty - a.l.qty));
      if (!x.length) return { text: `Nenhum lote${mat ? ' de ' + mat : ''} abaixo do mínimo. ✅` };
      const need = x.map((y) => Math.ceil((y.l.minQty - y.l.qty) * 1.25)), cost = sum(x.map((y, k) => (y.l.qty > 0 ? (y.l.value / y.l.qty) * need[k] : 0)));
      return { text: `**${x.length} lote(s) abaixo do mínimo** — sugestão de reposição (déficit + 25% de folga):\n` + bullets(x.slice(0, 6).map((y, k) => `**${y.l.id}** · ${y.l.material}: saldo ${y.l.qty}/${y.l.minQty} → comprar **${need[k]}**`)) + (x.length > 6 ? `\n… e mais ${x.length - 6}.` : '') + (cost ? `\nInvestimento estimado: **${brl(cost)}** (ao preço médio do saldo atual).` : ''), actions: x.slice(0, 3).map(lAct), chart: rankChart('Déficit (chapas)', x.slice(0, 6).map((y) => ({ label: y.l.id, value: y.l.minQty - y.l.qty }))) };
    }
    if (has(/\b(valor|capital|parado|imobilizado|caro|investid\w+)\b/)) {
      const x = [...ls].sort((a, b) => b.l.value - a.l.value).slice(0, 5), tot = sum(ls.map((y) => y.l.value));
      return { text: `**Valor em chapas${mat ? ' (' + mat + ')' : ''}: ${brl(tot)}**. Maiores lotes:\n` + bullets(x.map((y) => `**${y.l.id}** · ${y.l.material} — ${brl(y.l.value)} (${nf((y.l.value / Math.max(tot, 1)) * 100)}%)`)), actions: x.slice(0, 3).map(lAct), chart: rankChart('Valor (mil R$)', x.map((y) => ({ label: y.l.id, value: Math.round(y.l.value / 1000) }))) };
    }
    if (has(/\b(cheio|cheios|lotad\w+|excesso|sobra|ocupa\w+|capacidade)\b/)) {
      const x = [...ls].sort((a, b) => (d.occupancy[b.i] ?? 0) - (d.occupancy[a.i] ?? 0)).slice(0, 5);
      return { text: '**Posições mais ocupadas:**\n' + bullets(x.map((y) => `**${y.l.id}** · ${y.l.material} — ${nf((d.occupancy[y.i] ?? 0) * 100)}%`)), actions: x.slice(0, 3).map(lAct) };
    }
    if (has(/\b(vazi\w+|sem estoque|zerad\w+)\b/)) {
      const x = ls.filter((y) => y.l.qty === 0 || (d.occupancy[y.i] ?? 0) < 0.15);
      return x.length ? { text: `**${x.length} posição(ões) vazia(s) ou quase:**\n` + bullets(x.slice(0, 6).map((y) => `**${y.l.id}** · ${y.l.material} — ${y.l.qty} chapas`)), actions: x.slice(0, 3).map(lAct) } : { text: 'Nenhuma posição vazia. ✅' };
    }
    const byMat = new Map<string, number>(); ls.forEach((y) => byMat.set(y.l.material, (byMat.get(y.l.material) ?? 0) + y.l.value));
    const rows = [...byMat].sort((a, b) => b[1] - a[1]).slice(0, 6), below = ls.filter((y) => y.l.qty < y.l.minQty).length;
    return { text: `**Chapas${mat ? ' — ' + (mat === 'aluminio' ? 'alumínio' : mat === 'galvaniz' ? 'galvanizado' : mat) : ''}**: ${ls.length} lotes · ${nf(sum(ls.map((y) => y.l.qty)))} chapas · **${brl(sum(ls.map((y) => y.l.value)))}** em valor · ${below} abaixo do mínimo.\n` + bullets(rows.map(([m, v]) => `${m}: ${brl(v)}`)), chart: rankChart('Valor por material (mil R$)', rows.map(([m, v]) => ({ label: m.replace(/^Aço /, '').slice(0, 14), value: Math.round(v / 1000) }))), actions: [{ type: 'tab', tab: 'estoque', label: 'Abrir Estoque' }] };
  }

  // ── comercial ──
  if (hint === 'comercial' || has(/\b(vendas?|vendedor\w*|meta\w*|faturamento|ticket|pedidos?|clientes?|receita)\b/)) {
    const ss = d.sellers, sAct = (s: Seller) => act('seller', s.id, `Ver ${first(s.name)}`);
    if (has(/\b(abaixo|atras\w+|pior|piores|menor|baixa?)\b/) || (has(/\bmeta\b/) && !has(/\b(melhor|batid\w+|acima)\b/))) {
      const x = ss.filter((s) => s.goalPct < 100).sort((a, b) => a.goalPct - b.goalPct), avg = mean(ss.map((s) => s.goalPct));
      return { text: `**${x.length} de ${ss.length} vendedores abaixo da meta** (média do time ${nf(avg)}%):\n` + bullets(x.slice(0, 6).map((s) => `**${s.name}** — ${s.goalPct}% · ${brl(s.revenue)}`)), actions: x.slice(0, 3).map(sAct), chart: rankChart('Meta atingida (%)', x.slice(0, 6).map((s) => ({ label: first(s.name), value: s.goalPct })), '%') };
    }
    if (has(/\b(cliente\w*)\b/)) { const x = [...ss].sort((a, b) => b.revenue - a.revenue).slice(0, 5); return { text: '**Principais clientes dos maiores vendedores:**\n' + bullets(x.map((s) => `**${s.topClient}** — carteira de ${first(s.name)} (${brl(s.revenue)})`)), actions: x.slice(0, 3).map(sAct) }; }
    if (has(/\b(abert\w+|pendente\w*)\b/)) { const x = [...ss].sort((a, b) => b.openOrders - a.openOrders).slice(0, 5); return { text: `**Pedidos em aberto por vendedor** (total ${nf(sum(ss.map((s) => s.openOrders)))}):\n` + bullets(x.map((s) => `**${s.name}** — ${s.openOrders} em aberto de ${s.orders}`)), actions: x.slice(0, 3).map(sAct), chart: rankChart('Em aberto', x.map((s) => ({ label: first(s.name), value: s.openOrders }))) }; }
    if (has(/\bticket\b/)) { const x = [...ss].sort((a, b) => b.revenue / Math.max(b.orders, 1) - a.revenue / Math.max(a.orders, 1)).slice(0, 5); return { text: '**Maior ticket médio:**\n' + bullets(x.map((s) => `**${s.name}** — ${brl(s.revenue / Math.max(s.orders, 1))}`)), actions: x.slice(0, 3).map(sAct) }; }
    const x = [...ss].sort((a, b) => b.revenue - a.revenue).slice(0, 5), tot = sum(ss.map((s) => s.revenue));
    return { text: `**Ranking de faturamento** (total ${brl(tot)}, meta média ${nf(mean(ss.map((s) => s.goalPct)))}%):\n` + bullets(x.map((s, k) => `${k + 1}º **${s.name}** — ${brl(s.revenue)} · meta ${s.goalPct}%`)), actions: x.slice(0, 3).map(sAct), chart: rankChart('Faturamento (mil R$)', x.map((s) => ({ label: first(s.name), value: Math.round(s.revenue / 1000) }))) };
  }

  const top = buildInsights(d).find((i) => i.severity === 'critical' || i.severity === 'warn');
  return { text: 'Não tenho certeza do que você quer saber 🤔. Tente algo como *"resumo executivo"*, *"qual máquina tem mais refugo?"*, *"lotes abaixo do mínimo"* ou *"quem está abaixo da meta?"*.' + (top ? `\n\nEnquanto isso, um ponto de atenção: ${SEV_ICON[top.severity]} **${top.title}**.` : ''), actions: top?.action ? [top.action] : [] };
}
