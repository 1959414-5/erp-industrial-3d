-- =====================================================================
--  ERP Industrial Analytics 3D — Seed 04: DADOS VARIADOS para a demonstração
--  Banco: MySQL 8 / TiDB (erp_industrial_analytics)
--
--  Rode DEPOIS do 03_seed_empresa_media.sql. Pode rodar de novo sem duplicar nada.
--
--  O que este script faz (para o painel mostrar cenários reais, não "tudo verde"):
--    ✓ MÁQUINAS   — 10 operando (com OEE diferentes), 2 com falha (refugo alto) e 3 paradas
--    ✓ VENDEDORES — da meta batida com folga até vendedores bem abaixo (36%–165% da meta)
--    ✓ ESTOQUE    — lotes cheios, equilibrados, abaixo do mínimo, críticos e sem estoque
--    ✓ VOLUME     — +20 ordens de produção, +600 apontamentos (60 dias de histórico), +120 pedidos
--    ✓ PLANO      — ajusta o planejado das ordens para o "cumprimento do plano" ficar realista (~94%)
--
--  Regras que o painel usa (api/queries.js) e que este script respeita:
--    • máquina "com falha"  = refugo > 15% da produção;
--    • máquina "parada"     = sem apontamento nas últimas 24 h (contadas a partir do apontamento mais
--                              recente da base — ajustável em MACHINE_ACTIVE_HOURS);
--    • vendedor % da meta   = receita dos pedidos / meta_mensal;
--    • lote abaixo do mínimo = saldo (entradas − saídas) < estoque_minimo.
-- =====================================================================

USE erp_industrial_analytics;

-- Marcador: os ajustes que alteram dados existentes (perfis, metas, plano) só rodam uma vez.
CREATE TABLE IF NOT EXISTS seed_log (
  chave        VARCHAR(60) NOT NULL PRIMARY KEY,
  executado_em DATETIME    NOT NULL
);

-- =====================================================================
-- 1) MAIS ORDENS DE PRODUÇÃO (+20: OP-3030 .. OP-3049)
-- =====================================================================
INSERT INTO ordens_producao (codigo_ordem, id_produto, quantidade_planejada, status_ordem, data_abertura)
SELECT CONCAT('OP-', LPAD(3000 + seq.n, 4, '0')),
       prod.id_produto,
       ROUND(50 + MOD(seq.n * 73, 450)),
       ELT(1 + MOD(seq.n, 5), 'PLANEJADA','LIBERADA','EM_PRODUCAO','EM_PRODUCAO','CONCLUIDA'),
       NOW() - INTERVAL (seq.n * 2) DAY
FROM (
  SELECT a.n + b.n * 10 AS n FROM
    (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) b
) seq
JOIN (
  SELECT id_produto, ROW_NUMBER() OVER (ORDER BY id_produto) AS rn
  FROM produtos WHERE ativo = 1
) prod ON prod.rn = (MOD(seq.n, (SELECT COUNT(*) FROM produtos WHERE ativo = 1)) + 1)
WHERE seq.n >= 30 AND seq.n < 50
  AND NOT EXISTS (SELECT 1 FROM ordens_producao o WHERE o.codigo_ordem = CONCAT('OP-', LPAD(3000 + seq.n, 4, '0')));

-- =====================================================================
-- 2) HISTÓRICO DE PRODUÇÃO MAIS LONGO (+40 dias por máquina, antes do primeiro apontamento atual)
--    A data de referência é o apontamento mais recente da base, então nada "passa" na frente do que já existe.
-- =====================================================================
INSERT INTO apontamentos_producao
  (id_ordem_producao, numero_apontamento, etapa_producao, centro_trabalho, maquina,
   quantidade_produzida, quantidade_aprovada, quantidade_refugo, tempo_minutos, data_apontamento)
SELECT
  j.id_ordem_producao,
  COALESCE((SELECT MAX(a2.numero_apontamento)
            FROM apontamentos_producao a2
            WHERE a2.id_ordem_producao = j.id_ordem_producao), 0)
    + ROW_NUMBER() OVER (PARTITION BY j.id_ordem_producao ORDER BY j.data_ap, j.maquina) AS numero_apontamento,
  j.etapa, j.centro, j.maquina,
  j.produzido, j.aprovado, (j.produzido - j.aprovado) AS refugo, j.tempo, j.data_ap
