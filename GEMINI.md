# CONHECIMENTO CANÔNICO DO PROJETO — SISTEMA DE ENTREGAS REAIS (DELIVERY BOY PATOS DE MINAS - MG)

Este documento consolida as decisões, correções e comportamentos descobertos durante os testes do jogo.
A partir de agora, estas regras devem ser consideradas parte da arquitetura CANÔNICA do projeto.

O objetivo do jogo é representar a experiência de um motoboy recebendo solicitações de entrega, visualizando coleta e destino no mapa real e realizando as entregas pela rede viária real.

============================================================
1. PRINCÍPIO FUNDAMENTAL DO PROJETO
============================================================

O jogo possui quatro conceitos diferentes que NÃO devem ser misturados:

MAPA → mostra a cidade real.
CÂMERA → é controlada livremente pelo usuário.
ROTA → determina por quais ruas a moto deve andar.
ENTREGA → determina qual é o objetivo atual da moto.

Esses sistemas devem ser independentes.
Uma ação sobre um deles não deve alterar os outros indevidamente.

============================================================
2. MAPA REAL
============================================================

Utilizar mapa real baseado em OpenStreetMap/Leaflet.
As ruas são reais.
O roteamento utiliza a rede viária real através do OSRM.
A moto deve permanecer sobre as ruas.
Não utilizar movimento livre sobre casas, quarteirões ou áreas sem vias.
O estabelecimento é um POI geográfico.
A moto é um veículo que circula pela rede viária.
Esses dois objetos possuem comportamentos diferentes.

============================================================
3. CÂMERA É INDEPENDENTE DA MOTO
============================================================

A câmera NÃO deve ficar permanentemente presa à moto.
Quando o AUTO FOLLOW estiver ativo:
→ a câmera acompanha a moto.

Quando o usuário pressionar, segurar e arrastar o mapa:
→ o AUTO FOLLOW deve ser desativado temporariamente;
→ a câmera passa a ser livre;
→ a moto continua sua movimentação normalmente.

O usuário pode explorar qualquer região do mapa enquanto a moto está andando.
Isso inclui: arrastar, zoom in, zoom out, observar regiões fora da rota, procurar pontos de referência, explorar bairros.
A moto NÃO deve parar porque a câmera foi movimentada.

============================================================
4. BOTÃO CENTRALIZAR
============================================================

Existe um botão de centralização da câmera (◎).
Quando clicado:
→ centralizar novamente na moto;
→ reativar AUTO FOLLOW.

Centralizar a câmera NÃO altera rota, destino, velocidade ou estado da entrega.

============================================================
5. CLIQUE NO MAPA NÃO É DESTINO
============================================================

REGRA DEFINITIVA: Clicar em qualquer ponto do mapa NÃO cria uma nova rota para a moto.
Nunca fazer: CLIQUE NO MAPA → mandar moto para aquele ponto.
O clique pode ser usado pela interface/mapa, mas nunca deve virar automaticamente um destino de navegação.
ARRASTAR MAPA → somente câmera.
ZOOM → somente câmera.
CLIQUE ALEATÓRIO → não alterar rota.
A única coisa que pode alterar o destino da moto é uma mudança legítima no estado da entrega.

============================================================
6. ROTA PROTEGIDA
============================================================

Quando existir uma entrega ativa, a rota da entrega fica protegida.
Exemplo: A moto está indo para Rua Joaquim Vida, 147.
Então: clicar no mapa NÃO muda o destino; arrastar NÃO muda o destino; zoom NÃO muda o destino; mover a câmera NÃO muda o destino.
A moto continua seguindo: 🛵 → Rua Joaquim Vida, 147.
A câmera pode estar mostrando qualquer outra região da cidade.
IMPORTANTE: ROTA PROTEGIDA NÃO SIGNIFICA CÂMERA PRESA. São sistemas independentes.

============================================================
7. VELOCIDADE DA MOTO
============================================================

