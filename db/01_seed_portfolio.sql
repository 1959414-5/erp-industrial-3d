-- =====================================================================
--  ERP Industrial Analytics 3D - Seed de dados para portfólio
--  Banco: MySQL 8 (erp_industrial_analytics)
--  O que este script faz:
--    1. Cria a entidade de vendedores e liga aos pedidos de venda
--    2. Popula vários produtos do tipo "Chapas" (matéria-prima)
--    3. Gera saldo de estoque das chapas (via movimentações)
--    4. Garante pedidos de venda distribuídos entre os vendedores
--  É idempotente no possível: pode rodar de novo sem duplicar vendedores
--  nem chapas (usa códigos únicos). Movimentações/pedidos de exemplo são
--  inseridos apenas se ainda não existirem os marcadores usados aqui.
-- =====================================================================

USE erp_industrial_analytics;

-- ---------------------------------------------------------------------
-- 1) VENDEDORES  (entidade que faltava no modelo)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendedores (
  id_vendedor     BIGINT AUTO_INCREMENT PRIMARY KEY,
  codigo_vendedor VARCHAR(20)  NOT NULL UNIQUE,
  nome            VARCHAR(120) NOT NULL,
  email           VARCHAR(120),
  status          VARCHAR(20)  NOT NULL DEFAULT 'online',   -- online | busy | away
  meta_mensal     DECIMAL(15,2) NOT NULL DEFAULT 200000,
  ativo           TINYINT      NOT NULL DEFAULT 1,
  criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO vendedores (codigo_vendedor, nome, email, status, meta_mensal) VALUES
  ('V001','Ana Souza',      'ana.souza@empresa.com.br',     'online', 240000),
  ('V002','Bruno Lima',     'bruno.lima@empresa.com.br',    'busy',   220000),
  ('V003','Carla Mendes',   'carla.mendes@empresa.com.br',  'online', 260000),
  ('V004','Diego Alves',    'diego.alves@empresa.com.br',   'away',   200000),
  ('V005','Elisa Rocha',    'elisa.rocha@empresa.com.br',   'online', 230000),
  ('V006','Fabio Costa',    'fabio.costa@empresa.com.br',   'busy',   210000)
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

-- liga pedidos_venda -> vendedores (coluna + FK, só se ainda não existir)
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos_venda'
               AND COLUMN_NAME = 'id_vendedor');
SET @sql := IF(@col = 0,
  'ALTER TABLE pedidos_venda ADD COLUMN id_vendedor BIGINT NULL',
  'SELECT "coluna id_vendedor ja existe" AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos_venda'
              AND CONSTRAINT_NAME = 'fk_pedido_vendedor');
SET @sql := IF(@fk = 0,
  'ALTER TABLE pedidos_venda ADD CONSTRAINT fk_pedido_vendedor FOREIGN KEY (id_vendedor) REFERENCES vendedores(id_vendedor)',
  'SELECT "fk ja existe" AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------
-- 2) CHAPAS  (vários produtos de matéria-prima, categoria "Chapas")
--    Combinações de material x espessura, preço de venda plausível (R$/kg * peso da chapa 2x1,25 m)
-- ---------------------------------------------------------------------
INSERT INTO produtos
  (codigo_produto, descricao, categoria, tipo_produto, unidade_medida,
   controla_estoque, estoque_minimo, estoque_maximo, custo_padrao, preco_venda, ativo, criado_em)