FROM (
  SELECT base.*, op.id_ordem_producao
  FROM (
    SELECT
      maq.idx, maq.nome AS maquina, maq.etapa, maq.centro, dia.d AS dia,
      ROUND(30 + MOD(maq.idx * 17 + dia.d * 13, 120))                                               AS produzido,
      ROUND((30 + MOD(maq.idx * 17 + dia.d * 13, 120)) * (0.90 + MOD(maq.idx + dia.d, 8) * 0.012))  AS aprovado,
      ROUND(60 + MOD(maq.idx * 11 + dia.d * 7, 180), 2)                                             AS tempo,
      (SELECT MAX(x.data_apontamento) FROM apontamentos_producao x) - INTERVAL dia.d DAY            AS data_ap
    FROM (
      SELECT 1 idx, 'Corte a Laser 01' nome, 'Corte a Laser' etapa, 'CT-CORTE' centro UNION ALL
      SELECT 2, 'Corte a Laser 02', 'Corte a Laser', 'CT-CORTE' UNION ALL
      SELECT 3, 'Corte a Laser 03', 'Corte a Laser', 'CT-CORTE' UNION ALL
      SELECT 4, 'Dobradeira CNC 01', 'Dobra', 'CT-DOBRA' UNION ALL
      SELECT 5, 'Dobradeira CNC 02', 'Dobra', 'CT-DOBRA' UNION ALL
      SELECT 6, 'Centro de Usinagem 01', 'Usinagem', 'CT-USINAGEM' UNION ALL
      SELECT 7, 'Centro de Usinagem 02', 'Usinagem', 'CT-USINAGEM' UNION ALL
      SELECT 8, 'Centro de Usinagem 03', 'Usinagem', 'CT-USINAGEM' UNION ALL
      SELECT 9, 'Solda Robotizada 01', 'Solda', 'CT-SOLDA' UNION ALL
      SELECT 10, 'Solda Robotizada 02', 'Solda', 'CT-SOLDA' UNION ALL
      SELECT 11, 'Solda Robotizada 03', 'Solda', 'CT-SOLDA' UNION ALL
      SELECT 12, 'Cabine de Pintura 01', 'Pintura', 'CT-PINTURA' UNION ALL
      SELECT 13, 'Cabine de Pintura 02', 'Pintura', 'CT-PINTURA' UNION ALL
      SELECT 14, 'Puncionadeira CNC 01', 'Puncionamento', 'CT-PUNCAO' UNION ALL
      SELECT 15, 'Serra de Fita 01', 'Corte Serra', 'CT-SERRA'
    ) maq
    CROSS JOIN (
      SELECT a.n + b.n * 10 AS d FROM
        (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
        (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b
      WHERE a.n + b.n * 10 >= 20 AND a.n + b.n * 10 < 60
    ) dia
  ) base
  JOIN (
    SELECT id_ordem_producao, ROW_NUMBER() OVER (ORDER BY id_ordem_producao) AS rn
    FROM ordens_producao
  ) op ON op.rn = (MOD(base.idx * 7 + base.dia, (SELECT COUNT(*) FROM ordens_producao)) + 1)
) j
WHERE NOT EXISTS (
  SELECT 1 FROM apontamentos_producao ap
  WHERE ap.maquina = j.maquina
    AND DATE(ap.data_apontamento) = DATE(j.data_ap)
);

-- =====================================================================
-- 3) PERFIL DE CADA MÁQUINA  (qualidade, volume e dias sem apontar)
--      q = índice de aprovação alvo (OEE estimado)   f = fator de volume   k = dias sem apontar
--    • refugo > 15%  (q < 0,85)  → COM FALHA          • k >= 2 dias                → PARADA
--    Os valores são gravados por uma tabela temporária (evita depender da ordem de avaliação do UPDATE).
-- =====================================================================
DROP TABLE IF EXISTS seed_tmp_aponta;
CREATE TABLE seed_tmp_aponta (
  id_apontamento BIGINT        NOT NULL PRIMARY KEY,
  np             DECIMAL(15,3) NOT NULL,
  apr            DECIMAL(15,3) NOT NULL,
  refugo         DECIMAL(15,3) NOT NULL,
  nd             DATETIME      NOT NULL
);

INSERT INTO seed_tmp_aponta (id_apontamento, np, apr, refugo, nd)
SELECT y.id_apontamento, y.np, ROUND(y.np * y.qr), y.np - ROUND(y.np * y.qr), y.nd
FROM (
  SELECT x.id_apontamento,
         ROUND(x.quantidade_produzida * t.f)                                   AS np,
         LEAST(0.995, t.q + (MOD(x.id_apontamento, 7) - 3) * 0.006)            AS qr,
         x.data_apontamento - INTERVAL t.k DAY                                 AS nd
  FROM apontamentos_producao x
  JOIN (
    SELECT 'Corte a Laser 01' AS maquina, 0.975 AS q, 1.20 AS f, 0 AS k UNION ALL   -- operando, excelente
    SELECT 'Corte a Laser 02',            0.940,      1.05,      0      UNION ALL   -- operando, bom
    SELECT 'Corte a Laser 03',            0.915,      1.10,      0      UNION ALL   -- operando
    SELECT 'Dobradeira CNC 01',           0.880,      0.70,      3      UNION ALL   -- PARADA há 3 dias
    SELECT 'Dobradeira CNC 02',           0.955,      1.00,      0      UNION ALL   -- operando, bom
    SELECT 'Centro de Usinagem 01',       0.985,      1.25,      0      UNION ALL   -- operando, melhor da fábrica
    SELECT 'Centro de Usinagem 02',       0.930,      0.95,      0      UNION ALL   -- operando
    SELECT 'Centro de Usinagem 03',       0.865,      0.85,      0      UNION ALL   -- operando, mas no limite (refugo ~13%)
    SELECT 'Solda Robotizada 01',         0.965,      1.15,      0      UNION ALL   -- operando, ótimo
    SELECT 'Solda Robotizada 02',         0.780,      0.60,      0      UNION ALL   -- COM FALHA (refugo ~22%)
    SELECT 'Solda Robotizada 03',         0.830,      0.80,      0      UNION ALL   -- COM FALHA (refugo ~17%)
    SELECT 'Cabine de Pintura 01',        0.920,      0.90,      0      UNION ALL   -- operando
    SELECT 'Cabine de Pintura 02',        0.900,      0.55,      2      UNION ALL   -- PARADA há 2 dias
    SELECT 'Puncionadeira CNC 01',        0.895,      0.95,      0      UNION ALL   -- operando, OEE médio
    SELECT 'Serra de Fita 01',            0.870,      0.50,      5                  -- PARADA há 5 dias, OEE baixo
  ) t ON t.maquina = x.maquina
  WHERE NOT EXISTS (SELECT 1 FROM seed_log WHERE chave = 'perfis_v1')
) y;

UPDATE apontamentos_producao a
JOIN seed_tmp_aponta n ON n.id_apontamento = a.id_apontamento
SET a.quantidade_produzida = n.np,
    a.quantidade_aprovada  = n.apr,
    a.quantidade_refugo    = n.refugo,
    a.data_apontamento     = n.nd;

DROP TABLE IF EXISTS seed_tmp_aponta;

-- =====================================================================
-- 4) +120 PEDIDOS DE VENDA, com pesos diferentes por vendedor
--    (João, Elisa e Carla vendem mais; Bruno e Isabela quase não recebem pedidos novos)
-- =====================================================================
INSERT INTO pedidos_venda
  (codigo_pedido, id_cliente, id_vendedor, data_pedido, data_prevista_entrega, status_pedido, criado_em)
