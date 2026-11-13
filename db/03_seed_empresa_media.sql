-- =====================================================================
--  ERP Industrial Analytics 3D — Seed EMPRESA DE MÉDIO PORTE
--  Banco: MySQL 8 (erp_industrial_analytics)
--
--  ATENÇÃO: rode DEPOIS do 01_seed_portfolio.sql (que cria vendedores,
--  chapas iniciais e a FK id_vendedor em pedidos_venda).
--  Se já rodou o 02_seed_fix.sql, sem problema — este script NÃO duplica
--  nada (usa ON DUPLICATE KEY e NOT EXISTS em tudo).
--
--  O que este script adiciona:
--    ✓  4 novos vendedores (total: 10)
--    ✓  25+ novos produtos de chapa (total: ~37)
--    ✓  20+ fornecedores
--    ✓  25+ clientes ativos
--    ✓  30 ordens de produção
--    ✓  ~300 apontamentos de produção em 15 máquinas
--    ✓  Saldo de estoque para todas as chapas
--    ✓  ~160 pedidos de venda com itens, distribuídos entre os vendedores
--    ✓  Movimentações de estoque (compras, vendas, ajustes, produção)
-- =====================================================================

USE erp_industrial_analytics;

-- =====================================================================
-- 1) NOVOS VENDEDORES  (4 extras → total 10)
-- =====================================================================
INSERT INTO vendedores (codigo_vendedor, nome, email, status, meta_mensal) VALUES
  ('V007','Gabriela Nunes',  'gabriela.nunes@empresa.com.br',  'online', 250000),
  ('V008','Henrique Dias',   'henrique.dias@empresa.com.br',   'busy',   230000),
  ('V009','Isabela Martins',  'isabela.martins@empresa.com.br', 'online', 240000),
  ('V010','João Pedro Silva', 'joao.silva@empresa.com.br',     'online', 220000)
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

-- =====================================================================
-- 2) NOVOS PRODUTOS — CHAPAS (matéria-prima)
--    25 tipos adicionais de chapa de diversas ligas e espessuras
-- =====================================================================
INSERT INTO produtos
  (codigo_produto, descricao, categoria, tipo_produto, unidade_medida,
   controla_estoque, estoque_minimo, estoque_maximo, custo_padrao, preco_venda, ativo, criado_em)
