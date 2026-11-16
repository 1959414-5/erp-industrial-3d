# Modelos 3D industriais externos

O ERP Industrial Analytics 3D usa modelos GLB da coleção **Machine Shop and Factory Hall**, publicada por 3DAssets.dev, e uma célula completa de solda robotizada da biblioteca Innerscene.

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
| Empilhadeiras em rota | Counterbalance forklift truck | [27768](https://3dassets.dev/assets/27768) |\n| Células de solda robotizada | Robotic welding cell with positioner, safety fencing and light curtain | [Innerscene](https://www.innerscene.com/tools/library/3d-parts/robotic-welding-cell-with-positioner-safety-fencing-and-ligh-f7235945) |
| Mesas de corte com tocha (plasma/oxicorte) | Profile cutting table | [37945](https://3dassets.dev/assets/37945) |

## Carregamento

Os arquivos GLB são carregados sob demanda pelo `GLTFLoader` do Three.js. Os modelos da 3DAssets.dev vêm do CDN da biblioteca; a célula de solda vem do arquivo GLB disponibilizado pela Innerscene (16,9 MB). O carregador mantém cache por URL. O projeto não copia os binários dos modelos para o repositório.

O código de carregamento fica em `src/industrial-assets.ts`; os pontos de integração ficam em `src/scene.ts`.

## Preservação da aplicação

Esta integração altera somente a camada visual 3D:

- Não modifica o esquema MySQL, consultas, API ou variáveis de conexão.
- Não modifica dados, KPIs, filtros ou indicadores.
- Preserva os grupos raiz, posições e índices usados pela seleção e pelos detalhes dos equipamentos.
- Mantém os modelos procedurais como fallback se o CDN estiver indisponível.
- Aplica uma paleta visual reduzida de grafite, cinza e laranja aos modelos importados.

## Limitações deste primeiro protótipo

A coleção consultada não fornece um modelo específico de cortadora a laser ou plasma. Esses equipamentos permanecem com os modelos procedurais atuais. Os modelos importados são ativos visuais e não representam telemetria, sensores ou estado físico em tempo real. As três máquinas já existentes do tipo `robotWelder` recebem o mesmo modelo de célula, sem criar novos registros ou alterar seus identificadores.


## Corte a laser e plasma

- **Laser:** o modelo atual foi refinado na geometria procedural do projeto para representar uma cortadora fechada, com visor, mesa interna, pórtico e cabeçote móvel. Foi encontrada uma alternativa CC0 da Innerscene em formato STEP, não GLB; ela não é carregada diretamente pelo GLTFLoader e por isso não foi ligada à aplicação nesta etapa. Fonte: https://www.innerscene.com/tools/library/3d-parts/enclosed-laser-cutter-090f353e
- **Plasma:** foi integrado o GLB "Profile cutting table (Shipyard and Dry Dock)", uma mesa CNC aberta de corte com tocha, dimensões de origem 5,35 × 1,76 × 2,90 m, 368 triângulos, clips "open" e "close" e licença CC0 1.0. Fonte: https://3dassets.dev/assets/shipyard-and-dry-dock-shipyard-and-dry-dock-profile-cu-733237ad

A associação com a máquina de plasma é visual. A aplicação só exibirá o modelo quando uma máquina existente vier da API com `type: "plasma"`; nenhum registro, consulta ou dado foi criado ou alterado.

## Célula de solda robotizada

- Modelo completo com robô de seis eixos, tocha MIG, posicionador, peça de trabalho, cercamento de segurança, cortina de luz, painel do operador e armários externos.
- Dimensões de origem: aproximadamente 5,08 × 4,09 × 2,55 m; o modelo é convertido de Z-up para Y-up e ajustado à escala da fábrica.
- Licença declarada na biblioteca: CC0, com uso comercial permitido e sem exigência de atribuição. A página da biblioteca informa disponibilidade do arquivo até 23/10/2029.
- O efeito visual do arco e dos respingos acompanha o status existente da máquina (run). Não é telemetria real nem altera os dados de produção.
- Como o arquivo tem 16,9 MB e é externo, a integração é assíncrona. Se o carregamento falhar, a célula procedural original permanece como fallback.

Fonte do modelo e licença: https://www.innerscene.com/tools/library/3d-parts/robotic-welding-cell-with-positioner-safety-fencing-and-ligh-f7235945

## Mobiliário do setor comercial

O setor comercial mantém as três salas originais (recepção, backoffice e showroom), os dez vendedores, suas rotas de atendimento e os visitantes. A camada visual de mobiliário agora usa modelos GLB da coleção **Downtown Office Interiors** e do pacote **Office Lobby and Building Facilities**, ambos CC0 1.0 Universal.

| Uso no ERP | Modelo | Asset |
|---|---|---|
| Dez estações de trabalho | Office desk 1600 with panel ends | [16964](https://3dassets.dev/assets/downtown-office-interiors-desk-1600-panel-end-9c79542d) |
| Dez cadeiras operacionais | Task chair with mesh back | [16979](https://3dassets.dev/assets/downtown-office-interiors-task-chair-mesh-b69df323) |
| Balcão da recepção e showroom | Curved reception desk | [26133](https://3dassets.dev/assets/office-lobby-and-facilities-reception-desk-curved-83bd6cd6) |
| Sofá de espera | Two-seat soft sofa | [16990](https://3dassets.dev/assets/downtown-office-interiors-sofa-two-seat-692d1b57) |
| Poltronas de espera | Soft lounge armchair | [16988](https://3dassets.dev/assets/downtown-office-interiors-lounge-armchair-f30911e6) |

A substituição é assíncrona e preserva o grupo raiz de cada móvel, os IDs editáveis e a geometria procedural como fallback. Os monitores e suas texturas de dashboard, as pessoas e a animação de atendimento permanecem no projeto.

Fontes dos pacotes e licença: https://3dassets.dev/packs/downtown-office-interiors · https://3dassets.dev/packs/office-lobby-and-facilities
