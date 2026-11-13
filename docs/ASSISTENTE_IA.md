# Assistente de IA do painel — guia técnico e roteiro de entrevista

## Em 30 segundos (o "pitch")
> "Além de mostrar os dados em 3D, o painel tem um **assistente de IA** que responde perguntas em português sobre produção,
> estoque e vendas, aponta riscos, projeta tendências e **leva a câmera 3D até a máquina, o lote ou o vendedor** de que está falando.
> Usei um **LLM com *function calling***: o modelo não escreve SQL nem inventa números — ele escolhe entre ferramentas
> somente-leitura que consultam o MySQL. A camada é **agnóstica de provedor** (gpt-oss via Groq e Gemini no plano gratuito, Claude, ou Ollama local),
> com **reserva automática** e, no fim da cadeia, um **motor de análise local** (estatística + regras) — a demo nunca fica parada."

## O que ele faz
| Capacidade | Exemplo de pergunta | Como é feito |
|---|---|---|
| Resumo e riscos | "resumo executivo", "o que devo fazer hoje?" | Insights automáticos (z-score, médias, regras de negócio) |
| Análise por entidade | "como está a Solda Robotizada 02?", "e a Carla?" | Reconhecimento de entidades + comparação com a média |
| Ranking e filtros | "qual máquina tem mais refugo?", "quem está abaixo da meta?" | Consulta às ferramentas / dataset |
| Reposição de estoque | "sugira uma reposição" | Déficit vs. mínimo + 25% de folga + custo estimado |
| Projeção | "projeção de pedidos" | Regressão linear com faixa (±σ) e confiança (R²) |
| Comparação | "compare Ana e Bruno" | Tabela + gráfico de barras no chat |
| Ação no 3D | "mostre o lote L-003" | A IA devolve uma *ação*; a câmera voa até o objeto e abre o card |
| Contexto da tela | "essa máquina está bem?" (com uma máquina selecionada) | O front envia aba ativa + item selecionado |

Ao abrir o painel ele já mostra um **briefing automático** com os pontos de atenção, cada um com botão "Ver no 3D".

## Arquitetura
```
 Navegador (src/ai.ts)                         API Node (api/ai.js)                    Anthropic
 ┌────────────────────────┐   POST /api/ai/chat   ┌──────────────────────────┐   /v1/messages   ┌─────────┐
 │ chat + contexto da tela│ ───────────────────▶ │ valida • limita • loop   │ ───────────────▶ │ Claude  │
 │ ações → câmera 3D/abas │ ◀─────────────────── │ de tool use (máx. 6)     │ ◀─────────────── │         │
 └───────────┬────────────┘   texto + ações      └──────┬───────────────────┘   tool_use        └─────────┘
             │ sem chave/erro/estático                  │ ferramentas FIXAS e somente-leitura
             ▼                                          ▼
   src/ai-local.ts (offline)                      MySQL (views/tabelas do ERP)
```
- **Modo Claude** (`api/ai.js`): 10 ferramentas — `visao_geral`, `listar_maquinas`, `listar_vendedores`, `listar_lotes`, `serie_temporal`
  (já devolve a projeção calculada), `top_clientes`, `pedidos_por_status`, `historico_maquina` (SQL parametrizado) e as de interface
  `focar_no_3d` e `abrir_aba`.
- **Modo local** (`src/ai-local.ts`): roda no navegador sobre o mesmo `Dataset`. Funciona no GitHub Pages (sem backend) e sem chave.
- O selo no topo do chat mostra qual modo está ativo; cada resposta mostra as ferramentas consultadas e os tokens usados.
- Falhou o Claude (chave inválida, limite, timeout)? O chat avisa e **responde com o motor local** — nunca fica sem resposta.

## Provedores de IA (escolha em `AI_PROVIDER`)
| Provedor | Custo | Modelo padrão | Chave |
|---|---|---|---|
| `groq` | gratuito (com limites) | gpt-oss-120b (a Groq tirou os modelos Llama do plano gratuito) | console.groq.com/keys |
| `gemini` | gratuito (com limites) | Gemini 2.5 Flash | aistudio.google.com/apikey |
| `anthropic` | pago (precisa de crédito) | Claude Sonnet 5.5 | console.anthropic.com |
| `ollama` | gratuito, roda no seu PC | o que você baixar (ex.: llama3.1) | não precisa |

Todos usam as **mesmas ferramentas**. Provedores gratuitos aposentam modelos com frequência: se o modelo configurado sumir, a API lista os modelos disponíveis na sua chave e escolhe outro sozinha (`/api/ai/selftest` mostra a lista). Os planos gratuitos têm limite por minuto/dia — se estourar, o painel tenta o próximo provedor configurado e,
por fim, o motor local. Confira os limites atuais no console de cada provedor. *Fale o nome do modelo que estiver ativo* (o selo do chat mostra).
Obs.: o Gemini no plano gratuito pode usar os prompts para melhorar produtos do Google — não envie dados sensíveis reais.

## Como ativar um provedor (exemplo: Claude)
1. Crie uma chave em <https://console.anthropic.com> (Settings → API keys) e, de preferência, **defina um limite de gasto** lá.
2. Em `api/.env` (copiado de `api/.env.example`) preencha `ANTHROPIC_API_KEY=sk-ant-...`. O `.env` está no `.gitignore` — **nunca** commite.
3. Reinicie a API (`cd api && npm start`) e recarregue o painel. O selo do chat muda para **"<provedor> · modelo · dados do MySQL"**. Diagnóstico: `http://localhost:3001/api/ai/selftest` testa cada provedor e mostra o erro real.
4. O modelo é configurável em `ANTHROPIC_MODEL` (um modelo menor é mais barato/rápido; um maior raciocina melhor).

