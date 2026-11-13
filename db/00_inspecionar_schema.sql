-- =====================================================================
-- INSPEÇÃO DA ESTRUTURA DO BANCO
-- Rode este arquivo inteiro. Ele gera 3 resultados (Result 1, 2 e 3).
-- Em CADA resultado: clique na grade -> Ctrl+A -> Ctrl+C
-- e cole AQUI NO CHAT como TEXTO (não precisa screenshot).
-- =====================================================================
USE erp_industrial_analytics;
SET SESSION group_concat_max_len = 1000000;

-- -------------------------------------------------------------------
-- RESULT 1: todas as colunas de todas as tabelas (1 linha por tabela)
-- -------------------------------------------------------------------
SELECT
  TABLE_NAME AS tabela,
  GROUP_CONCAT(
    CONCAT(
      COLUMN_NAME, ' ', COLUMN_TYPE,
      IF(IS_NULLABLE = 'NO', ' NOT_NULL', ' NULL'),
      IF(COLUMN_KEY <> '', CONCAT(' [', COLUMN_KEY, ']'), ''),
      IF(COLUMN_DEFAULT IS NOT NULL, CONCAT(' DEFAULT=', COLUMN_DEFAULT),
         IF(IS_NULLABLE = 'NO' AND EXTRA = '', ' SEM_DEFAULT', '')),
      IF(EXTRA <> '', CONCAT(' ', EXTRA), '')
    )
    ORDER BY ORDINAL_POSITION
    SEPARATOR '\n    '
  ) AS colunas
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
GROUP BY TABLE_NAME
ORDER BY TABLE_NAME;

-- -------------------------------------------------------------------
-- RESULT 2: CHECK constraints (regras de validação)
-- -------------------------------------------------------------------
SELECT
  tc.TABLE_NAME AS tabela,
  cc.CONSTRAINT_NAME AS constraint_name,
  cc.CHECK_CLAUSE    AS regra
FROM information_schema.CHECK_CONSTRAINTS cc
JOIN information_schema.TABLE_CONSTRAINTS tc
  ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA
 AND tc.CONSTRAINT_NAME   = cc.CONSTRAINT_NAME
WHERE cc.CONSTRAINT_SCHEMA = DATABASE()
ORDER BY tc.TABLE_NAME, cc.CONSTRAINT_NAME;

-- -------------------------------------------------------------------
-- RESULT 3: chaves estrangeiras (quem referencia quem)
-- -------------------------------------------------------------------
SELECT
  TABLE_NAME       AS tabela,
  COLUMN_NAME      AS coluna,
  REFERENCED_TABLE_NAME  AS referencia_tabela,
  REFERENCED_COLUMN_NAME AS referencia_coluna
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;