VALUES
  ('CHP-1020-1.5','Chapa Aco Carbono SAE 1020 1,50mm 2000x1250','Chapas','MP','CHAPA',1, 40, 400,  78.50,  110.00,1,NOW()),
  ('CHP-1020-3.0','Chapa Aco Carbono SAE 1020 3,00mm 2000x1250','Chapas','MP','CHAPA',1, 40, 400, 157.00,  210.00,1,NOW()),
  ('CHP-1020-4.75','Chapa Aco Carbono SAE 1020 4,75mm 2000x1250','Chapas','MP','CHAPA',1, 30, 300, 248.00,  330.00,1,NOW()),
  ('CHP-1020-6.35','Chapa Aco Carbono SAE 1020 6,35mm 2000x1250','Chapas','MP','CHAPA',1, 30, 300, 332.00,  440.00,1,NOW()),
  ('CHP-GALV-1.5','Chapa Galvanizada 1,50mm 2000x1250','Chapas','MP','CHAPA',1, 40, 400,  96.00,  135.00,1,NOW()),
  ('CHP-GALV-2.0','Chapa Galvanizada 2,00mm 2000x1250','Chapas','MP','CHAPA',1, 40, 400, 128.00,  180.00,1,NOW()),
  ('CHP-GALV-3.0','Chapa Galvanizada 3,00mm 2000x1250','Chapas','MP','CHAPA',1, 30, 300, 192.00,  260.00,1,NOW()),
  ('CHP-INOX-1.5','Chapa Inox 304 1,50mm 2000x1250','Chapas','MP','CHAPA',1, 25, 250, 310.00,  430.00,1,NOW()),
  ('CHP-INOX-2.0','Chapa Inox 304 2,00mm 2000x1250','Chapas','MP','CHAPA',1, 25, 250, 414.00,  560.00,1,NOW()),
  ('CHP-INOX-3.0','Chapa Inox 304 3,00mm 2000x1250','Chapas','MP','CHAPA',1, 20, 200, 620.00,  830.00,1,NOW()),
  ('CHP-ALU-2.0','Chapa Aluminio 5052 2,00mm 2000x1250','Chapas','MP','CHAPA',1, 30, 300, 141.00,  195.00,1,NOW()),
  ('CHP-ALU-3.0','Chapa Aluminio 5052 3,00mm 2000x1250','Chapas','MP','CHAPA',1, 30, 300, 212.00,  290.00,1,NOW())
ON DUPLICATE KEY UPDATE descricao = VALUES(descricao), preco_venda = VALUES(preco_venda);

-- ---------------------------------------------------------------------
-- 3) SALDO DE ESTOQUE das chapas
--    Uma movimentação de ENTRADA por chapa, com quantidade pseudo-aleatória
--    determinística (baseada no id do produto). documento_referencia marca
--    o seed pra não duplicar em reexecuções.
-- ---------------------------------------------------------------------
INSERT INTO movimentacoes_estoque
  (id_produto, tipo_movimentacao, origem_movimentacao, quantidade, data_movimentacao, documento_referencia, observacao)
SELECT p.id_produto, 'ENTRADA', 'AJUSTE',
       ROUND(20 + MOD(p.id_produto * 37, 260), 0) AS quantidade,   -- varia por produto
       -- origem AJUSTE: a CHECK do banco exige vínculo de pedido para COMPRA/VENDA;
       -- carga inicial de estoque não tem pedido, então entra como AJUSTE.
       NOW(), 'SEED-ESTOQUE', 'Carga inicial de estoque (seed portfolio)'
FROM produtos p
WHERE p.categoria = 'Chapas'
  AND NOT EXISTS (
    SELECT 1 FROM movimentacoes_estoque m
    WHERE m.id_produto = p.id_produto AND m.documento_referencia = 'SEED-ESTOQUE'
  );

-- ---------------------------------------------------------------------
-- 4) PEDIDOS DE VENDA distribuídos entre os vendedores
--    4a) vincula pedidos já existentes que estejam sem vendedor
-- ---------------------------------------------------------------------
UPDATE pedidos_venda
SET id_vendedor = (MOD(id_pedido_venda, 6) + 1)
WHERE id_vendedor IS NULL;

--    4b) se houver poucos pedidos, cria alguns pedidos de venda de exemplo
--        (um por cliente ativo, até 12), cada um com 1 item de chapa.
--        Marca com codigo_pedido prefixado 'SEED-' pra não duplicar.
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

--    4c) um item por pedido de seed, usando uma chapa e preço do produto
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
-- Conferência rápida (opcional): descomente para ver os totais
-- ---------------------------------------------------------------------
-- SELECT COUNT(*) AS chapas FROM produtos WHERE categoria = 'Chapas';
-- SELECT * FROM vw_saldo_estoque WHERE descricao LIKE 'Chapa%';
-- SELECT v.nome, COUNT(*) AS pedidos FROM pedidos_venda pv JOIN vendedores v USING(id_vendedor) GROUP BY v.nome;