VALUES
  -- Aço Carbono SAE 1020 — espessuras extras
  ('CHP-1020-2.0','Chapa Aco Carbono SAE 1020 2,00mm 2000x1250','Chapas','MP','CHAPA',1, 50,500, 104.00, 145.00,1,NOW()),
  ('CHP-1020-8.0','Chapa Aco Carbono SAE 1020 8,00mm 2000x1250','Chapas','MP','CHAPA',1, 20,200, 418.00, 560.00,1,NOW()),
  ('CHP-1020-9.5','Chapa Aco Carbono SAE 1020 9,53mm 2000x1250','Chapas','MP','CHAPA',1, 15,150, 498.00, 660.00,1,NOW()),
  ('CHP-1020-12','Chapa Aco Carbono SAE 1020 12,70mm 2000x1250','Chapas','MP','CHAPA',1, 10,120, 663.00, 880.00,1,NOW()),
  ('CHP-1020-16','Chapa Aco Carbono SAE 1020 15,88mm 2000x1250','Chapas','MP','CHAPA',1,  8,100, 829.00,1100.00,1,NOW()),
  ('CHP-1020-19','Chapa Aco Carbono SAE 1020 19,05mm 2000x1250','Chapas','MP','CHAPA',1,  5, 80, 995.00,1320.00,1,NOW()),
  ('CHP-1020-25','Chapa Aco Carbono SAE 1020 25,40mm 2000x1250','Chapas','MP','CHAPA',1,  5, 60,1327.00,1760.00,1,NOW()),

  -- Aço Carbono SAE 1045 (alto carbono)
  ('CHP-1045-3.0','Chapa Aco Carbono SAE 1045 3,00mm 2000x1250','Chapas','MP','CHAPA',1, 20,200, 185.00, 255.00,1,NOW()),
  ('CHP-1045-6.35','Chapa Aco Carbono SAE 1045 6,35mm 2000x1250','Chapas','MP','CHAPA',1, 15,150, 390.00, 530.00,1,NOW()),

  -- Aço Galvanizado — espessuras extras
  ('CHP-GALV-0.5','Chapa Galvanizada 0,50mm 2000x1250','Chapas','MP','CHAPA',1, 60,600,  36.00,  55.00,1,NOW()),
  ('CHP-GALV-0.8','Chapa Galvanizada 0,80mm 2000x1250','Chapas','MP','CHAPA',1, 60,600,  58.00,  85.00,1,NOW()),
  ('CHP-GALV-1.2','Chapa Galvanizada 1,20mm 2000x1250','Chapas','MP','CHAPA',1, 50,500,  78.00, 110.00,1,NOW()),
  ('CHP-GALV-4.75','Chapa Galvanizada 4,75mm 2000x1250','Chapas','MP','CHAPA',1, 20,200, 308.00, 420.00,1,NOW()),

  -- Inox — espessuras extras e tipo 430
  ('CHP-INOX-0.5','Chapa Inox 304 0,50mm 2000x1250','Chapas','MP','CHAPA',1, 30,300, 155.00, 220.00,1,NOW()),
  ('CHP-INOX-0.8','Chapa Inox 304 0,80mm 2000x1250','Chapas','MP','CHAPA',1, 30,300, 220.00, 310.00,1,NOW()),
  ('CHP-INOX-4.75','Chapa Inox 304 4,75mm 2000x1250','Chapas','MP','CHAPA',1, 15,120, 930.00,1250.00,1,NOW()),
  ('CHP-INOX430-1.5','Chapa Inox 430 1,50mm 2000x1250','Chapas','MP','CHAPA',1, 25,250, 230.00, 320.00,1,NOW()),
  ('CHP-INOX430-2.0','Chapa Inox 430 2,00mm 2000x1250','Chapas','MP','CHAPA',1, 25,250, 305.00, 420.00,1,NOW()),

  -- Alumínio — espessuras extras
  ('CHP-ALU-0.5','Chapa Aluminio 5052 0,50mm 2000x1250','Chapas','MP','CHAPA',1, 40,400,  42.00,  62.00,1,NOW()),
  ('CHP-ALU-1.0','Chapa Aluminio 5052 1,00mm 2000x1250','Chapas','MP','CHAPA',1, 35,350,  78.00, 110.00,1,NOW()),
  ('CHP-ALU-1.5','Chapa Aluminio 5052 1,50mm 2000x1250','Chapas','MP','CHAPA',1, 30,300, 110.00, 155.00,1,NOW()),
  ('CHP-ALU-4.0','Chapa Aluminio 5052 4,00mm 2000x1250','Chapas','MP','CHAPA',1, 20,200, 282.00, 390.00,1,NOW()),
  ('CHP-ALU-6.0','Chapa Aluminio 5052 6,35mm 2000x1250','Chapas','MP','CHAPA',1, 15,150, 424.00, 580.00,1,NOW()),

  -- Chapa xadrez antiderrapante
  ('CHP-XAD-3.0','Chapa Xadrez Aco Carbono 3,00mm 2000x1250','Chapas','MP','CHAPA',1, 25,200, 180.00, 245.00,1,NOW()),
  ('CHP-XAD-4.75','Chapa Xadrez Aco Carbono 4,75mm 2000x1250','Chapas','MP','CHAPA',1, 20,180, 280.00, 380.00,1,NOW()),

  -- Hardox (chapa de desgaste)
  ('CHP-HRX-6.0','Chapa Hardox 450 6,00mm 2000x1250','Chapas','MP','CHAPA',1, 10, 80, 680.00, 920.00,1,NOW())
ON DUPLICATE KEY UPDATE descricao = VALUES(descricao), preco_venda = VALUES(preco_venda);