SELECT
  CONCAT('MED2-PV-', LPAD(seq.n, 4, '0')),
  c.id_cliente,
  v.id_vendedor,
  NOW() - INTERVAL ROUND(seq.n * 0.75) DAY,
  (NOW() - INTERVAL ROUND(seq.n * 0.75) DAY) + INTERVAL 12 DAY,
  ELT(1 + MOD(seq.n, 7), 'PENDENTE','APROVADO','EM_PRODUCAO','FATURADO','ENTREGUE','FATURADO','PENDENTE'),
  NOW()
FROM (
  SELECT a.n + b.n * 10 + c2.n * 100 AS n FROM
    (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b,
    (SELECT 0 n UNION SELECT 1) c2
  WHERE a.n + b.n * 10 + c2.n * 100 < 120
) seq
JOIN (
  SELECT id_cliente, ROW_NUMBER() OVER (ORDER BY id_cliente) AS rn
  FROM clientes WHERE ativo = 1
) c ON c.rn = (MOD(seq.n * 5 + 3, (SELECT COUNT(*) FROM clientes WHERE ativo = 1)) + 1)
JOIN (
  SELECT id_vendedor, ROW_NUMBER() OVER (ORDER BY id_vendedor) AS rn
  FROM vendedores WHERE ativo = 1
) v ON v.rn = ELT(1 + MOD(seq.n * 13, 20), 10,10,10,10,10, 5,5,5, 3,3,3, 7,7, 6,6, 8,8, 4, 1, 9)
WHERE NOT EXISTS (SELECT 1 FROM pedidos_venda pv WHERE pv.codigo_pedido = CONCAT('MED2-PV-', LPAD(seq.n, 4, '0')));

INSERT INTO itens_pedido_venda
  (id_pedido_venda, numero_item, id_produto, descricao_item, unidade_medida, quantidade, preco_unitario, desconto_percentual)
SELECT
  pv.id_pedido_venda, item.num, prod.id_produto, prod.descricao, prod.unidade_medida,
  ROUND(2 + MOD(pv.id_pedido_venda * 11 + item.num * 7, 40)),
  prod.preco_venda,
  ROUND(MOD(pv.id_pedido_venda + item.num, 6), 1)
FROM pedidos_venda pv
CROSS JOIN (SELECT 1 num UNION SELECT 2 UNION SELECT 3) item
JOIN (
  SELECT id_produto, descricao, unidade_medida, preco_venda,
         ROW_NUMBER() OVER (ORDER BY id_produto) AS rn
  FROM produtos WHERE categoria = 'Chapas'
) prod ON prod.rn = (MOD(pv.id_pedido_venda * 5 + item.num, (SELECT COUNT(*) FROM produtos WHERE categoria = 'Chapas')) + 1)
WHERE pv.codigo_pedido LIKE 'MED2-PV-%'
  AND item.num <= 1 + MOD(pv.id_pedido_venda, 3)
  AND NOT EXISTS (
    SELECT 1 FROM itens_pedido_venda i
    WHERE i.id_pedido_venda = pv.id_pedido_venda AND i.numero_item = item.num
  );

-- =====================================================================
-- 5) METAS DOS VENDEDORES  (percentual da meta que cada um atinge com a receita atual)
--    ≥ 100% = bateu a meta · 70–99% = quase lá · < 70% = baixo rendimento (o painel alerta)
-- =====================================================================
DROP TABLE IF EXISTS seed_tmp_meta;
CREATE TABLE seed_tmp_meta (
  id_vendedor BIGINT        NOT NULL PRIMARY KEY,
  nova_meta   DECIMAL(15,2) NOT NULL
);

