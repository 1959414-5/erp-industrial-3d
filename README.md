# ERP Industrial Analytics 3D

Painel industrial em **3D** (TypeScript + Three.js) com fábrica navegável — máquinas,
lotes de chapas e escritório comercial clicáveis — alimentado por uma **API Node + Express**
que lê um banco **MySQL**.

```
erp3d/
├── src/            painel 3D (Vite + TypeScript + Three.js)
├── api/            API Express que lê o MySQL e serve /api/data
├── docs/           guia do assistente de IA (arquitetura + roteiro de entrevista)
├── db/             script SQL de carga de dados (seed)
└── public/         data.json (snapshot opcional para versão estática)
```

## Pré-requisitos
- Node.js 18+ (você já tem)
- MySQL 8 com o banco `erp_industrial_analytics`

---

## Passo 1 — Popular o banco (uma vez)
No MySQL Workbench, abra `db/01_seed_portfolio.sql` e execute o script inteiro.
Ele cria a tabela `vendedores`, liga aos pedidos, cadastra 12 tipos de chapa,
gera o saldo de estoque e distribui pedidos entre os vendedores.

Depois rode, na ordem, `db/02_seed_fix.sql`, `db/03_seed_empresa_media.sql` (empresa de médio porte: 10 vendedores,
38 chapas, 15 máquinas, ~160 pedidos) e **`db/04_dados_variados.sql`**, que cria cenários variados para a demonstração:
máquinas operando, paradas e com falha; vendedores de 36% a 165% da meta; lotes cheios, equilibrados, abaixo do mínimo e
sem estoque. O 04 é idempotente — pode rodar de novo sem duplicar nada.

## Passo 2 — Subir a API
```powershell
cd api
npm install
Copy-Item .env.example .env      # e edite a senha do MySQL no .env
npm start
```
Teste no navegador: <http://localhost:3001/api/health> deve mostrar `"ok": true`.

## Passo 3 — Subir o painel
Em **outro** terminal:
```powershell
# na raiz do projeto (erp3d)
npm install
Copy-Item .env.example .env      # já aponta para http://localhost:3001
npm run dev
```
Abra <http://localhost:5173>. O painel busca os dados da API automaticamente.

---

## ✥ Painéis arrastáveis
O botão **✥** no topo liga o modo mover: arraste os painéis (KPIs, gráfico, lista inferior, paredes e chat da IA) para onde quiser.
A posição fica salva no `localStorage` do navegador; "Restaurar posições" volta ao padrão.

---

## ✨ Assistente de IA
Botão **Assistente IA** no topo: chat em português que resume a operação, aponta riscos, projeta tendências,
compara itens e **leva a câmera 3D** até a máquina/lote/vendedor citado.

- **Com um provedor de IA** (`AI_PROVIDER` em `api/.env`: **Groq/Llama** e **Gemini** gratuitos, **Claude**, ou **Ollama** local): LLM com *function calling* sobre ferramentas somente-leitura que consultam o MySQL (sem text-to-SQL), com reserva automática entre provedores.
- **Sem chave / sem API / site estático**: usa o **motor de análise local** (estatística + regras, roda no navegador) — nada quebra.
- Se o provedor falhar, o chat avisa e responde com o motor local.
- **Seletor de modelos** (ícone ao lado da caixa de texto): lista provedores/modelos disponíveis, status, cota (limites devolvidos pelo provedor + uso medido) e permite fixar um modelo — ou deixar no *Automático*.
- **Sugestões geradas pela IA** acima da caixa de texto (contextuais à resposta, à aba e ao item selecionado); a fila rola com *arrastar*.

Detalhes, decisões de segurança e roteiro de demo: [`docs/ASSISTENTE_IA.md`](docs/ASSISTENTE_IA.md).

---

## De onde vêm os dados (ordem de busca)
O painel tenta, nesta ordem:
1. **API** — se `VITE_API_URL` estiver definido no `.env` (padrão: `http://localhost:3001`).
2. **`public/data.json`** — um *snapshot* estático (ver abaixo).
3. **Dados de exemplo** embutidos — garante que o painel abre mesmo sem banco.

## Versão estática (para GitHub Pages)
Para publicar sem manter a API no ar, gere um snapshot do banco e builde:
```powershell
cd api
npm run snapshot        # grava ../public/data.json a partir do MySQL
cd ..
# comente VITE_API_URL no .env para o painel usar o data.json
npm run build           # gera dist/ pronto para publicar
```

---

## Observações técnicas (para documentação)
- **Comercial** usa a view `vw_faturamento_pedidos` e a tabela `pedidos_venda`.
  Os **vendedores** foram modelados no banco (tabela `vendedores` + FK em `pedidos_venda`).
- **Estoque** usa a view `vw_saldo_estoque`. Os **lotes de chapas** 3D são os produtos
  da categoria `Chapas`; a ocupação de cada lote = saldo ÷ estoque máximo.
- **Produção** usa `apontamentos_producao` e `ordens_producao`.
- **OEE e status das máquinas** são **estimados** a partir dos apontamentos
  (aprovado ÷ produzido; status inferido pela última data de apontamento).
  Não há sensor de chão de fábrica no banco — isto está documentado de propósito.
