// queries.js — todas as consultas SQL e a montagem do objeto Dataset
// que o painel 3D consome. Cada função recebe o pool mysql2 e devolve
// a parte correspondente do JSON. Mantém a mesma forma de src/data.ts.

const n = (v) => Number(v ?? 0);

// Converte um valor 0..1 (ocupação) a partir de saldo vs. estoque máximo.
const occ = (saldo, max) => {
  if (!max || max <= 0) return saldo > 0 ? 0.5 : 0;
  return Math.max(0, Math.min(1, saldo / max));
};

// ----------------------- PRODUÇÃO -----------------------
export async function getProducao(pool) {
  const [[ap]] = await pool.query(`
    SELECT
      COALESCE(SUM(quantidade_produzida),0) AS produzido,
      COALESCE(SUM(quantidade_aprovada),0)  AS aprovado,
      COALESCE(SUM(quantidade_refugo),0)    AS refugo,
      COALESCE(SUM(tempo_minutos),0)        AS minutos
    FROM apontamentos_producao`);
  const [[op]] = await pool.query(`
    SELECT
      COUNT(*) AS ordens,
      COALESCE(SUM(quantidade_planejada),0) AS planejado
    FROM ordens_producao`);

  const produzido = n(ap.produzido), aprovado = n(ap.aprovado), refugo = n(ap.refugo);
  const aprovPct = produzido ? (aprovado / produzido) * 100 : 0;
  const refugoPct = produzido ? (refugo / produzido) * 100 : 0;
  const planoPct = n(op.planejado) ? (produzido / n(op.planejado)) * 100 : 0;

  // série: produção por dia (últimos 6 dias com apontamento)
  const [serie] = await pool.query(`
    SELECT DATE(data_apontamento) AS dia, SUM(quantidade_produzida) AS qtd
    FROM apontamentos_producao
    GROUP BY DATE(data_apontamento)
    ORDER BY dia DESC
    LIMIT 6`);
  const items = serie.reverse().map((r) => ({
    label: new Date(r.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    value: n(r.qtd),
  }));

  return {
    title: 'Produção',
    kpis: [
      { label: 'Ordens de produção', value: n(op.ordens).toLocaleString('pt-BR') },
      { label: 'Quantidade produzida', value: Math.round(produzido).toLocaleString('pt-BR') },
      { label: 'Cumprimento do plano', value: `${planoPct.toFixed(0)}%` },
      { label: 'Índice de aprovação', value: `${aprovPct.toFixed(1)}%` },
      { label: 'Taxa de refugo', value: `${refugoPct.toFixed(1)}%` },
      { label: 'Tempo de produção (h)', value: Math.round(n(ap.minutos) / 60).toLocaleString('pt-BR') },
    ],
    series: { title: 'Evolução diária da produção', items: items.length ? items : [{ label: '—', value: 0 }] },
  };
}

// ----------------------- MÁQUINAS -----------------------
// OEE e status ESTIMADOS a partir dos apontamentos (não há sensor no banco).
export async function getMachines(pool) {
  const [rows] = await pool.query(`
    SELECT
      maquina,
      SUM(quantidade_produzida) AS produzido,
      SUM(quantidade_aprovada)  AS aprovado,
      SUM(quantidade_refugo)    AS refugo,
      MAX(data_apontamento)     AS ultimo
    FROM apontamentos_producao
    WHERE maquina IS NOT NULL AND maquina <> ''
    GROUP BY maquina
    ORDER BY produzido DESC
    LIMIT 15`);
  // referência de "agora" = apontamento mais recente da base (e não o relógio): um banco com dados históricos
  // não deve mostrar a fábrica inteira como parada. Janela configurável por MACHINE_ACTIVE_HOURS (padrão 24 h).
  const [[refRow]] = await pool.query('SELECT MAX(data_apontamento) AS ref FROM apontamentos_producao');
  const ref = refRow?.ref ? new Date(refRow.ref).getTime() : Date.now();
  const janela = Number(process.env.MACHINE_ACTIVE_HOURS) || 24;

  const typeOf = (nome) => {
    const s = (nome || '').toLowerCase();
    if (s.includes('laser') || s.includes('corte')) return 'laser';
    if (s.includes('dobr')) return 'pressBrake';
    if (s.includes('usin') || s.includes('cnc') || s.includes('torno')) return 'cnc';
    if (s.includes('sold')) return 'robotWelder';
    if (s.includes('pint') || s.includes('cabin')) return 'paintBooth';
    if (s.includes('punc') || s.includes('punch')) return 'punchPress';
    if (s.includes('serra') || s.includes('fita')) return 'bandSaw';
    return 'laser';
  };

  return rows.map((r, i) => {
    const prod = n(r.produzido), aprov = n(r.aprovado), refugo = n(r.refugo);
    // "OEE" estimado = qualidade (aprovado/produzido). Documentar como estimativa.
    const oee = prod ? Math.round((aprov / prod) * 100) : 0;
    // status estimado: apontou dentro da janela (a partir do último apontamento da base) = operando; sem produção = parada; refugo alto = falha
    const horas = r.ultimo ? (ref - new Date(r.ultimo).getTime()) / 3.6e6 : Infinity;
    let status = 'idle';
    if (prod > 0 && horas <= janela) status = refugo / (prod || 1) > 0.15 ? 'down' : 'run';
    return {
      id: `m${i + 1}`,
      name: r.maquina,
      oee,
      status,
      type: typeOf(r.maquina),
      producedToday: Math.round(prod),
      scrapPct: prod ? Number(((refugo / prod) * 100).toFixed(1)) : 0,
    };
  });
}

// ----------------------- ESTOQUE / CHAPAS -----------------------
export async function getEstoque(pool) {
  const [[tot]] = await pool.query(`
    SELECT
      COUNT(*) AS controlados,
      SUM(CASE WHEN saldo_atual <= 0 THEN 1 ELSE 0 END) AS sem_estoque,
      SUM(CASE WHEN saldo_atual > 0 AND saldo_atual < estoque_minimo THEN 1 ELSE 0 END) AS abaixo_min
    FROM vw_saldo_estoque`);
  // valor estimado = saldo * preço de venda do produto
  const [[val]] = await pool.query(`
    SELECT COALESCE(SUM(s.saldo_atual * p.preco_venda),0) AS valor
    FROM vw_saldo_estoque s JOIN produtos p ON p.id_produto = s.id_produto`);

  const kpis = [
    { label: 'Valor em estoque estimado', value: brl(n(val.valor)) },
    { label: 'Produtos controlados', value: n(tot.controlados).toLocaleString('pt-BR') },
    { label: 'Produtos abaixo do mínimo', value: n(tot.abaixo_min).toLocaleString('pt-BR') },
    { label: 'Produtos sem estoque', value: n(tot.sem_estoque).toLocaleString('pt-BR') },
  ];

  // série: movimentações por origem (últimos 90 dias)
  const [serie] = await pool.query(`
    SELECT origem_movimentacao AS origem, COUNT(*) AS qtd
    FROM movimentacoes_estoque
    WHERE data_movimentacao >= NOW() - INTERVAL 90 DAY
    GROUP BY origem_movimentacao ORDER BY qtd DESC LIMIT 6`);
  const items = serie.map((r) => ({ label: cap(r.origem || '—'), value: n(r.qtd) }));

  return { tab: { title: 'Estoque', kpis, series: { title: 'Movimentações por origem', items: items.length ? items : [{ label: '—', value: 0 }] } } };
}

// Lotes = produtos da categoria "Chapas" com saldo. Cada um vira uma posição 3D.
export async function getLots(pool) {
  const [rows] = await pool.query(`
    SELECT p.id_produto, p.codigo_produto, p.descricao, p.categoria, p.unidade_medida,
           p.estoque_minimo, p.estoque_maximo, p.preco_venda,
           COALESCE(s.saldo_atual, 0) AS saldo
    FROM produtos p
    LEFT JOIN vw_saldo_estoque s ON s.id_produto = p.id_produto
    WHERE p.categoria = 'Chapas' AND p.ativo = 1
    ORDER BY p.codigo_produto`);

  // fallback: se não houver chapas cadastradas, usa todas as matérias-primas (tipo MP)
  let data = rows;
  if (!data.length) {
    const [mp] = await pool.query(`
      SELECT p.id_produto, p.codigo_produto, p.descricao, p.categoria, p.unidade_medida,
             p.estoque_minimo, p.estoque_maximo, p.preco_venda,
             COALESCE(s.saldo_atual,0) AS saldo
      FROM produtos p LEFT JOIN vw_saldo_estoque s ON s.id_produto = p.id_produto
      WHERE p.tipo_produto = 'MP' AND p.ativo = 1 ORDER BY p.codigo_produto`);
    data = mp;
  }

  const lots = data.map((r) => {
    const material = (r.descricao || '').replace(/\s+\d[\d.,]*\s*mm.*/i, '').trim() || r.categoria;
    const th = parseFloat((String(r.descricao).match(/(\d+[.,]\d+)\s*mm/i) || [])[1]?.replace(',', '.')) || 0;
    const size = (String(r.descricao).match(/(\d{3,4}\s*[x×]\s*\d{3,4})/i) || [])[1] || '2000 × 1250 mm';
    return {
      id: r.codigo_produto,
      material,
      thickness: th,
      size: size.replace(/\s*[x×]\s*/, ' × ') + (/mm/.test(size) ? '' : ' mm'),
      qty: Math.round(n(r.saldo)),
      value: Math.round(n(r.saldo) * n(r.preco_venda)),
      weightKg: Math.round(n(r.saldo) * 2.5 * (th || 1) * 7.85),
      minQty: Math.round(n(r.estoque_minimo)),
      location: `${r.categoria} · ${r.codigo_produto}`,
    };
  });
  const maxByCat = Math.max(1, ...data.map((r) => n(r.estoque_maximo)));
  const occupancy = data.map((r) => occ(n(r.saldo), n(r.estoque_maximo) || maxByCat));
  return { lots, occupancy };
}

// ----------------------- COMERCIAL -----------------------
export async function getComercial(pool) {
  const [[c]] = await pool.query(`
    SELECT
      COUNT(*) AS pedidos,
      COALESCE(SUM(valor_total_pedido),0) AS valor_total,
      COALESCE(SUM(CASE WHEN status_pedido IN ('FATURADO','ENTREGUE') THEN valor_total_pedido ELSE 0 END),0) AS faturado,
      COALESCE(SUM(CASE WHEN status_pedido IN ('PENDENTE','APROVADO','EM_PRODUCAO') THEN valor_total_pedido ELSE 0 END),0) AS em_aberto,
      SUM(CASE WHEN status_pedido IN ('PENDENTE','APROVADO','EM_PRODUCAO') THEN 1 ELSE 0 END) AS qtd_aberto,
      COUNT(DISTINCT cliente) AS clientes
    FROM vw_faturamento_pedidos`);

  const valorTotal = n(c.valor_total), faturado = n(c.faturado), pedidos = n(c.pedidos);
  const ticket = pedidos ? valorTotal / pedidos : 0;
  const realizPct = valorTotal ? (faturado / valorTotal) * 100 : 0;

  const kpis = [
    { label: 'Valor total', value: brl(valorTotal) },
    { label: 'Faturamento realizado', value: brl(faturado) },
    { label: 'Ticket médio', value: brl(ticket) },
    { label: 'Percentual realizado', value: `${realizPct.toFixed(0)}%` },
    { label: 'Clientes com pedidos', value: n(c.clientes).toLocaleString('pt-BR') },
    { label: 'Pedidos em aberto', value: n(c.qtd_aberto).toLocaleString('pt-BR') },
    { label: 'Quantidade de pedidos', value: pedidos.toLocaleString('pt-BR') },
    { label: 'Valor em aberto', value: brl(n(c.em_aberto)) },
  ];

  // série: valor de pedidos por mês (últimos 6 meses)
  const [serie] = await pool.query(`
    SELECT DATE_FORMAT(data_pedido, '%Y-%m') AS mes, SUM(valor_total_pedido) AS valor
    FROM vw_faturamento_pedidos
    WHERE data_pedido >= (NOW() - INTERVAL 6 MONTH)
    GROUP BY mes ORDER BY mes`);
  const items = serie.map((r) => ({
    label: new Date(r.mes + '-01').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    value: Math.round(n(r.valor) / 1000),
  }));

  return { tab: { title: 'Comercial', kpis, series: { title: 'Valor de pedidos por mês (mil R$)', items: items.length ? items : [{ label: '—', value: 0 }] } } };
}

// Vendedores: agrega pedidos por vendedor.
export async function getSellers(pool) {
  // a view não traz id_vendedor; junta pedidos_venda -> itens pra achar o valor
  const [rows] = await pool.query(`
    SELECT
      v.id_vendedor, v.nome, v.status, v.meta_mensal,
      COUNT(DISTINCT pv.id_pedido_venda) AS pedidos,
      COALESCE(SUM(ipv.quantidade * ipv.preco_unitario * (1 - IFNULL(ipv.desconto_percentual,0)/100)),0) AS receita,
      SUM(CASE WHEN pv.status_pedido IN ('PENDENTE','APROVADO','EM_PRODUCAO') THEN 1 ELSE 0 END) AS em_aberto
    FROM vendedores v
    LEFT JOIN pedidos_venda pv ON pv.id_vendedor = v.id_vendedor
    LEFT JOIN itens_pedido_venda ipv ON ipv.id_pedido_venda = pv.id_pedido_venda
    WHERE v.ativo = 1
    GROUP BY v.id_vendedor, v.nome, v.status, v.meta_mensal
    ORDER BY receita DESC`);

  // principal cliente por vendedor (uma query leve por vendedor)
  const sellers = [];
  for (const r of rows) {
    const [[top]] = await pool.query(`
      SELECT c.nome_fantasia, c.nome_razao_social, COUNT(*) AS n
      FROM pedidos_venda pv JOIN clientes c ON c.id_cliente = pv.id_cliente
      WHERE pv.id_vendedor = ? GROUP BY pv.id_cliente ORDER BY n DESC LIMIT 1`, [r.id_vendedor]);
    const receita = n(r.receita), pedidos = n(r.pedidos);
    sellers.push({
      id: `v${r.id_vendedor}`,
      name: r.nome,
      status: ['online', 'busy', 'away'].includes(r.status) ? r.status : 'online',
      orders: pedidos,
      revenue: Math.round(receita),
      openOrders: n(r.em_aberto),
      goalPct: n(r.meta_mensal) ? Math.round((receita / n(r.meta_mensal)) * 100) : 0,
      topClient: top ? (top.nome_fantasia || top.nome_razao_social || '—') : '—',
    });
  }
  return sellers;
}

// ----------------------- DATASET COMPLETO -----------------------
export async function buildDataset(pool) {
  const [producao, machines, est, lotsData, com, sellers] = await Promise.all([
    getProducao(pool), getMachines(pool), getEstoque(pool), getLots(pool), getComercial(pool), getSellers(pool),
  ]);
  return {
    tabs: { producao, estoque: est.tab, comercial: com.tab },
    machines,
    occupancy: lotsData.occupancy,
    lots: lotsData.lots,
    sellers,
  };
}

// ----------------------- helpers -----------------------
function brl(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return `R$ ${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  if (Math.abs(n) >= 1e3) return `R$ ${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}
function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase(); }