-- =====================================================================
-- 3) FORNECEDORES (20+)
-- =====================================================================
INSERT INTO fornecedores (codigo_fornecedor, nome_razao_social, nome_fantasia, tipo_pessoa, documento, ativo, criado_em)
VALUES
  ('F001','Acos Especiais do Brasil Ltda','Aços Brasil','J','40000000000001',1,NOW()),
  ('F002','Siderurgica Maringa SA','Sidermar','J','40000000000002',1,NOW()),
  ('F003','Distribuidora de Metais Norte PR Ltda','MetalNorte','J','40000000000003',1,NOW()),
  ('F004','Aco Plano Distribuicao SA','Aco Plano','J','40000000000004',1,NOW()),
  ('F005','Gerdau Acos Longos SA','Gerdau','J','40000000000005',1,NOW()),
  ('F006','ArcelorMittal Distribuicao Ltda','ArcelorMittal Dist.','J','40000000000006',1,NOW()),
  ('F007','Usiminas Mecanica SA','Usiminas Mec.','J','40000000000007',1,NOW()),
  ('F008','Aluminio do Parana Ltda','AluPR','J','40000000000008',1,NOW()),
  ('F009','Inox Center Maringa Ltda','Inox Center','J','40000000000009',1,NOW()),
  ('F010','Metalurgica Forte Ltda','Forte Metais','J','40000000000010',1,NOW()),
  ('F011','Parafusos e Fixadores PR Ltda','ParaFix PR','J','40000000000011',1,NOW()),
  ('F012','Gases Industriais Sul SA','GIS Gases','J','40000000000012',1,NOW()),
  ('F013','Tintas e Revestimentos Industriais Ltda','TRI Tintas','J','40000000000013',1,NOW()),
  ('F014','Abrasivos Delta Ltda','Abrasivos Delta','J','40000000000014',1,NOW()),
  ('F015','Rolamentos e Transmissao Sul Ltda','RTS Rolamentos','J','40000000000015',1,NOW()),
  ('F016','Solda Center Ltda','Solda Center','J','40000000000016',1,NOW()),
  ('F017','Lubrificantes Industriais Eireli','LubriInd','J','40000000000017',1,NOW()),
  ('F018','EPI Seguranca Total Ltda','EPI Total','J','40000000000018',1,NOW()),
  ('F019','Ferramentas Diamantadas PR Ltda','FDP Ferramentas','J','40000000000019',1,NOW()),
  ('F020','Embalagens Industriais Maringa Ltda','EmbaMar','J','40000000000020',1,NOW()),
  ('F021','Chapas Finas do Sul SA','ChapaSul','J','40000000000021',1,NOW()),
  ('F022','Logistica e Transporte Norte PR Ltda','LogiNorte','J','40000000000022',1,NOW())
ON DUPLICATE KEY UPDATE nome_razao_social = VALUES(nome_razao_social);

-- =====================================================================
-- 4) CLIENTES EXTRAS (25+ ativos no total)
-- =====================================================================
INSERT INTO clientes (codigo_cliente, nome_razao_social, nome_fantasia, tipo_pessoa, documento, ativo, criado_em)
VALUES
  ('CLI-010','Metalurgica Alfa Maringa Ltda','Metalúrgica Alfa','J','50000000000001',1,NOW()),
  ('CLI-011','Construtora Horizonte SA','Horizonte Construções','J','50000000000002',1,NOW()),
  ('CLI-012','Industria de Maquinas Agro Sul Ltda','AgroSul Máquinas','J','50000000000003',1,NOW()),
  ('CLI-013','Montadora de Carrocerias PR Ltda','CarroPR','J','50000000000004',1,NOW()),
  ('CLI-014','Estruturas Metalicas Maringa Ltda','EstruMar','J','50000000000005',1,NOW()),
  ('CLI-015','Caldeiraria Pesada Norte Ltda','Caldeiraria Norte','J','50000000000006',1,NOW()),
  ('CLI-016','Industria de Implementos Rodoviarios Ltda','ImpRodo','J','50000000000007',1,NOW()),
  ('CLI-017','Fab. de Esquadrias Aluminio Maringa Ltda','EsquadriAlu','J','50000000000008',1,NOW()),
  ('CLI-018','Mobiliario Corporativo SA','MobCorp','J','50000000000009',1,NOW()),
  ('CLI-019','Engenharia e Projetos Industriais Ltda','EPIndus','J','50000000000010',1,NOW()),
  ('CLI-020','Serralheria Industrial Maringa Ltda','SerraInd','J','50000000000011',1,NOW()),
  ('CLI-021','Tanques e Reservatorios PR Ltda','TanquesPR','J','50000000000012',1,NOW()),
  ('CLI-022','Elevadores e Escadas Ltda','ElevaMax','J','50000000000013',1,NOW()),
  ('CLI-023','Pecas e Estamparia Ltda','EstampMax','J','50000000000014',1,NOW()),
  ('CLI-024','Industria Naval do Sul Ltda','NavalSul','J','50000000000015',1,NOW()),
  ('CLI-025','Agro Equipamentos Maringa Ltda','AgroEquip','J','50000000000016',1,NOW()),
  ('CLI-026','Instalacoes Industriais SA','InstalInd','J','50000000000017',1,NOW()),
  ('CLI-027','Silos e Armazens PR Ltda','SiloPR','J','50000000000018',1,NOW()),
  ('CLI-028','Tratores e Implementos SA','TratImp','J','50000000000019',1,NOW()),
  ('CLI-029','Fundicao Maringa Ltda','FundiMar','J','50000000000020',1,NOW()),
  ('CLI-030','Energia Solar PR Ltda','SolEnergy','J','50000000000021',1,NOW()),
  ('CLI-031','Telecomunicacoes Torres SA','TeleTorres','J','50000000000022',1,NOW()),
  ('CLI-032','Hidrometalurgica Parana Ltda','HidroPR','J','50000000000023',1,NOW()),
  ('CLI-033','Componentes Automotivos SA','CompAuto','J','50000000000024',1,NOW()),
  ('CLI-034','Equipamentos Hospitalares Ltda','EquipHosp','J','50000000000025',1,NOW())