O jogo deve ter gameplay DINÂMICO.
A velocidade inicial da moto é: 60 km/h.
A moto deve desenvolver velocidade. Não reduzir automaticamente nas esquinas. Não reduzir automaticamente em curvas. Não frear artificialmente em cada mudança de direção.
A velocidade deve ser controlada pelo jogador através de: [-] velocidade [+].
O jogador decide a velocidade. A rota determina POR ONDE a moto anda. A velocidade determina QUÃO RÁPIDO ela percorre a rota. Esses sistemas são independentes.

============================================================
8. LIMPEZA VISUAL DO MAPA
============================================================

Remover elementos antigos de gameplay que não fazem mais parte do conceito atual.
NÃO mostrar: ícones genéricos de comida, engrenagens, fome, hidratação, necessidades genéricas, marcadores decorativos sem função de entrega.
O mapa deve ser visualmente limpo.
Os elementos principais devem ser: 🛵 moto, 🏪 estabelecimentos, 📦 solicitações, 📍 destinos, 🛣️ ruas, 🗺️ mapa, 🟡 rotas de entrega quando aplicável.

============================================================
9. ESTABELECIMENTOS
============================================================

Estabelecimentos são POIs reais.
Cada estabelecimento pode possuir: nome, endereço, latitude, longitude.
O estabelecimento deve aparecer na posição geográfica correspondente.
Não mover artificialmente o estabelecimento para a rua apenas para facilitar a visualização.
A moto circula na rua. O estabelecimento pode estar dentro do quarteirão.
Não alterar coordenadas reais apenas para evitar sobreposição.

============================================================
10. NÃO INVENTAR LOCALIZAÇÃO
============================================================

REGRA ABSOLUTA: Nunca inventar latitude/longitude.
Nunca colocar um endereço no centro do bairro, em uma posição aleatória, em um ponto aproximado, em outro endereço próximo ou usando a coordenada da entrega anterior.
Se o endereço não puder ser localizado com confiança: não inventar; informar que a localização não foi encontrada; manter o endereço textual; marcar como pendente de geocodificação.
Precisão geográfica é mais importante do que simplesmente colocar um marcador em algum lugar.

============================================================
11. GEOLOCALIZAÇÃO DE ENDEREÇOS
============================================================

Quando uma solicitação nova apresentar um endereço:
1. separar os rótulos do endereço; 2. extrair rua/avenida; 3. número; 4. complemento; 5. bairro; 6. cidade; 7. estado; 8. procurar a localização real; 9. obter latitude; 10. obter longitude; 11. utilizar essas coordenadas no mapa.
Pode utilizar uma fonte de mapas/geocodificação adequada (Gazetteer + Nominatim OSM API) para encontrar a posição real.
O Google Maps pode ser usado como referência de conferência da localização quando necessário.
Não usar somente o bairro. Exemplo: "Rua Avelino Pereira Caixeta, 496, Bairro Gramado" não significa colocar o marcador no centro do bairro Gramado. É necessário procurar o endereço específico.

============================================================
12. RÓTULOS NÃO FAZEM PARTE DO ENDEREÇO
============================================================

Palavras como: Retirar:, Retirada:, Retire:, Coleta:, Coletar:, Buscar: são rótulos semânticos. Não fazem parte do endereço.
Da mesma maneira: Entregar:, Entrega:, Destino:, Levar: são rótulos semânticos.
Exemplo: "Retirar: Rua Vereador João Pacheco, 2352 - Bairro Cristo Redentor" deve ser interpretado como: TIPO = COLETA, ENDEREÇO = Rua Vereador João Pacheco, 2352 - Bairro Cristo Redentor.
Nunca enviar "Retirar: Rua Vereador João Pacheco..." como se fosse o endereço completo para geocodificação.

============================================================
13. COLETA ≠ DESTINO
============================================================

O interpretador deve distinguir claramente COLETA / RETIRADA de ENTREGA / DESTINO.
Exemplo: RETIRADA: Rua Olegário Maciel, 229, Centro / ENTREGAR: Rua Avelino Pereira Caixeta, 496, Gramado.
Resultado: 🏪 COLETA (Rua Olegário Maciel, 229) ➔ 📍 DESTINO (Rua Avelino Pereira Caixeta, 496).
Nunca inverter os dois. A ordem em que os endereços aparecem não é suficiente para determinar sua função. Os rótulos e o contexto devem ser analisados.

