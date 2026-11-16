// Dados de exemplo. Para usar os seus, coloque public/data.json no mesmo formato de `Dataset`
// (ou troque loadData por uma chamada à sua API, ex.: MySQL via backend).
export type TabKey = 'producao' | 'estoque' | 'comercial';
export type MachineType = 'laser' | 'pressBrake' | 'cnc' | 'robotWelder' | 'paintBooth' | 'punchPress' | 'bandSaw';
export interface Kpi { label: string; value: string; delta?: number }
export interface Series { title: string; items: { label: string; value: number }[] }
export interface Machine { id: string; name: string; oee: number; status: 'run' | 'idle' | 'down'; type?: MachineType; order?: string; producedToday?: number; scrapPct?: number }
export interface Lot { id: string; material: string; thickness: number; size: string; qty: number; weightKg: number; value: number; minQty: number; location: string }
export interface Seller { id: string; name: string; status: 'online' | 'busy' | 'away'; orders: number; revenue: number; openOrders: number; goalPct: number; topClient: string }
export interface Selection { kind: 'machine' | 'lot' | 'seller'; index: number }
export interface Dataset {
  tabs: Record<TabKey, { title: string; kpis: Kpi[]; series: Series }>;
  machines: Machine[];
  occupancy: number[]; // 0..1 por lote (48 posições)
  lots: Lot[];
  sellers: Seller[];
}

const MATERIALS = [{ n: 'Aço carbono SAE 1020', d: 7.85, p: 7.2 }, { n: 'Aço galvanizado', d: 7.85, p: 9.4 }, { n: 'Aço inox 304', d: 7.93, p: 24 }, { n: 'Alumínio 5052', d: 2.68, p: 21 }];
const THICK = [1.5, 2, 3, 4.75, 6.35];
const rnd = (i: number) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
const occupancy = Array.from({ length: 42 }, (_, i) => rnd(i));
const lots: Lot[] = occupancy.map((o, i) => {
  const m = MATERIALS[Math.floor(rnd(i + 50) * MATERIALS.length)], th = THICK[Math.floor(rnd(i + 90) * THICK.length)];
  const qty = Math.round(o * 180), kg = qty * 2.5 * th * m.d;
  return { id: `L-${String(i + 1).padStart(3, '0')}`, material: m.n, thickness: th, size: '2000 × 1250 mm', qty, weightKg: Math.round(kg), value: Math.round(kg * m.p),
    minQty: 40, location: `Pátio ${String.fromCharCode(65 + Math.floor(i / 6))} · posição ${(i % 6) + 1}` };
});
const NAMES = ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves', 'Elisa Rocha', 'Fábio Costa', 'Gabriela Nunes', 'Henrique Dias', 'Isabela Martins', 'João Pedro Silva'];
const CLIENTS = ['Metalúrgica Alfa', 'Construtora Beta', 'Indústria Gama', 'Agro Delta', 'Montadora Épsilon', 'Estruturas Zeta', 'Logística Eta', 'Engenharia Teta', 'Caldeiraria Norte', 'ImpRodo'];
const sellers: Seller[] = NAMES.map((name, i) => {
  const orders = 8 + Math.round(rnd(i + 7) * 22), revenue = Math.round((90 + rnd(i + 3) * 260) * 1000);
  return { id: `v${i + 1}`, name, status: (['online', 'busy', 'online', 'away'] as const)[i % 4], orders, revenue, openOrders: Math.round(orders * (0.2 + rnd(i) * 0.3)),
    goalPct: Math.round(55 + rnd(i + 11) * 60), topClient: CLIENTS[i] };
});

