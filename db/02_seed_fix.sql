-- =====================================================================
--  ERP Industrial Analytics 3D - Correção do seed (parte 3 e 4)
--  Rode DEPOIS do 01_seed_portfolio.sql. Corrige o que foi barrado pelas
--  CHECK constraints do banco:
--    - estoque: origem COMPRA exige id_item_pedido_compra -> usa AJUSTE
--    - pedidos_venda.status: não existe 'ABERTO' -> usa PENDENTE/APROVADO/FATURADO/ENTREGUE
--  É idempotente: pode rodar de novo sem duplicar (usa marcadores SEED-*).
-- =====================================================================

USE erp_industrial_analytics;

-- ---------------------------------------------------------------------
-- 3) SALDO DE ESTOQUE das chapas  (origem AJUSTE, sem vínculo de pedido)
-- ---------------------------------------------------------------------
INSERT INTO movimentacoes_estoque
  (id_produto, tipo_movimentacao, origem_movimentacao, quantidade, data_movimentacao, documento_referencia, observacao)
SELECT p.id_produto, 'ENTRADA', 'AJUSTE',
       ROUND(20 + MOD(p.id_produto * 37, 260), 0) AS quantidade,
       NOW(), 'SEED-ESTOQUE', 'Carga inicial de estoque (seed portfolio)'
FROM produtos p
WHERE p.categoria = 'Chapas'
  AND NOT EXISTS (
    SELECT 1 FROM movimentacoes_estoque m
    WHERE m.id_produto = p.id_produto AND m.documento_referencia = 'SEED-ESTOQUE'
  );

-- ---------------------------------------------------------------------
-- 4a) vincula os pedidos de venda já existentes a um vendedor
-- ---------------------------------------------------------------------
UPDATE pedidos_venda
SET id_vendedor = (MOD(id_pedido_venda, 6) + 1)
WHERE id_vendedor IS NULL;

-- ---------------------------------------------------------------------
-- 4b) cria pedidos de venda de exemplo (1 por cliente ativo, até 12)
--     status válidos: PENDENTE | APROVADO | FATURADO | ENTREGUE
-- ---------------------------------------------------------------------
INSERT INTO pedidos_venda
  (codigo_pedido, id_cliente, id_vendedor, data_pedido, data_prevista_entrega, status_pedido, criado_em)
SELECT CONCAT('SEED-PV-', LPAD(c.rn, 4, '0')),
       c.id_cliente,
       (MOD(c.rn, 6) + 1),
       NOW() - INTERVAL ROUND(c.rn * 3) DAY,
       NOW() + INTERVAL 7 DAY,
       ELT(1 + MOD(c.rn, 4), 'PENDENTE','FATURADO','ENTREGUE','APROVADO'),
       NOW()
FROM (
  SELECT id_cliente, ROW_NUMBER() OVER (ORDER BY id_cliente) AS rn
  FROM clientes WHERE ativo = 1
) c
WHERE c.rn <= 12
  AND NOT EXISTS (SELECT 1 FROM pedidos_venda pv WHERE pv.codigo_pedido = CONCAT('SEED-PV-', LPAD(c.rn, 4, '0')));

-- ---------------------------------------------------------------------
-- 4c) um item por pedido de seed (uma chapa, preço do produto)
-- ---------------------------------------------------------------------
INSERT INTO itens_pedido_venda
  (id_pedido_venda, numero_item, id_produto, descricao_item, unidade_medida, quantidade, preco_unitario, desconto_percentual)
SELECT pv.id_pedido_venda, 1, prod.id_produto, prod.descricao, prod.unidade_medida,
       ROUND(5 + MOD(pv.id_pedido_venda, 20), 0) AS quantidade,
       prod.preco_venda, 0
FROM pedidos_venda pv
JOIN (
  SELECT id_produto, descricao, unidade_medida, preco_venda,
         ROW_NUMBER() OVER (ORDER BY id_produto) AS rn
  FROM produtos WHERE categoria = 'Chapas'
) prod ON prod.rn = (MOD(pv.id_pedido_venda, 12) + 1)
WHERE pv.codigo_pedido LIKE 'SEED-PV-%'
  AND NOT EXISTS (SELECT 1 FROM itens_pedido_venda i WHERE i.id_pedido_venda = pv.id_pedido_venda);

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
SELECT (SELECT COUNT(*) FROM produtos WHERE categoria='Chapas')                 AS chapas,
       (SELECT COUNT(*) FROM movimentacoes_estoque WHERE documento_referencia='SEED-ESTOQUE') AS mov_estoque_seed,
       (SELECT COUNT(*) FROM pedidos_venda)                                     AS total_pedidos,
       (SELECT SUM(id_vendedor IS NOT NULL) FROM pedidos_venda)                 AS pedidos_com_vendedor;