============================================================
14. INTERPRETAÇÃO DE MENSAGENS REAIS
============================================================

As mensagens de grupos não possuem formato padronizado. O interpretador deve trabalhar com linguagem natural sem exigir formato rígido.

============================================================
15. MENSAGENS MÚLTIPLAS DEVEM SER AGRUPADAS
============================================================

Uma solicitação pode ser construída por várias mensagens consecutivas (ex: Rei da Batata). O sistema deve compreender o contexto e atualizar a solicitação existente quando uma mensagem posterior claramente complementar ou corrigir a anterior.

============================================================
16. CORREÇÕES POSTERIORES
============================================================

Se uma mensagem posterior disser "foi mal não enviou o de retirar" e fornecer "Retirar Rua Alaor de Mello Ribeiro 225", isso é uma CORREÇÃO/COMPLEMENTO da solicitação. Atualizar a solicitação correspondente.

============================================================
17. UMA COLETA PODE TER VÁRIOS DESTINOS
============================================================

Exemplo Rei da Batata: Coleta na Rua Alaor de Mello Ribeiro, 225 ➔ Destino 1 (Rua Orquídeas 400) + Destino 2 (Rua Osvaldo Amaro Teixeira). Representar como 🏪 COLETA ├── 📍 DESTINO 1 e └── 📍 DESTINO 2.

============================================================
18. "RECEBER 100" É DIFERENTE DA TAXA
============================================================

Separar delivery_fee (ex: R$ 20,00) de cash_to_collect (ex: R$ 100,00 a receber do cliente).

============================================================
19. SOLICITAÇÃO DE ENTREGA
============================================================

Toda nova solicitação deve ser uma entidade independente: DELIVERY_REQUEST com id único, texto original, estabelecimento, origem/coleta (lat/lon), destinos (lat/lon), taxa, valor a receber, urgência, tipo, status e timestamp.

============================================================
20. MESMO ESTABELECIMENTO NÃO SIGNIFICA MESMA ENTREGA
============================================================

REGRA FUNDAMENTAL: MESMO ESTABELECIMENTO ≠ MESMA ENTREGA.
Exemplo: Entrega 001 (King Adega ➔ Rua Joaquim Vida 147 | R$ 12) vs Entrega 002 (King Adega ➔ Rua Lindolfo Queiroz de Melo 116 | R$ 11). São solicitações independentes. Cada nova solicitação deve receber um ID próprio.

============================================================
21. NOVA MENSAGEM SEMPRE USA O TEXTO ATUAL
============================================================

O botão [ SIMULAR MENSAGEM ] deve sempre ler o conteúdo atual do campo de texto no momento do clique. Não usar texto hardcoded, King Adega ou última simulação como fallback.

============================================================
22. KING ADEGA NÃO É REGRA DO SISTEMA
============================================================

A King Adega foi usada como caso de teste. Ela NÃO é estabelecimento ou coordenada padrão do sistema.

============================================================
23. SIMULAR MENSAGEM DEVE GERAR ENTREGA DISPONÍVEL
============================================================

A mensagem simulada cria uma DELIVERY_REQUEST real no sistema com status DISPONÍVEL e card de prévia.

============================================================
24. CARD DA ENTREGA
============================================================

O card é uma área interativa contínua. Não fechar no mouseout imediato do ícone da empresa, permitindo ao usuário mover o mouse até o card e clicar em [ ACEITAR ENTREGA ].

============================================================
25. CARD DA ENTREGA DISPONÍVEL
============================================================

O card deve mostrar os dados exatos da SOLICITAÇÃO CORRENTE.

============================================================
26. ESTADO DA ENTREGA (MÁQUINA DE 8 ESTADOS)
============================================================

DISPONÍVEL ➔ ACEITA ➔ A CAMINHO DA COLETA ➔ CHEGOU À COLETA ➔ COLETADA / NA BAG ➔ A CAMINHO DO DESTINO ➔ CHEGOU AO DESTINO ➔ ENTREGUE / CONCLUÍDA.

