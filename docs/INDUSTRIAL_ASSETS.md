# Modelos 3D industriais externos

O ERP Industrial Analytics 3D usa alguns modelos GLB da coleção **Machine Shop and Factory Hall**, publicada por 3DAssets.dev.

Fonte: https://3dassets.dev/packs/machine-shop-and-factory-hall

A página da coleção informa licença **CC0 1.0 Universal** para os modelos deste pacote. A coleção também informa que os modelos foram gerados com apoio de IA. A atribuição não é exigida pela CC0, mas mantemos esta referência para transparência e rastreabilidade.

## Modelos utilizados no protótipo

| Uso no ERP | Modelo da biblioteca | Asset |
|---|---|---|
| Centros de usinagem CNC | CNC machining centre | [27732](https://3dassets.dev/assets/27732) |
| Dobradeiras CNC | Press brake | [27731](https://3dassets.dev/assets/27731) |
| Serra de fita | Horizontal bandsaw | [27726](https://3dassets.dev/assets/27726) |
| Porta-paletes do estoque | Pallet racking bay | [27757](https://3dassets.dev/assets/27757) |
| Estantes de chapas | Sheet metal storage rack | [27761](https://3dassets.dev/assets/27761) |
| Empilhadeiras em rota | Counterbalance forklift truck | [27768](https://3dassets.dev/assets/27768) |
| Mesas de corte com tocha (plasma/oxicorte) | Profile cutting table | [37945](https://3dassets.dev/assets/37945) |

## Carregamento

Os arquivos GLB são carregados sob demanda pelo `GLTFLoader` do Three.js, a partir do CDN da biblioteca. O navegador pode armazenar os arquivos em cache. O projeto não copia os binários dos modelos para o repositório.

O código de carregamento fica em `src/industrial-assets.ts`; os pontos de integração ficam em `src/scene.ts`.

## Preservação da aplicação

Esta integração altera somente a camada visual 3D:

- Não modifica o esquema MySQL, consultas, API ou variáveis de conexão.
- Não modifica dados, KPIs, filtros ou indicadores.
- Preserva os grupos raiz, posições e índices usados pela seleção e pelos detalhes dos equipamentos.
- Mantém os modelos procedurais como fallback se o CDN estiver indisponível.
- Aplica uma paleta visual reduzida de grafite, cinza e laranja aos modelos importados.

## Limitações deste primeiro protótipo

A coleção consultada não fornece um modelo específico de cortadora a laser ou plasma. Esses equipamentos permanecem com os modelos procedurais atuais. Os modelos importados são ativos visuais e não representam telemetria, sensores ou estado físico em tempo real.


## Corte a laser e plasma

- **Laser:** o modelo atual foi refinado na geometria procedural do projeto para representar uma cortadora fechada, com visor, mesa interna, pórtico e cabeçote móvel. Foi encontrada uma alternativa CC0 da Innerscene em formato STEP, não GLB; ela não é carregada diretamente pelo GLTFLoader e por isso não foi ligada à aplicação nesta etapa. Fonte: https://www.innerscene.com/tools/library/3d-parts/enclosed-laser-cutter-090f353e
- **Plasma:** foi integrado o GLB "Profile cutting table (Shipyard and Dry Dock)", uma mesa CNC aberta de corte com tocha, dimensões de origem 5,35 × 1,76 × 2,90 m, 368 triângulos, clips "open" e "close" e licença CC0 1.0. Fonte: https://3dassets.dev/assets/shipyard-and-dry-dock-shipyard-and-dry-dock-profile-cu-733237ad

A associação com a máquina de plasma é visual. A aplicação só exibirá o modelo quando uma máquina existente vier da API com `type: "plasma"`; nenhum registro, consulta ou dado foi criado ou alterado.