ON DUPLICATE KEY UPDATE nome_razao_social = VALUES(nome_razao_social);

-- =====================================================================
-- 5) ORDENS DE PRODUÇÃO (30 ordens, espalhadas nos últimos 90 dias)
-- =====================================================================
INSERT INTO ordens_producao (codigo_ordem, id_produto, quantidade_planejada, status_ordem, data_abertura)
SELECT CONCAT('OP-', LPAD(3000 + seq.n, 4, '0')),
       prod.id_produto,
       ROUND(50 + MOD(seq.n * 73, 450)),
       ELT(1 + MOD(seq.n, 5), 'PLANEJADA','LIBERADA','EM_PRODUCAO','EM_PRODUCAO','CONCLUIDA'),
       NOW() - INTERVAL (seq.n * 3) DAY
FROM (
  SELECT a.n + b.n * 10 AS n FROM
    (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 n UNION SELECT 1 UNION SELECT 2) b
) seq
JOIN (
  SELECT id_produto, ROW_NUMBER() OVER (ORDER BY id_produto) AS rn
  FROM produtos WHERE ativo = 1
) prod ON prod.rn = (MOD(seq.n, (SELECT COUNT(*) FROM produtos WHERE ativo = 1)) + 1)
WHERE seq.n < 30
  AND NOT EXISTS (SELECT 1 FROM ordens_producao o WHERE o.codigo_ordem = CONCAT('OP-', LPAD(3000 + seq.n, 4, '0')));

-- =====================================================================
-- 6) APONTAMENTOS DE PRODUÇÃO (~300, em 15 máquinas)
--    Máquinas nomeadas para o painel 3D detectar o tipo certo:
--      Corte a Laser 01, Corte a Laser 02, Corte a Laser 03,
--      Dobradeira CNC 01, Dobradeira CNC 02,
--      Centro de Usinagem 01, Centro de Usinagem 02, Centro de Usinagem 03,
--      Solda Robotizada 01, Solda Robotizada 02, Solda Robotizada 03,
--      Cabine de Pintura 01, Cabine de Pintura 02,
--      Puncionadeira CNC 01, Serra de Fita 01
-- =====================================================================
INSERT INTO apontamentos_producao
  (id_ordem_producao, numero_apontamento, etapa_producao, centro_trabalho, maquina,
   quantidade_produzida, quantidade_aprovada, quantidade_refugo, tempo_minutos, data_apontamento)
SELECT
  j.id_ordem_producao,
  -- numero único DENTRO de cada ordem (respeita uk_apontamentos_ordem_numero):
  -- parte do MAIOR numero já existente naquela ordem + sequência nova, assim
  -- não colide com apontamentos que o 01_seed já tenha criado.
  COALESCE((SELECT MAX(a2.numero_apontamento)
            FROM apontamentos_producao a2
            WHERE a2.id_ordem_producao = j.id_ordem_producao), 0)
    + ROW_NUMBER() OVER (PARTITION BY j.id_ordem_producao ORDER BY j.data_ap, j.maquina) AS numero_apontamento,
  j.etapa,
  j.centro,
  j.maquina,
  j.produzido,
  j.aprovado,
  (j.produzido - j.aprovado)           AS refugo,   -- garante produzido = aprovado + refugo
  j.tempo,
  j.data_ap