INSERT INTO seed_tmp_meta (id_vendedor, nova_meta)
SELECT v.id_vendedor, GREATEST(1000, ROUND(r.receita / t.pct / 1000) * 1000)
FROM vendedores v
JOIN (
  SELECT pv.id_vendedor,
         SUM(i.quantidade * i.preco_unitario * (1 - IFNULL(i.desconto_percentual, 0) / 100)) AS receita
  FROM pedidos_venda pv
  JOIN itens_pedido_venda i ON i.id_pedido_venda = pv.id_pedido_venda
  GROUP BY pv.id_vendedor
) r ON r.id_vendedor = v.id_vendedor
JOIN (
  SELECT 'V010' AS cod, 1.65 AS pct UNION ALL   -- João Pedro Silva: estrela do time
  SELECT 'V005',        1.38        UNION ALL   -- Elisa Rocha
  SELECT 'V003',        1.12        UNION ALL   -- Carla Mendes
  SELECT 'V007',        1.04        UNION ALL   -- Gabriela Nunes: na meta
  SELECT 'V006',        0.91        UNION ALL   -- Fabio Costa: quase lá
  SELECT 'V008',        0.83        UNION ALL   -- Henrique Dias
  SELECT 'V004',        0.71        UNION ALL   -- Diego Alves (ausente)
  SELECT 'V001',        0.58        UNION ALL   -- Ana Souza: abaixo de 70%
  SELECT 'V009',        0.49        UNION ALL   -- Isabela Martins: abaixo de 70%
  SELECT 'V002',        0.36                    -- Bruno Lima: crítico
) t ON t.cod = v.codigo_vendedor
WHERE NOT EXISTS (SELECT 1 FROM seed_log WHERE chave = 'metas_v1');

UPDATE vendedores v
JOIN seed_tmp_meta m ON m.id_vendedor = v.id_vendedor
SET v.meta_mensal = m.nova_meta;

DROP TABLE IF EXISTS seed_tmp_meta;