Sem chave nada quebra: o painel simplesmente usa o motor local.

## Seletor de modelos e cota
O ícone de camadas ao lado da caixa de texto abre a lista **Modelos de IA** (`GET /api/ai/models`):
- **Automático** (padrão): usa o provedor principal e, se ele falhar, cai para o próximo.
- **Modelo fixo**: o painel usa *somente* aquele modelo — se falhar, mostra o erro real do provedor (nada de troca silenciosa). A escolha fica no `localStorage` e é enviada como `provider`/`model` no `POST /api/ai/chat`; o servidor valida o formato e ignora seleção inválida.
- Cada provedor mostra: gratuito/pago, **status** (funcionando, sem crédito, chave inválida…), **cota** e link para o painel do provedor.
- **Sobre "crédito":** nenhum provedor expõe o saldo em dinheiro pela API. A cota exibida vem dos cabeçalhos de limite (`x-ratelimit-*`, `anthropic-ratelimit-*`) devolvidos a cada resposta + contagem de uso medida pelo próprio servidor (perguntas/tokens do dia, teto `AI_DAILY_LIMIT`). Diga isso na entrevista: é uma decisão honesta, não uma limitação escondida.

## Sugestões geradas pela IA
O modelo termina cada resposta com uma linha `SUGESTOES: a | b | c`; o servidor a remove do texto (`splitSuggestions`) e devolve `suggestions[]`, que viram os botões acima da caixa de texto. No motor local, `smartSuggestions()` gera as sugestões a partir dos dados (item selecionado, itens citados na última resposta, alertas, perguntas já feitas). A fila de sugestões rola com o mouse/dedo (arrastar) e com a roda do mouse.

## Decisões de projeto (perguntas prováveis na entrevista)
**Por que *tool use* e não text-to-SQL?**
Deixar o modelo escrever SQL é arriscado (consultas erradas, pesadas, ou até destrutivas) e difícil de auditar. Com *tool use* o conjunto de
operações é **fechado**: o modelo só escolhe a ferramenta e os parâmetros; o SQL é fixo, parametrizado e `SELECT`. Fácil de testar e de explicar.

**Como evita alucinação?**
(1) o prompt de sistema proíbe inventar números e manda usar ferramentas; (2) cálculos pesados (projeção, médias) são feitos em código, não pelo modelo;
(3) a tela mostra quais ferramentas foram consultadas; (4) OEE/status são *estimativas* e o prompt manda dizer isso.

**Segurança?**
Chave só no servidor · SQL fixo e somente leitura · dados do banco tratados como **dados** (defesa contra *prompt injection*: o prompt manda ignorar
ordens vindas das ferramentas) · limite de tamanho de mensagem, de histórico (10), de voltas do laço (6), de requisições por minuto/IP e **teto diário**
(`AI_DAILY_LIMIT`) · CORS restringível (`CORS_ORIGIN`) · o front escapa todo HTML antes de renderizar a resposta.

**Por que ter um motor local se há LLM?**
Disponibilidade e custo: o portfólio publicado no GitHub Pages não tem backend; recrutadores abrem a qualquer hora; e a demo não pode depender de internet/chave.
É o padrão de *graceful degradation*. **Seja transparente:** o motor local é estatística + regras, **não** IA generativa — a parte generativa é o modo Claude.

**Como testou?**
Bateria de ~45 perguntas contra o motor local (corrigindo erros de interpretação), e testes do backend com um servidor Anthropic simulado cobrindo: laço de
múltiplas ferramentas, id inválido, corpo inválido, chave ausente (503), chave inválida (502 → fallback), limite por minuto e teto diário.
*Próximo passo honesto:* um conjunto fixo de perguntas "gabarito" para avaliar respostas automaticamente a cada mudança no prompt.

**Limitações (diga antes que perguntem):**
projeção é regressão linear simples com poucos pontos (o chat mostra R² e avisa); OEE/status de máquina são estimados dos apontamentos (não há sensor; "operando" = apontou até 24 h antes do último apontamento da base, ajustável em `MACHINE_ACTIVE_HOURS`);
a IA só lê dados (não altera nada); memória de conversa curta (últimas 10 mensagens).

## Roteiro de demo (3 minutos)
1. Clique em **✨ Assistente IA** → mostre o **briefing automático** e clique em "Ver no 3D" na máquina com falha (câmera voa até ela).
2. "**qual máquina tem mais refugo?**" → resposta + gráfico de barras + botão para o 3D.
3. Selecione uma máquina no 3D e pergunte "**essa máquina está bem?**" (usa o contexto da tela).
4. Aba Estoque: "**sugira uma reposição**" → lista de compra com custo estimado.
5. Aba Comercial: "**compare os dois melhores vendedores**" e "**projeção de pedidos**" (gráfico com barras listradas = projeção + confiança).
6. Se tiver chave: repita 2 ou 5 e aponte o rodapé da resposta ("🔍 consultou listar_maquinas… · N tokens") — é a prova de que o modelo está usando ferramentas.

## Próximos passos (se perguntarem "e se tivesse mais tempo?")
Respostas em *streaming* · RAG sobre documentos reais (POPs, manuais) · alertas proativos (e-mail/WhatsApp) quando um indicador cruza um limite ·
avaliação automática com perguntas-gabarito · autenticação por usuário e auditoria de perguntas · cache de prompt para reduzir custo.

## Arquivos
- `api/ai.js` — ferramentas, laço de tool use, validação, limites, rotas `/api/ai/chat` e `/api/ai/status`
- `src/ai-local.ts` — motor offline (intenções PT-BR, entidades, estatística, insights, projeção)
- `src/ai.ts` — painel de chat, gráficos, ações (câmera/abas), detecção de modo e fallback