============================================================
27. ACEITAR NÃO SIGNIFICA CONCLUIR
============================================================

Clicar em [ ACEITAR ENTREGA ] altera o estado para A CAMINHO DA COLETA. O objetivo da moto passa a ser a coleta.

============================================================
28. CHEGAR À COLETA NÃO CONCLUI A ENTREGA
============================================================

Ao chegar na coleta, exibe o prompt [ COLETAR PEDIDO ]. Somente após o clique o pedido entra na BAG.

============================================================
29. BAG
============================================================

Após coletar: 📦 NA BAG. O objetivo passa a ser o DESTINO.

============================================================
30. APÓS COLETAR, O DESTINO MUDA
============================================================

Antes da coleta: 🛵 ➔ COLETA. Depois de coletar: 🛵 ➔ DESTINO.

============================================================
31. ENTREGA SÓ É CONCLUÍDA NO DESTINO
============================================================

Somente após chegar ao destino e clicar em [ ENTREGAR PEDIDO ] a entrega é concluída e os valores são creditados.

============================================================
32. ROTA DA ENTREGA
============================================================

A rota representa o objetivo ativo (Coleta antes de coletar; Destino após coletar).

============================================================
33. ROTA PONTILHADA
============================================================

A prévia exibe polilinha pontilhada dourada. Após o aceite, a rota relevante vira polilinha verde ativa.

============================================================
34. IMPORTAÇÃO DE NOVAS SOLICITAÇÕES
============================================================

Separação entre Fonte da Mensagem e Sistema de Entrega: MENSAGEM ➔ INTERPRETADOR ➔ DELIVERY_REQUEST ➔ GEOLOCALIZAÇÃO ➔ MAPA.

============================================================
35. NÃO IMPLEMENTAR LÓGICA DE PROXIMIDADE AUTOMÁTICA NESTA FASE
============================================================

Sem match automático ou seleção forçada. A solicitação aparece no mapa e fica disponível.

============================================================
36. TESTES CANÔNICOS DE INTERPRETAÇÃO
============================================================

TESTE A (King Adega x Ipanema II | R$ 11) | TESTE B (Rei da Batata Múltiplos Destinos) | TESTE C (Mesmo Estabelecimento Nova Entrega R$ 11).

============================================================
37. TESTES DE GEOLOCALIZAÇÃO
============================================================

Procurar endereço completo, obter lat/lon reais, nunca inventar coordenadas.

============================================================
38. TESTES DE CÂMERA E ROTA
============================================================

Pan, Zoom e recentralização não alteram a rota protegida da moto.

============================================================
39. TESTES DE VELOCIDADE
============================================================

Pilotagem a 60 km/h sem reduções artificiais em curvas.

============================================================
40. REGRA DE NÃO REGRESSÃO
============================================================

Novas funcionalidades jamais podem quebrar funcionalidades anteriores. Testar obrigatoriamente no navegador real.

============================================================
41. REGRA DE ALTERAÇÕES
============================================================

Identificar a causa raiz, aplicar a menor alteração possível e validar o funcionamento antes de avançar.

============================================================
42. PRINCÍPIO FINAL DO PROJETO
============================================================

🗺️ MAPA REAL + 🏪 ESTABELECIMENTOS REAIS + 📦 SOLICITAÇÕES REAIS + 📍 DESTINOS REAIS + 🛵 MOTO + 🛣️ ROTAS REAIS.

ARQUITETURA CANÔNICA RESUMIDA:
MENSAGEM ➔ INTERPRETADOR ➔ AGRUPAMENTO/CONTEXTO ➔ DELIVERY_REQUEST NOVO ➔ VALIDAÇÃO ➔ GEOLOCALIZAÇÃO REAL ➔ COLETA + DESTINO(S) ➔ MAPA ➔ ENTREGA DISPONÍVEL ➔ CARD ➔ ACEITAR ➔ COLETA ➔ BAG ➔ DESTINO ➔ ENTREGA ➔ CONCLUSÃO.