FROM (
  SELECT
    base.*, op.id_ordem_producao
  FROM (
  SELECT
    maq.idx, maq.nome AS maquina, maq.etapa, maq.centro, dia.d AS dia,
    ROUND(30 + MOD(maq.idx * 17 + dia.d * 13, 120))                                               AS produzido,
    ROUND((30 + MOD(maq.idx * 17 + dia.d * 13, 120)) * (0.90 + MOD(maq.idx + dia.d, 8) * 0.012))  AS aprovado,
    ROUND(60 + MOD(maq.idx * 11 + dia.d * 7, 180), 2)                                             AS tempo,
    NOW() - INTERVAL dia.d DAY                                                                    AS data_ap
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
      (SELECT 0 n UNION SELECT 1 UNION SELECT 2) b
    WHERE a.n + b.n * 10 < 20
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
-- 7) SALDO DE ESTOQUE para TODAS as chapas (inclusive as novas)
-- =====================================================================
INSERT INTO movimentacoes_estoque
  (id_produto, tipo_movimentacao, origem_movimentacao, quantidade, data_movimentacao, documento_referencia, observacao)
SELECT p.id_produto, 'ENTRADA', 'AJUSTE',
       ROUND(20 + MOD(p.id_produto * 37, 260), 0),
       NOW() - INTERVAL ROUND(MOD(p.id_produto * 13, 30)) DAY,
       CONCAT('SEED-ESTOQUE-', p.id_produto), 'Carga inicial de estoque (seed empresa media)'
FROM produtos p
WHERE p.categoria = 'Chapas'
  AND NOT EXISTS (
    SELECT 1 FROM movimentacoes_estoque m
    WHERE m.id_produto = p.id_produto AND m.documento_referencia = CONCAT('SEED-ESTOQUE-', p.id_produto)
  );

-- =====================================================================
-- 8) PEDIDOS DE VENDA (~160 pedidos, distribuídos entre 10 vendedores)
--    Um pedido por combinação de cliente × sequência, até 160
-- =====================================================================

-- 8a) Vincular pedidos existentes sem vendedor (mapeando pelos ids REAIS dos vendedores)
UPDATE pedidos_venda pv
JOIN (
  SELECT id_vendedor, ROW_NUMBER() OVER (ORDER BY id_vendedor) AS rn
  FROM vendedores WHERE ativo = 1
) v ON v.rn = (MOD(pv.id_pedido_venda, (SELECT COUNT(*) FROM vendedores WHERE ativo = 1)) + 1)
SET pv.id_vendedor = v.id_vendedor
WHERE pv.id_vendedor IS NULL;

-- 8b) Gerar pedidos novos
INSERT INTO pedidos_venda
  (codigo_pedido, id_cliente, id_vendedor, data_pedido, data_prevista_entrega, status_pedido, criado_em)
SELECT
  CONCAT('MED-PV-', LPAD(seq.n, 4, '0')),
  c.id_cliente,
  v.id_vendedor,
  NOW() - INTERVAL ROUND(seq.n * 1.8) DAY,
  (NOW() - INTERVAL ROUND(seq.n * 1.8) DAY) + INTERVAL 15 DAY,
  ELT(1 + MOD(seq.n, 6), 'PENDENTE','APROVADO','EM_PRODUCAO','FATURADO','ENTREGUE','FATURADO'),
  NOW()