const sample: Dataset = {
  tabs: {
    producao: { title: 'Produção', kpis: [
      { label: 'Ordens de produção', value: '148', delta: 3.0 },
      { label: 'Quantidade produzida', value: '12.480', delta: 4.2 },
      { label: 'Cumprimento do plano', value: '91%', delta: 2.4 },
      { label: 'Índice de aprovação', value: '96,8%', delta: 1.1 },
      { label: 'Taxa de refugo', value: '3,2%', delta: -0.6 },
      { label: 'Tempo de produção (h)', value: '1.264', delta: 1.8 }],
      series: { title: 'Evolução diária da produção', items: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label, i) => ({ label, value: [820, 940, 880, 1010, 960, 540][i] })) } },
    estoque: { title: 'Estoque', kpis: [
      { label: 'Valor em estoque estimado', value: 'R$ 1,84 mi', delta: 3.1 },
      { label: 'Produtos controlados', value: '342' },
      { label: 'Produtos abaixo do mínimo', value: '18', delta: -12 },
      { label: 'Produtos sem estoque', value: '5', delta: -2 }],
      series: { title: 'Movimentações por origem', items: ['Compra', 'Produção', 'Venda', 'Ajuste', 'Devol.'].map((label, i) => ({ label, value: [64, 88, 72, 21, 12][i] })) } },
    comercial: { title: 'Comercial', kpis: [
      { label: 'Valor total', value: 'R$ 2,41 mi', delta: 5.8 },
      { label: 'Faturamento realizado', value: 'R$ 1,96 mi', delta: 4.1 },
      { label: 'Ticket médio', value: 'R$ 18,2 mil', delta: 0.9 },
      { label: 'Percentual realizado', value: '81%', delta: 2.2 },
      { label: 'Clientes com pedidos', value: '63', delta: 4 },
      { label: 'Pedidos em aberto', value: '47', delta: -3 },
      { label: 'Quantidade de pedidos', value: '132', delta: 6 },
      { label: 'Valor em aberto', value: 'R$ 450 mil', delta: -1.4 }],
      series: { title: 'Valor de pedidos por mês (mil R$)', items: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov'].map((label, i) => ({ label, value: [310, 360, 330, 420, 480, 440][i] })) } },
  },
  machines: [
    { id: 'm1',  name: 'Corte a Laser 01',      oee: 87, status: 'run',  type: 'laser',       order: 'OP-3001', producedToday: 420, scrapPct: 2.1 },
    { id: 'm2',  name: 'Corte a Laser 02',      oee: 74, status: 'run',  type: 'laser',       order: 'OP-3003', producedToday: 360, scrapPct: 3.4 },
    { id: 'm3',  name: 'Corte a Laser 03',      oee: 81, status: 'run',  type: 'laser',       order: 'OP-3007', producedToday: 395, scrapPct: 2.8 },
    { id: 'm4',  name: 'Dobradeira CNC 01',     oee: 62, status: 'idle', type: 'pressBrake',  order: 'OP-3004', producedToday: 190, scrapPct: 1.8 },
    { id: 'm5',  name: 'Dobradeira CNC 02',     oee: 70, status: 'run',  type: 'pressBrake',  order: 'OP-3012', producedToday: 220, scrapPct: 2.2 },
    { id: 'm6',  name: 'Centro de Usinagem 01', oee: 91, status: 'run',  type: 'cnc',         order: 'OP-3005', producedToday: 275, scrapPct: 1.2 },
    { id: 'm7',  name: 'Centro de Usinagem 02', oee: 85, status: 'run',  type: 'cnc',         order: 'OP-3008', producedToday: 260, scrapPct: 1.5 },
    { id: 'm8',  name: 'Centro de Usinagem 03', oee: 78, status: 'idle', type: 'cnc',         order: 'OP-3015', producedToday: 180, scrapPct: 2.0 },
    { id: 'm9',  name: 'Solda Robotizada 01',   oee: 88, status: 'run',  type: 'robotWelder', order: 'OP-3006', producedToday: 310, scrapPct: 1.4 },
    { id: 'm10', name: 'Solda Robotizada 02',   oee: 0,  status: 'down', type: 'robotWelder', order: 'OP-3010', producedToday: 0,   scrapPct: 0 },
    { id: 'm11', name: 'Solda Robotizada 03',   oee: 72, status: 'run',  type: 'robotWelder', order: 'OP-3018', producedToday: 240, scrapPct: 3.1 },
    { id: 'm12', name: 'Cabine de Pintura 01',  oee: 79, status: 'run',  type: 'paintBooth',  order: 'OP-3009', producedToday: 310, scrapPct: 2.6 },
    { id: 'm13', name: 'Cabine de Pintura 02',  oee: 83, status: 'run',  type: 'paintBooth',  order: 'OP-3014', producedToday: 290, scrapPct: 1.9 },
    { id: 'm14', name: 'Puncionadeira CNC 01',  oee: 76, status: 'run',  type: 'punchPress',  order: 'OP-3016', producedToday: 350, scrapPct: 2.4 },
    { id: 'm15', name: 'Serra de Fita 01',      oee: 65, status: 'idle', type: 'bandSaw',     order: 'OP-3020', producedToday: 140, scrapPct: 3.8 },
  ],
  occupancy, lots, sellers,
};

// Ordem de busca dos dados:
//  1. VITE_API_URL (ex.: http://localhost:3001) -> chama a API Node que lê o MySQL
//  2. ./data.json (snapshot gerado por "npm run snapshot") -> painel estático
//  3. dados de exemplo embutidos (sample) -> sempre funciona
export type DataSource = 'api' | 'snapshot' | 'sample';
export async function loadData(): Promise<{ data: Dataset; source: DataSource }> {
  const api = import.meta.env.VITE_API_URL;
  if (api) {
    try {
      const r = await fetch(`${api.replace(/\/$/, '')}/api/data`);
      if (r.ok) return { data: { ...sample, ...((await r.json()) as Partial<Dataset>) }, source: 'api' };
    } catch { /* cai para o snapshot/exemplo */ }
  }
  try { const r = await fetch('./data.json'); if (r.ok) return { data: { ...sample, ...((await r.json()) as Partial<Dataset>) }, source: 'snapshot' }; } catch { /* usa exemplo */ }
  return { data: sample, source: 'sample' };
}