============================================================
SYSTEM_SPEC DSL & CORE INVARIANTS
============================================================

SYSTEM_SPEC {
    PROJECT: "DeliveryBoy AI"
    DOMAIN: "Motorcycle delivery game"
    LANGUAGE: "pt-BR"

    ARCHITECTURE {
        MAP: "Leaflet + OpenStreetMap"
        ROUTING: "OSRM"
        VEHICLE: "motorcycle"
        DELIVERY_MODEL: "DELIVERY_REQUEST"
        ACTIVE_DELIVERY: "activeDeliveryRequest"
    }

    CORE_INVARIANTS {
        INVARIANT_001: MAP != CAMERA != ROUTE != DELIVERY
        INVARIANT_002: CAMERA_ACTION MUST NOT MODIFY ROUTE
        INVARIANT_003: MAP_CLICK MUST NOT CREATE_ROUTE
        INVARIANT_004: ACTIVE_DELIVERY_REQUEST IS THE SINGLE SOURCE OF TRUTH FOR UI, BAG, ROUTE & STATUS
        INVARIANT_005: OLD_DELIVERY_DATA MUST NEVER BE USED AS FALLBACK FOR A NEW DELIVERY_REQUEST
        INVARIANT_006: SAME_ESTABLISHMENT != SAME_DELIVERY
        INVARIANT_007: EVERY NEW DELIVERY_REQUEST MUST HAVE A UNIQUE ID
        INVARIANT_008: UNKNOWN_COORDINATES MUST NEVER BE INVENTED
        INVARIANT_009: ADDRESS_LABELS ARE NOT PART OF THE ADDRESS STRING
        INVARIANT_010: DELIVERY_STATE DETERMINES VEHICLE_TARGET
    }

    HARD_RULES {
        RULE_001: NO HARDCODED DELIVERY DATA IN ACTIVE UI.
        RULE_002: NO INVENTED COORDINATES.
        RULE_003: NO MAP CLICK DESTINATION.
        RULE_004: NO AUTOMATIC CURVE SLOWDOWN.
        RULE_005: NO REUSE OF PREVIOUS DELIVERY DATA.
        RULE_006: SAME ESTABLISHMENT DOES NOT IDENTIFY SAME DELIVERY.
        RULE_007: NEW MESSAGE -> PROCESS CURRENT TEXT.
        RULE_008: ACTIVE DELIVERY -> SINGLE SOURCE OF TRUTH.
        RULE_009: CAMERA IS INDEPENDENT FROM ROUTE.
        RULE_010: ROUTE IS DETERMINED BY DELIVERY STATE.
        RULE_011: PICKUP != DESTINATION.
        RULE_012: LABELS ARE NOT ADDRESS CONTENT.
        RULE_013: UNKNOWN GEOLOCATION -> PENDING, NEVER INVENT.
        RULE_014: NEW DELIVERY -> UNIQUE ID.
        RULE_015: UI MUST REPRESENT THE SAME DELIVERY THAT THE MOTORCYCLE IS CURRENTLY EXECUTING.
    }
}

---

## 25. CORREÇÃO DE VAZAMENTO DE MARCADOR ANTIGO (BUG STALE_DESTINATION_MARKER_LEAK)
- **Eliminação de Fallbacks Textuais**: Proibido usar fallbacks de string como `'Rua Avelino Pereira Caixeta'` em `destAddr`. Se o destino não puder ser extraído com precisão, a geocodificação é marcada como `confidence: "low"` e pendente, sem invenção ou vazamento de dados.
- **Transição de Seções no Parser**: Uma vez identificada a Coleta, a próxima linha contendo logradouro/número é atribuída automaticamente ao Destino, independente da presença da palavra "Entregar:".
- **Isolamento por deliveryRequestId**: Todos os marcadores contêm `deliveryRequestId`. A rota ativa valida estritamente `ASSERT(marker.deliveryRequestId === activeDeliveryRequest.id)`.

---