FROM (
  SELECT a.n + b.n * 10 + c2.n * 100 AS n FROM
    (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
    (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b,
    (SELECT 0 n UNION SELECT 1) c2
  WHERE a.n + b.n * 10 + c2.n * 100 < 160
) seq
JOIN (
  SELECT id_cliente, ROW_NUMBER() OVER (ORDER BY id_cliente) AS rn
  FROM clientes WHERE ativo = 1
) c ON c.rn = (MOD(seq.n, (SELECT COUNT(*) FROM clientes WHERE ativo = 1)) + 1)
JOIN (
  SELECT id_vendedor, ROW_NUMBER() OVER (ORDER BY id_vendedor) AS rn
  FROM vendedores WHERE ativo = 1
) v ON v.rn = (MOD(seq.n, (SELECT COUNT(*) FROM vendedores WHERE ativo = 1)) + 1)
WHERE NOT EXISTS (SELECT 1 FROM pedidos_venda pv WHERE pv.codigo_pedido = CONCAT('MED-PV-', LPAD(seq.n, 4, '0')));

-- 8c) Itens dos pedidos (1-3 itens por pedido, cada um de uma chapa diferente)
INSERT INTO itens_pedido_venda
  (id_pedido_venda, numero_item, id_produto, descricao_item, unidade_medida, quantidade, preco_unitario, desconto_percentual)
SELECT
  pv.id_pedido_venda,
  item.num,
  prod.id_produto,
  prod.descricao,
  prod.unidade_medida,
  ROUND(3 + MOD(pv.id_pedido_venda * 7 + item.num * 13, 45)),
  prod.preco_venda,
  ROUND(MOD(pv.id_pedido_venda + item.num, 8), 1)
FROM pedidos_venda pv
CROSS JOIN (SELECT 1 num UNION SELECT 2 UNION SELECT 3) item
JOIN (
  SELECT id_produto, descricao, unidade_medida, preco_venda,
         ROW_NUMBER() OVER (ORDER BY id_produto) AS rn
  FROM produtos WHERE categoria = 'Chapas'
) prod ON prod.rn = (MOD(pv.id_pedido_venda * 3 + item.num, (SELECT COUNT(*) FROM produtos WHERE categoria = 'Chapas')) + 1)
WHERE pv.codigo_pedido LIKE 'MED-PV-%'
  AND item.num <= 1 + MOD(pv.id_pedido_venda, 3)  -- 1 a 3 itens por pedido
  AND NOT EXISTS (
    SELECT 1 FROM itens_pedido_venda i
    WHERE i.id_pedido_venda = pv.id_pedido_venda AND i.numero_item = item.num
  );

-- =====================================================================
-- 9) MOVIMENTAÇÕES EXTRAS (compras via pedido de compra e produção)
--    Aqui usamos AJUSTE para simular fluxo sem violar as CHECK constraints
-- =====================================================================
-- Entradas adicionais de estoque (simulando recebimentos de compra)
INSERT INTO movimentacoes_estoque
  (id_produto, tipo_movimentacao, origem_movimentacao, quantidade, data_movimentacao, documento_referencia, observacao)
SELECT p.id_produto, 'ENTRADA', 'AJUSTE',
       ROUND(10 + MOD(p.id_produto * 23, 80)),
       NOW() - INTERVAL ROUND(MOD(p.id_produto * 7, 45)) DAY,
       CONCAT('SEED-RECEB-', p.id_produto),
       'Recebimento simulado (seed empresa media)'
FROM produtos p
WHERE p.categoria = 'Chapas'
  AND NOT EXISTS (
    SELECT 1 FROM movimentacoes_estoque m
    WHERE m.id_produto = p.id_produto AND m.documento_referencia = CONCAT('SEED-RECEB-', p.id_produto)
  );

-- Saídas de estoque (simulando consumo de produção)
INSERT INTO movimentacoes_estoque
  (id_produto, tipo_movimentacao, origem_movimentacao, quantidade, data_movimentacao, documento_referencia, observacao)
SELECT p.id_produto, 'SAIDA', 'AJUSTE',
       ROUND(5 + MOD(p.id_produto * 11, 40)),
       NOW() - INTERVAL ROUND(MOD(p.id_produto * 3, 30)) DAY,
       CONCAT('SEED-CONSUMO-', p.id_produto),
       'Consumo producao simulado (seed empresa media)'
FROM produtos p
WHERE p.categoria = 'Chapas'
  AND NOT EXISTS (
    SELECT 1 FROM movimentacoes_estoque m
    WHERE m.id_produto = p.id_produto AND m.documento_referencia = CONCAT('SEED-CONSUMO-', p.id_produto)
  );

-- =====================================================================
-- CONFERÊNCIA
-- =====================================================================
SELECT
  (SELECT COUNT(*) FROM vendedores WHERE ativo = 1)                       AS vendedores_ativos,
  (SELECT COUNT(*) FROM produtos WHERE categoria = 'Chapas')              AS total_chapas,
  (SELECT COUNT(*) FROM clientes WHERE ativo = 1)                         AS clientes_ativos,
  (SELECT COUNT(*) FROM fornecedores WHERE ativo = 1)                     AS fornecedores_ativos,
  (SELECT COUNT(*) FROM ordens_producao)                                  AS ordens_producao,
  (SELECT COUNT(*) FROM apontamentos_producao)                            AS apontamentos,
  (SELECT COUNT(DISTINCT maquina) FROM apontamentos_producao)             AS maquinas_distintas,
  (SELECT COUNT(*) FROM pedidos_venda)                                    AS total_pedidos,
  (SELECT SUM(id_vendedor IS NOT NULL) FROM pedidos_venda)                AS pedidos_com_vendedor,
  (SELECT COUNT(*) FROM itens_pedido_venda)                               AS total_itens_pedido,
  (SELECT COUNT(*) FROM movimentacoes_estoque)                            AS total_movimentacoes;