-- =====================================================================
-- 6) ESTOQUE VARIADO  (ajuste de inventário por chapa, via movimentação AJUSTE — como nos seeds anteriores)
--      10% sem estoque · 10% críticas (35% do mínimo) · 10% abaixo do mínimo (75%)
--      40% equilibradas · 20% confortáveis · 10% cheias
-- =====================================================================
INSERT INTO movimentacoes_estoque
  (id_produto, tipo_movimentacao, origem_movimentacao, quantidade, data_movimentacao, documento_referencia, observacao)
SELECT t.id_produto,
       IF(t.alvo >= t.saldo, 'ENTRADA', 'SAIDA'),
       'AJUSTE',
       ABS(t.alvo - t.saldo),
       NOW(),
       CONCAT('SEED-VAR-', t.id_produto),
       'Ajuste de inventario (seed dados variados)'
FROM (
  SELECT p.id_produto,
         COALESCE(s.saldo_atual, 0) AS saldo,
         CASE MOD(ROW_NUMBER() OVER (ORDER BY p.id_produto), 10)
           WHEN 0 THEN 0
           WHEN 1 THEN ROUND(p.estoque_minimo * 0.35)
           WHEN 2 THEN ROUND(p.estoque_minimo * 0.75)
           WHEN 7 THEN ROUND(p.estoque_minimo + (p.estoque_maximo - p.estoque_minimo) * 0.75)
           WHEN 8 THEN ROUND(p.estoque_minimo + (p.estoque_maximo - p.estoque_minimo) * 0.75)
           WHEN 9 THEN ROUND(p.estoque_maximo)
           ELSE        ROUND(p.estoque_minimo + (p.estoque_maximo - p.estoque_minimo) * 0.45)
         END AS alvo
  FROM produtos p
  LEFT JOIN vw_saldo_estoque s ON s.id_produto = p.id_produto
  WHERE p.categoria = 'Chapas' AND p.ativo = 1
) t
WHERE ABS(t.alvo - t.saldo) > 0
  AND NOT EXISTS (
    SELECT 1 FROM movimentacoes_estoque m
    WHERE m.id_produto = t.id_produto AND m.documento_referencia = CONCAT('SEED-VAR-', t.id_produto)
  );

-- =====================================================================
-- 7) PLANO DE PRODUÇÃO REALISTA  (cumprimento do plano ≈ 94% em vez de centenas de %)
-- =====================================================================
DROP TABLE IF EXISTS seed_tmp_plano;
CREATE TABLE seed_tmp_plano (
  id_ordem_producao BIGINT        NOT NULL PRIMARY KEY,
  novo_plano        DECIMAL(15,3) NOT NULL
);

INSERT INTO seed_tmp_plano (id_ordem_producao, novo_plano)
SELECT o.id_ordem_producao, GREATEST(1, ROUND(o.quantidade_planejada * k.f))
FROM ordens_producao o
CROSS JOIN (
  SELECT (SELECT SUM(quantidade_produzida) FROM apontamentos_producao)
         / (0.94 * (SELECT SUM(quantidade_planejada) FROM ordens_producao)) AS f
) k
WHERE NOT EXISTS (SELECT 1 FROM seed_log WHERE chave = 'plano_v1');

UPDATE ordens_producao o
JOIN seed_tmp_plano p ON p.id_ordem_producao = o.id_ordem_producao
SET o.quantidade_planejada = p.novo_plano;

DROP TABLE IF EXISTS seed_tmp_plano;

-- marca como executado (os ajustes das seções 3, 5 e 7 não se repetem)
INSERT IGNORE INTO seed_log (chave, executado_em) VALUES ('perfis_v1', NOW());
INSERT IGNORE INTO seed_log (chave, executado_em) VALUES ('metas_v1',  NOW());
INSERT IGNORE INTO seed_log (chave, executado_em) VALUES ('plano_v1',  NOW());

-- =====================================================================
-- CONFERÊNCIA
-- =====================================================================
SELECT
  (SELECT COUNT(*) FROM ordens_producao)                       AS ordens_producao,
  (SELECT COUNT(*) FROM apontamentos_producao)                 AS apontamentos,
  (SELECT COUNT(DISTINCT maquina) FROM apontamentos_producao)  AS maquinas,
  (SELECT COUNT(*) FROM pedidos_venda)                         AS pedidos,
  (SELECT COUNT(*) FROM vw_saldo_estoque WHERE saldo_atual <= 0)                            AS sem_estoque,
  (SELECT COUNT(*) FROM vw_saldo_estoque WHERE saldo_atual > 0 AND saldo_atual < estoque_minimo) AS abaixo_minimo;