## 26. PARSER ESTRUTURAL DE LOGRADOUROS BRASILEIROS (BUG STREET_TYPE_NORMALIZATION_FAILURE)
- **Normalização Universal de Vias**: O parser reconhece estruturalmente todos os tipos de vias brasileiras (`Rua`, `R.`, `Avenida`, `Av.`, `Alameda`, `Al.`, `Travessa`, `Tv.`, `Praça`, `Pç.`, `Estrada`, `Rodovia`, `Condomínio`, etc.). Proibido presumir que toda via é uma "Rua".
- **Decomposição Gramatical**: Extração independente de `streetType`, `streetName`, `number`, `reference` (`frente ao SESI`) e `neighborhood` (`Novo Sorriso`).
- **Validação de Referência**: A referência (ex: `frente ao SESI`) é preservada para orientação, mas não substitui ou polui o nome da via na geocodificação.

---

## 27. TOLERÂNCIA A NORMAS IMPLÍCITAS E ERROS DE DIGITAÇÃO (FUZZY STREET MATCHING)
- **Logradouros Implícitos**: O parser reconhece nomes de vias de Patos de Minas mesmo quando o prefixo "Rua" ou "Avenida" for omisso pelo usuário (ex: `Edson nunes de paula 763` ➔ `Rua Edson Nunes de Paula, 763`).
- **Fuzzy Matching de Erros de Digitação**: Erros de digitação comuns (ex: `major gotr` ➔ `Av. Major Gote`) são tolerados e corrigidos automaticamente na busca geográfica.

---

## 28. GARANTIA UNIVERSAL DE SIMULAÇÃO DE ENTREGAS
- **Criação Incondicional de Delivery Request**: Nenhuma mensagem colada no simulador de grupo pode ser descartada ou bloqueada. Toda mensagem gera obrigatoriamente um objeto `DELIVERY_REQUEST` no jogo.
- **Geocodificação Multi-pass Resiliente**: Se a busca remota estrita falhar ou atrasar, utiliza o fallback geográfico dentro de Patos de Minas - MG, posicionando os marcadores de Coleta e Destino na rede viária real para permitir a jogabilidade imediata.

---

## 29. COLETA IMPLÍCITA POR NOME DE EMPRESA E TRANSFERÊNCIA DE FILIAIS (QUITANDARÉ LOJA 1 X LOJA 2)
- **Mensagem com 1 Endereço + Nome de Loja**: Se a mensagem contiver o nome de um estabelecimento comercial (ex: `Quitandaré`, `King Adega`, `Rei da Batata`) e apenas 1 endereço de rua, a Coleta 🏪 é atribuída à matriz da empresa e o endereço torna-se o Destino 📍.
- **Transferência entre Filiais**: Se a mensagem solicitar `Loja 2` ou `Filial 2`, Coleta 🏪 = `[Empresa] Loja 1` e Destino 📍 = `[Empresa] Loja 2`.

---

## 30. GEOLOCALIZAÇÃO EXATA POR BAIRRO DE PATOS DE MINAS - MG (IPANEMA X CORAÇÃO EUCARÍSTICO)
- **Geocodificação por Delimitação de Bairro**: Se a mensagem contiver apenas nomes de bairros para Coleta ou Entrega (ex: `Retirar Ipanema`, `Entregar Coração Eucarístico`), o marcador DEVE ser posicionado estritamente dentro dos limites geográficos do bairro correspondente em Patos de Minas - MG (Ipanema: `-18.622724, -46.508517`, Coração Eucarístico: `-18.564148, -46.548026`).
- **Açaí Du Pato**: Empresa cadastrada no Bairro Ipanema em Patos de Minas - MG.

---

## 31. DINAMIZAÇÃO UNIVERSAL DE DADOS DA ENTREGA ATIVA (ELIMINAÇÃO DE STRINGS HARDCODED)
- **Instância Ativa É a Fonte Única de Verdade**: Proibido usar fallbacks estáticos ou textos fixos como "King Adega", "Avelino Pereira Caixeta" ou "Joaquim Vida, 147" na interface.
- **Botões e Modais Dinâmicos**: O botão de aceite DEVE exibir `IR À ${shopName.toUpperCase()} (COLETA)`. O modal de chegada à coleta e ao destino DEVE exibir o nome exato e o endereço da solicitação corrente.

---

## 32. GARANTIA UNIVERSAL DE MARCAÇÃO NO MAPA E FOCO DE CÂMERA
- **Sanitização Estrita de Preços**: Remover padrões de moeda e taxas (ex: `R$9`, `R$ 14`, `10 reais`) das strings de endereço enviadas para geocodificação.
- **Ativação Completa do Marcador POI**: Todo novo local de coleta gerado por simulação recebe `hasDelivery = true`, `icon = '🏪'`, `color = '#a855f7'` e `address = pickupGeo.address`.
- **Enquadramento Automático da Câmera**: Ao simular uma entrega, executar obrigatoriamente `map.fitBounds` para enquadrar a Coleta 🏪 e o Destino 📍 na tela.

---

## 33. INTEGRIDADE DO CARD DE PRÉVIA E MARCADOR DE DESTINO
- **Declaração Estrita de Seletores em showDeliveryPreview**: O método `showDeliveryPreview` DEVE declarar `acceptBtn`, `cardHeaderBadge`, `shopNameEl`, `shopAddrEl`, `destAddrEl`, `priceEl`, `distEl`, `timeEl` e `typeEl` antes de qualquer manipulação do DOM.
- **Renderização do Destino**: O marcador 📍 e o card flutuante de prévia DEVEM ser exibidos obrigatoriamente sem exceções ao simular uma mensagem.

---

## 34. ISOLAMENTO ESTRUTURAL ABSOLUTO DE POIs E ENTREGAS (REGRA DE ZERO REGRESSÃO)
- **Instância Única por Solicitação**: Toda nova mensagem simulada gera obrigatoriamente um objeto POI isolado em `REAL_LANDMARKS` com ID único `LM_Timestamp`.
- **Interação por Clique e Touch**: Clicar em qualquer POI marcado com `hasDelivery = true` DEVE acionar `showDeliveryPreview(lm)` no card flutuante, nunca iniciar rota direta sem aceite do jogador.

---

## 35. SÍNTESE DE ÁUDIO VIA WEB AUDIO API (SOM SINTETIZADO SEM ARQUIVOS EXTERNOS)
- **SoundEngine Autônomo**: O sistema utiliza a `Web Audio API` para sintetizar todos os efeitos sonoros do jogo em tempo real (ronco da moto, buzina, barulho de moedas ao concluir entrega, efeito de coleta).
- **Sem Dependência Externa de MP3/WAV**: Nenhum efeito sonoro depende de arquivos de áudio externos, evitando falhas de carregamento ou bloqueios de CORS/autoplay.
- **AudioContext Dinâmico**: O contexto de áudio é inicializado ou reativado no primeiro clique/interação do usuário.

---

## 36. SINCRO DA MÁQUINA DE ESTADOS E LOG DE ATIVIDADES
- **Feedback Audiovisual nas Transições**: Todas as mudanças no estado da entrega (`DISPONIVEL` ➔ `A_CAMINHO_DA_COLETA` ➔ `CHEGOU_NA_COLETA` ➔ `COLETADA` ➔ `A_CAMINHO_DO_DESTINO` ➔ `CHEGOU_NO_DESTINO` ➔ `ENTREGUE`) emitem feedback sonoro característico e alimentam o feed do log de bordo (`addLog`).
- **Garantia do Fluxo de Caixa**: Ao concluir uma entrega no estado `ENTREGUE`, os valores de taxa (`delivery_fee`) e cobrança (`cash_to_collect`) são creditados dinamicamente no saldo do jogador.

---

## 37. REGRA DE OURO DE MANUTENÇÃO CANÔNICA
- **Invariância do Documento GEMINI.md**: Este documento é o guia definitivo de regras e comportamento do projeto. Todas as novas funcionalidades ou refatorações DEVEM respeitar rigorosamente os 10 Princípios Universais, as 15 Hard Rules e as regras 1 a 37.

