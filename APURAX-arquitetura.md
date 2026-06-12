## Minha recomendação (o que eu acho do Apurax)

**Veredito: a ideia é boa, o timing é raro, e a arquitetura está certa — mas o produto que vende não é "IA fiscal", é "máquina de recuperar crédito auditável que usa IA onde a IA é boa".** Trate isso como posicionamento inegociável, não como detalhe de marketing.

**Por que a IA NÃO calcula o imposto — e por que essa é a decisão mais acertada do projeto.** São quatro razões que se reforçam:

1. **Auditabilidade.** Todo `valorCredito` precisa responder, perante o Fisco e perante o cliente, à pergunta "de onde saiu esse número?". A resposta válida é "regra R-ICMS-014, LC 87/96 art. 20, vigência X, homologado por fulano". A resposta "o modelo estimou" não sobrevive a uma fiscalização. Um LLM não tem base legal citável como *causa* do número — só como narrativa *a posteriori*.
2. **Reprodutibilidade.** Recalcular a mesma NF-e em junho e em dezembro tem de dar o centavo idêntico. LLM é estocástico por construção; o motor é uma função pura `(item, regra, vigência) → valor`. Crédito tributário é matéria de centavos e de períodos fechados — não admite variância.
3. **Alucinação.** Um modelo que inventa um inciso ou aplica alíquota de outra UF gera crédito indevido, e crédito indevido é **glosa + multa + juros**, com o cliente (e potencialmente o Apurax) na linha de tiro. O custo de um erro aqui não é "resposta ruim", é passivo fiscal.
4. **Responsabilidade.** O `homologadoPor`/`homologadoEm` da trilha existe porque alguém — um contador, um humano com CRC — **assume** o número. A IA não pode assumir responsabilidade fiscal. O desenho com human-in-the-loop transforma a IA em assistente, não em emissor, e isso é o que torna o produto juridicamente defensável.

**O que a IA faz de fato valioso (e que o motor sozinho não faz).** A IA resolve o problema *linguístico e de contexto* que precede o cálculo: ler "PARAFUSO SEXTAVADO M8 AÇO INOX" e suspeitar do NCM; cruzar `xProd` com o CST informado e gritar quando um insumo veio com CST de PIS/COFINS que veda crédito (04/05/06/70-75); enquadrar a zona cinzenta do **Tema 779 (REsp 1.221.170/PR)** — essencialidade/relevância — que é argumentativa por natureza; ler DANFE em PDF quando não há XML; e explicar, com fonte RAG, *por que* um item não creditou. Isso é trabalho que hoje custa horas de contador por lote e que escala mal manualmente. A IA é o **detector de oportunidade e de erro**; o motor é o **caixa registrador auditável**. Essa divisão é a tese do produto.

**A maior alavanca de valor é o dual-regime na transição — e não por acaso.** Em 2026-2032 toda empresa vai conviver com dois mundos de crédito sobre a mesma nota: o **físico restrito** (ICMS/PIS/COFINS, onde CFOP 1556 uso/consumo *não* credita até 2033) e o **financeiro amplo** da CBS/IBS (LC 214/2025, art. 47, onde a mesma aquisição *passa* a creditar se vinculada à atividade). O Apurax que mostra o **delta de oportunidade** — "você captura R$ X hoje, capturaria R$ Y sob o novo modelo, e aqui está o que muda" — vende algo que nenhum ERP entrega e que nenhum contador consegue fazer à mão em escala. É uma janela de 6 anos com prazo de validade, o que cria urgência comercial real. Some a isso a urgência regulatória: a **EFD-Contribuições congela em jan/2027** (NT 011/2026), então mapear crédito de PIS/COFINS sobre o passado decadencial de 5 anos é uma corrida que termina em ~6 meses. Isso é uma campanha de vendas pronta.

**A escolha de regime do cliente é um divisor que precisa estar na primeira tela do onboarding.** Não é detalhe de cadastro — é o roteador do produto. **Lucro Real (não-cumulativo) tem crédito de PIS/COFINS; Presumido (cumulativo) e Simples NÃO têm** (Leis 10.637/02 e 10.833/03; LC 123/2006). Calcular crédito de PIS/COFINS para um cliente Presumido não é otimização, é erro grosseiro que destrói credibilidade. O motor tem de **bloquear a frente de PIS/COFINS por regime antes de processar qualquer XML**, e a UI deve marcar essas telas como "não aplicável". Cuidado com as duas armadilhas: atividade mista (rateio) e a confusão clássica — fornecedor do Simples **gera** crédito básico de PIS/COFINS para o adquirente não-cumulativo (ADI RFB 15/2007); a vedação é para PF e para produto não tributado, não para o Simples.

**A custódia de certificado é o risco mais real e mais subestimado.** Não há "API REST de baixar notas" — toda automação séria passa por SOAP + certificado + estado por NSU na Distribuição DFe. Isso significa: (a) você vai custodiar chave privada de terceiros, o que é responsabilidade de segurança de nível bancário (envelope encryption, KMS, chave em claro só em memória do worker, trilha de cada uso); (b) A3 não-exportável quebra o SaaS puro e exige agente local/HSM; (c) a manifestação do destinatário para baixar o XML completo é **ação fiscal em nome do cliente** — precisa de consentimento explícito e auditoria. E há o rate-limit operacional não-negociável: cStat 137 → esperar 1h ou tomar rejeição 656 e bloqueio do CNPJ. **Não subestime isto: é onde o projeto pode travar por meses.** Recomendação franca: certificado NÃO entra no MVP.

**Riscos de produto a encarar de frente.** (1) **Responsabilidade fiscal** — o produto *sugere e calcula*, o contador *homologa*; sem human-in-the-loop você assume passivo de terceiros, o que é inviável. Deixe isso explícito no contrato e no fluxo. (2) **Glosa** — itens com CST de PIS/COFINS 04/06/08/09 e ICMS-ST (CST 60, CSOSN 500) são fonte clássica de crédito indevido; o motor deve **negar com base legal**, nunca a IA decidir sozinha. (3) **Homologação humana** é feature, não fricção — venda como "blindagem em fiscalização", porque é exatamente isso.

**Diferenciação competitiva.** Os concorrentes são consultorias tributárias (caras, não escalam) e módulos de ERP (calculam, mas não *descobrem* oportunidade nem explicam com base legal rastreável). O Apurax fica no meio: escala de software, profundidade de consultoria, e — o fosso real — **trilha de auditoria com hash chain + regras versionadas por vigência + proveniência `engine` no schema**. Esse rigor é difícil de copiar e é exatamente o que um cliente mostra numa fiscalização. O dual-regime na transição é o gancho de entrada; a auditabilidade é o que retém.

**O que torna isso difícil (seja honesto com você mesmo):** custódia de certificado, manter as regras versionadas em dia com legislação que ainda está sendo regulamentada em 2026, e a responsabilidade fiscal latente. **O que torna isso vendável:** ROI direto e mensurável (crédito recuperado em R$), urgência dupla (janela da transição + congelamento da EFD-Contribuições), e um artefato de auditoria que o cliente exibe ao Fisco. É um bom negócio se você resistir à tentação de deixar a IA "só dessa vez" emitir o número.

## Plano de construção priorizado (MVP → evolução)

| Etapa | Entrega | Prioridade | Porquê |
|---|---|---|---|
| **0. Fundação** | Multi-tenant (tenant_id + RLS Postgres), modelo `Empresa` com `regimeTributario` no onboarding, `DocumentoFiscal`/`ItemDocumento` canônicos, Decimal fiscal | **P0** | O regime do cliente é o roteador de todo o produto; RLS e canônico são pré-requisito de tudo. Sem isso, nada é auditável nem isolado por tenant. |
| **1. Upload XML/ZIP + parser NF-e 55** | Ingestão por upload, validação XSD/assinatura/chave autorizada, dedup por `chNFe`, extração por `<det>` (CST/CSOSN, CFOP, NCM, vBC, vICMS, vCredICMSSN, CST PIS/COFINS, vPIS/vCOFINS) | **P0** | Caminho mais curto até valor sem tocar em certificado. Valida o contrato parser→motor com dado real. |
| **2. Motor determinístico ICMS + PIS/COFINS** | `MotorCreditoService.calcular()` versionado por vigência; regras seed (CST 00/10/20, CSOSN 101→vCredICMSSN, vedação uso/consumo art.33, CST PIS/COFINS 50-56 vs 70-75); roteamento por regime; saída com `regraId`+`baseLegal` | **P0** | É o coração: o único emissor de número. Sem ele não há produto. Já entrega cálculo de crédito legado, que é o produto principal de 2026. |
| **3. Trilha de auditoria** | `AuditoriaEvento` append-only com hash chain; cadeia `valorCredito→regraId→baseLegal→item→chNFe`; status SUGERIDO/HOMOLOGADO/GLOSADO + `homologadoPor` | **P0** | É o fosso competitivo e a defesa em fiscalização. Tem de nascer junto com o motor, não depois. |
| **4. IA caso 1 — validação CST/CFOP/NCM** | `claude-haiku-4-5` em massa: divergência NCM×descrição, CFOP incompatível, CST que veda crédito indevidamente; saída estruturada com `confianca`; `origemIA=true` | **P0** | O caso de IA de maior ROI e menor risco. Achar erro/oportunidade onde o motor rígido não chega. Limiar de confiança → fila de revisão. |
| **5. Homologação humana (UI)** | Tela de revisão SUGERIDO→HOMOLOGADO; só homologado entra no número oficial; persistência só com `proveniencia=engine` | **P0** | Sem o humano assumindo o número, há passivo fiscal. É feature de venda ("blindagem"), não fricção. |
| **6. Ingestão SPED (EFD-Contribuições, depois ICMS/IPI)** | Parser C100/C170, M100/M105/M500/M505; baseline de crédito já escriturado → motor mede a **lacuna** (crédito não aproveitado) | **P1** | Maior ROI imediato após upload: arquivo já existe, sem certificado, e a EFD-Contribuições **congela jan/2027** — urgência decadencial de 5 anos. |
| **7. Agente tool-use + RAG legal** | `claude-opus-4-8` orquestrando tools (`calcular_credito`, `consultar_regra`, `buscar_base_legal`); RAG sobre LC 87/96, Leis 10.637/10.833, IN 2.121/2022, Tema 779, particionado por vigência; guardrail "no-número-da-IA" | **P1** | Explicabilidade com fonte e descoberta de oportunidade na zona cinzenta (insumo). LLM narra, motor calcula. Vende profundidade de consultoria. |
| **8. Distribuição DFe (A1 + envelope encryption)** | Pull `NFeDistribuicaoDFe` por NSU (distNSU/ultNSU), cooldown 1h pós-137, manifestação para baixar XML completo; custódia A1 cifrada (KMS), trilha de uso do certificado | **P1** | Automação contínua de captura. Introduz custódia de certificado de forma controlada (só A1). Risco de segurança e operacional alto — por isso depois do motor validado. |
| **9. Dual-regime CBS/IBS + delta de oportunidade** | Calculadores CBS/IBS por vigência (alíquota-teste 2026, transição art.378-383), parser grupos `gIBSCBS`/`cClassTrib`, saída com `delta_oportunidade` legado×novo, regra de migração de saldo PIS/COFINS→CBS | **P1→P2** | A maior alavanca de valor de médio prazo e o gancho de venda da transição. Mas depende de motor+auditoria maduros e de legislação ainda em regulamentação — entra forte, mas não antes da base sólida. |
| **10. A3 (agente local/HSM) e DANFE OCR** | Assinatura A3 via PKCS#11/agente local; extração de PDF com `claude-opus-4-8`, flag "origem OCR — requer validação" + tentativa de puxar XML real por chave | **P2** | Fecha lacunas da base instalada (A3) e casos sem XML. Baixa confiança e alto atrito — só depois do fluxo principal provado. |

**O que NÃO fazer no MVP (P0):**
- **NÃO** custódia de certificado, Distribuição DFe ou manifestação — é o maior buraco de segurança/operacional; adia para P1 com A1+envelope.
- **NÃO** CBS/IBS no cálculo — em 2026 é alíquota-teste simbólica (0,9%/0,1%) compensável com PIS/COFINS; o produto principal é o crédito legado. Só **persista** os campos `gIBSCBS` no parser desde já (baratíssimo) para não reprocessar depois.
- **NÃO** OCR de DANFE — baixa confiança, nunca alimenta o motor; é último recurso.
- **NÃO** RAG nem agente Opus antes do motor + auditoria estarem sólidos — explicação sem número rastreável é teatro.
- **NÃO** deixar a IA emitir, somar ou arredondar qualquer valor fiscal, nem "só no protótipo" — o guardrail de proveniência `engine` é constraint de schema desde o primeiro commit, não convenção.
- **NÃO** suportar atividade mista/rateio de PIS/COFINS no MVP — modele o regime único primeiro; rateio é refinamento de P1.

---

Tenho os fatos confirmados. Vou escrever o documento técnico.

---

# Arquitetura do Apurax — Núcleo de Crédito Fiscal (NestJS/Prisma/RLS) com Motor Determinístico Versionado e IA por Tool-Use

## 1. Visão geral e fronteira IA × motor determinístico

O Apurax separa fisicamente **quem decide o número** de **quem interpreta texto**. O fluxo canônico de uma NF-e de entrada (modelo 55) é:

```
ingestao → parser-fiscal → (ItemDocumento canônico) → ia/classificacao → motor-credito → apuracao → auditoria
                                       │                      │                  │
                                       │  (Haiku em massa)    │ (Opus tool-use)  │ regras versionadas
                                       └──────────────────────┴──────────────────┘
```

Regra de ouro implementada como invariante de código: **nenhum valor de crédito (`valorCredito`) é gravado em `ApuracaoCredito` por caminho que não tenha passado pelo `MotorCreditoService.calcular()`**. A IA produz apenas *inputs de classificação* (NCM sugerido, finalidade, enquadramento de oportunidade, leitura de campos ilegíveis) e *outputs de explicação/risco* — nunca o `vICMS`/`vPIS`/`vCOFINS` creditável. Quando o agente LLM precisa de um número, ele o obtém via **tool-use** chamando a ferramenta `calcular_credito` que é um wrapper fino sobre o motor; o LLM recebe o resultado já calculado e apenas o narra.

## 2. Modelo canônico de item (saída do `parser-fiscal/`)

NF-e e SPED (EFD ICMS/IPI registro C170, EFD-Contribuições C170/C100) divergem na forma mas convergem para um `ItemCanonico`. O parser normaliza:

- **Identificação fiscal**: `cfop` (4 díg.), `ncm` (8 díg.), `cest` quando houver, `cClassTrib` (novo, NT 2025.002) e os CSTs por tributo.
- **ICMS**: extrai do grupo correto conforme o emitente — `ICMS00`/`ICMS10`/`ICMS20`/.../`ICMS90` (CST 00–90, regime normal) ou `ICMSSN101`/`ICMSSN201`/`ICMSSN500` (CSOSN, Simples Nacional). Daí saem `vBC`, `pICMS`, `vICMS`, `vICMSST`, `vBCST`, e — crítico para crédito a partir de fornecedor do Simples — `vCredICMSSN` (CSOSN 101/201, art. 23 LC 123/2006).
- **PIS/COFINS**: CST 01–99. CST 01/02 (operação tributável com alíquota) trazem `vBC`, `pPIS`/`pCOFINS`, `vPIS`/`vCOFINS`. CST 04/05/06 (monofásico, alíquota zero, suspensão) e 70–75 sinalizam **vedação ou não-incidência** que o motor precisa tratar como crédito = 0 com base legal específica (art. 3º, §2º, Leis 10.637/2002 e 10.833/2003).
- **IBS/CBS (a partir da competência 2026)**: grupo `gIBSCBS` com `vBCIBSCBS`, subgrupos `gIBS`/`gCBS` (alíquota e valor), `gCredPres`/`gCredPresOper` (crédito presumido), `gDevTrib`, `gAjusteCompet`. O parser persiste estes campos mesmo com valores simbólicos da alíquota-teste (CBS 0,9% / IBS 0,1% em 2026), porque a apuração já precisa rastreá-los.

O `ItemCanonico` carrega `competenciaRef` (derivada de `dhEmi`/`dhSaiEnt`) — é ela que o motor usa para resolver vigência de regra e regime aplicável.

## 3. Como o motor versionado resolve o dual-regime sobre a MESMA nota

Em junho/2026 a mesma NF-e de entrada gera **dois fluxos de crédito simultâneos** sobre regras vigentes em paralelo:

1. **Regime legado** — ICMS (não-cumulativo, art. 155, §2º, I, CF; LC 87/1996) + PIS/COFINS não-cumulativos (Leis 10.637/2002 e 10.833/2003), ainda plenamente vigentes em 2026.
2. **Regime novo (transição)** — IBS/CBS em **fase de teste** (LC 214/2025): alíquotas-teste 0,9% (CBS) + 0,1% (IBS) em 2026, com a particularidade de que o valor pago/destacado de CBS+IBS em 2026 **pode ser compensado contra débitos de PIS/COFINS**, sem aumento efetivo de carga. PIS/COFINS são extintos em **01/01/2027** (substituídos integralmente pela CBS), com regra de transição de saldos credores nos **arts. 378 a 383 da LC 214/2025** (saldo de PIS/COFINS vira crédito presumido de CBS; créditos em apropriação mensal, como depreciação de ativo, continuam sendo apropriados como crédito presumido de CBS nas mesmas condições).

O motor **não tem `if (ano === 2026)` hardcoded**. Cada `RegraCredito` declara `vigenciaInicio`/`vigenciaFim`, `tributo` (enum `ICMS|PIS|COFINS|CBS|IBS`) e `condicao` (predicado sobre o `ItemCanonico`). A resolução é:

```
regrasAplicaveis = RegraCredito.findMany({
  tributo: { in: tributosAtivosEm(competencia) },   // 2026 → [ICMS,PIS,COFINS,CBS,IBS]; 2027 → [ICMS,CBS,IBS]
  vigenciaInicio: { lte: competencia.fim },
  OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: competencia.inicio } }],
  empresaId: null OU empresa.regimeTributario,      // regra geral vs específica do regime
})
```

Assim, ao recalcular uma competência de 2025, o motor ignora CBS/IBS naturalmente (regras com `vigenciaInicio` em 2026); ao processar 2027, deixa de selecionar regras de PIS/COFINS (todas com `vigenciaFim = 2026-12-31`) e aciona a regra de transição de saldo (art. 378). **A nota é imutável; a competência é que decide o universo de regras.** Recalcular o passado nunca aplica lei futura — propriedade essencial para auditoria.

Conflito de regras (duas vigentes para o mesmo tributo+condição) é resolvido por `prioridade` decrescente e, em empate, pela regra mais específica (`especificidade`), com o motor registrando **todas as candidatas avaliadas** no traço de auditoria, não só a vencedora.

## 4. Ingestão e Distribuição DFe

Três portas de entrada no módulo `ingestao/`:

- **Upload XML/ZIP**: validação de schema (NT 2025.002 v1.3x para layout com IBS/CBS), dedup por `chNFe` (44 díg.) + `tenantId`.
- **Pull SEFAZ via `NFeDistribuicaoDFe`**: webservice que entrega DF-e de interesse mediante **certificado digital** (PF/PJ; autenticação pelo CNPJ-base, 8 primeiros dígitos). Consulta incremental por `distNSU` informando o `ultNSU` já possuído. Pontos que a arquitetura precisa respeitar: documentos ficam disponíveis **90 dias** no Ambiente Nacional; ao receber `cStat=137` (sem novos documentos) é **obrigatório aguardar 1 hora** antes de nova consulta, sob pena de **rejeição 656 (consumo indevido)** e bloqueio do CNPJ por 1h. Por isso o pull roda como job BullMQ com *rate-limit* persistido por `empresaId` e backoff respeitando o `ultNSU`/cooldown. Antes da manifestação do destinatário, só vem o **resumo** da NF-e — para baixar o XML completo o sistema dispara o evento de manifestação (Ciência/Confirmação da Operação).
- **SPED**: upload de EFD ICMS/IPI e EFD-Contribuições, parser dos blocos C/D.

O `CertificadoDigital` (A1) fica em custódia cifrada (envelope KMS/`crypto`, nunca em texto claro no DB), com `tenantId`, validade e fingerprint; o segredo vai para o secret store, não para a coluna.

## 5. IA — classificação, RAG e agente tool-use

- **Classificação em massa** (`claude-haiku-4-5`): valida NCM×CFOP×CST, sugere correção de NCM, detecta itens com CST de PIS/COFINS que vedam crédito (04/05/06/08/09), marca candidatos a crédito presumido. Saída estruturada com `confianca` ∈ [0,1]; grava `origemIA=true` no registro de sugestão.
- **RAG** sobre base legal vetorizada (LC 214/2025, Leis 10.637/10.833, LC 87/1996, NTs SEFAZ, soluções de consulta) — recupera o trecho que fundamenta cada enquadramento.
- **Agente de raciocínio fiscal** (`claude-opus-4-8`, tool-use): orquestra ferramentas, mas **não calcula**. Ferramentas expostas: `calcular_credito(itemId, tributo, competencia)` → motor; `consultar_regra(tributo, ncm, cfop, competencia)`; `buscar_base_legal(query)` (RAG); `simular_oportunidade(...)`. O LLM monta a narrativa ("este item permite crédito de ICMS de R$ X conforme regra R-ICMS-014"), mas o R$ X **veio da tool**, com `regraId` anexado.

## 6. Modelos Prisma centrais

Todos com `tenantId` + RLS Postgres (`CREATE POLICY ... USING (tenant_id = current_setting('app.tenant_id')::uuid)`), `tenant_id` setado por middleware Prisma a cada request.

- **Empresa**: `cnpj`, `regimeTributario` (LUCRO_REAL/PRESUMIDO/SIMPLES), `crt`, certificados.
- **DocumentoFiscal**: `chNFe`, `tipo` (NFE_ENTRADA), `dhEmi`, `competenciaRef`, `emitenteCnpj`, `xmlRaw` (S3 key), `origem` (UPLOAD/DFE/SPED).
- **ItemDocumento**: campos canônicos da seção 2 (`cfop`, `ncm`, `cClassTrib`, CSTs, `vBC`, `vICMS`, `vPIS`, `vCOFINS`, grupo `gIBSCBS`).
- **RegraCredito**: `versao`, `tributo`, `vigenciaInicio`, `vigenciaFim`, `condicao` (JSON/DSL de predicado), `formula`, `prioridade`, `especificidade`, `baseLegal` (lei+artigo+link), `status` (ATIVA/REVOGADA), `hashConteudo` (imutabilidade).
- **ApuracaoCredito**: `itemDocumentoId`, `tributo`, `creditoPermitido` (bool), `valorCredito` (Decimal), `regraId`, `status` (SUGERIDO/HOMOLOGADO/GLOSADO), `origemIA` (bool), `confianca`, `sugestaoIaId?`, `homologadoPor?`, `homologadoEm?`.
- **CertificadoDigital**: custódia cifrada (seção 4).
- **Competencia**: `mesAno`, `status` (ABERTA/FECHADA), `lockedAt`, `lockedBy` — período fechado **rejeita** novo cálculo/edição; recálculo exige reabertura auditada.

## 7. Apuração e auditoria (trilha imutável)

`apuracao/` consolida `ApuracaoCredito` por competência+tributo, calcula **saldo credor**, separa SUGERIDO de HOMOLOGADO (só homologado entra no número oficial) e gera os dados para EFD-Contribuições / EFD ICMS-IPI e para PER/DCOMP (pedido de ressarcimento/compensação).

A exigência inegociável de rastreabilidade: **todo `valorCredito` aponta para a cadeia completa**:

```
ApuracaoCredito.valorCredito
   → regraId  → RegraCredito (versão + vigência + fórmula + hashConteudo)
                  → baseLegal (lei, artigo, URL oficial)
   → sugestaoIaId? → SugestaoIA (modelo, prompt-hash, confianca, origemIA=true)
   → homologadoPor + homologadoEm → Usuario (quem assumiu responsabilidade)
   → itemDocumentoId → DocumentoFiscal.chNFe (nota de origem)
```

A trilha é gravada em tabela **append-only** (`AuditoriaEvento`, sem UPDATE/DELETE por policy RLS; encadeamento por hash do evento anterior — *hash chain* — para detectar adulteração). Cada transição de status (SUGERIDO→HOMOLOGADO→GLOSADO) é um evento. Isso responde, para qualquer R$ creditado: **qual regra**, **qual lei/artigo**, **se a IA originou e com que confiança**, **quem homologou** e **de qual nota**.

## 8. Árvore de pastas

```tree
G:\APP\apurax
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ src/
│  ├─ main.ts
│  ├─ app.module.ts
│  ├─ common/
│  │  ├─ rls/                       # middleware tenant_id + setContext
│  │  ├─ money/                     # Decimal fiscal, arredondamento ABNT
│  │  └─ guards/
│  ├─ ingestao/
│  │  ├─ ingestao.module.ts
│  │  ├─ upload/                    # XML/ZIP
│  │  ├─ dfe/                       # NFeDistribuicaoDFe (distNSU/ultNSU, cooldown 656)
│  │  └─ sped/
│  ├─ parser-fiscal/
│  │  ├─ parser-fiscal.module.ts
│  │  ├─ nfe/                       # grupos ICMSxx, ICMSSNxxx, PIS/COFINS, gIBSCBS
│  │  ├─ sped/                      # C100/C170, EFD-Contribuições
│  │  └─ canonico/                  # ItemCanonico
│  ├─ motor-credito/
│  │  ├─ motor-credito.module.ts
│  │  ├─ motor-credito.service.ts          # orquestra: resolve regras + aplica fórmula
│  │  ├─ resolver-vigencia.ts              # seleciona regra por competência (dual-regime)
│  │  ├─ tributos-ativos.ts                # tributosAtivosEm(competencia)
│  │  ├─ avaliador-condicao.ts             # executa predicado da RegraCredito
│  │  ├─ calculadores/
│  │  │  ├─ icms.calculador.ts             # CST 00-90, CSOSN 101/201 (vCredICMSSN)
│  │  │  ├─ pis-cofins.calculador.ts       # CST 01-99, vedações §2º
│  │  │  ├─ cbs.calculador.ts              # gCBS, alíquota-teste 2026, transição 2027
│  │  │  ├─ ibs.calculador.ts              # gIBS, alíquota-teste 2026
│  │  │  └─ credito-presumido.calculador.ts # gCredPres / arts. 378-383 LC 214/2025
│  │  ├─ regras/
│  │  │  ├─ regra-credito.repository.ts
│  │  │  ├─ regra.dsl.ts                   # DSL de condicao/formula versionada
│  │  │  └─ seed/                          # regras versionadas por vigência (JSON+migration)
│  │  ├─ conflito/
│  │  │  └─ resolver-conflito.ts           # prioridade + especificidade + registro candidatas
│  │  └─ motor-credito.types.ts
│  ├─ ia/
│  │  ├─ ia.module.ts
│  │  ├─ anthropic.client.ts               # claude-opus-4-8 / claude-haiku-4-5
│  │  ├─ classificacao/
│  │  │  ├─ classificacao.service.ts       # Haiku em massa, NCM/CFOP/CST, confianca
│  │  │  └─ classificacao.schema.ts        # saída estruturada validada (zod)
│  │  ├─ agente/
│  │  │  ├─ agente-fiscal.service.ts       # Opus tool-use (NÃO calcula)
│  │  │  └─ tools/
│  │  │     ├─ calcular-credito.tool.ts    # wrapper → motor-credito.service
│  │  │     ├─ consultar-regra.tool.ts
│  │  │     ├─ buscar-base-legal.tool.ts   # RAG
│  │  │     └─ simular-oportunidade.tool.ts
│  │  ├─ rag/
│  │  │  ├─ rag.service.ts
│  │  │  ├─ embeddings.ts
│  │  │  └─ indexador-base-legal.ts        # LC 214/2025, Leis 10.637/10.833, NTs
│  │  ├─ guardrails/
│  │  │  └─ no-numero-da-ia.guard.ts       # bloqueia valor fiscal vindo do LLM
│  │  └─ ia.types.ts
│  ├─ apuracao/
│  │  ├─ apuracao.module.ts
│  │  ├─ consolidador.service.ts           # saldo por competência/tributo
│  │  ├─ competencia.service.ts            # lock de período fechado
│  │  └─ export/                           # EFD, PER/DCOMP
│  ├─ auditoria/
│  │  ├─ auditoria.module.ts
│  │  ├─ trilha.service.ts                 # append-only + hash chain
│  │  └─ auditoria-evento.repository.ts
│  └─ relatorios/
│     └─ relatorios.module.ts
└─ test/
```

## 9. Riscos arquiteturais a tratar desde já

- **Crédito da alíquota-teste 2026 não é "saldo a recuperar comum"**: o calculador de CBS/IBS deve marcar a natureza compensável-contra-PIS/COFINS, senão a apuração superestima saldo credor.
- **Virada 2026→2027**: o `resolver-vigencia` precisa estar coberto por teste que recalcula a mesma nota nas duas competências e prova que PIS/COFINS some e a regra de transição (art. 378) aparece — esse é o teste de regressão mais importante do motor.
- **Glosa por CST de PIS/COFINS**: itens com CST 04/06/08/09 são fonte clássica de crédito indevido; a IA deve sinalizar e o motor deve **negar com base legal**, nunca a IA decidir sozinha.

Fontes:
- [LC 214/2025 e alíquotas-teste 2026 — Agência Brasil](https://agenciabrasil.ebc.com.br/economia/noticia/2026-01/reforma-tributaria-entra-em-fase-de-testes-em-2026)
- [Alíquotas-teste IBS/CBS — Tax Group](https://www.taxgroup.com.br/solutions/aliquota-teste-de-ibs-e-cbs-guia-completo-de-como-vai-funcionar/)
- [NF-e novos campos IBS/CBS e cronograma 2026/2027 — Contábeis](https://www.contabeis.com.br/artigos/76943/nf-e-novas-regras-e-cronogramas-para-ibs-e-cbs-em-2026-2027/)
- [Transição de créditos PIS/Cofins → CBS (arts. 378-383) — Conjur](https://www.conjur.com.br/2026-jan-08/reforma-tributaria-e-as-regras-de-utilizacao-de-creditos-na-transicao-do-pis-cofins-para-a-cbs/)
- [NT 2025.002 — grupos gIBSCBS, cClassTrib, gCredPres — Tecnospeed](https://blog.tecnospeed.com.br/nota-tecnica-reforma-tributaria-nfe-nfce/)
- [Web Service NFeDistribuicaoDFe (distNSU/ultNSU, 90 dias, rejeição 656) — Tributos.io](https://tributos.io/blog/legislacao-e-normas/nfedistribuicaodfe-consulta-df-e-para-emitentes-e-destinatarios)

---

Confirmados os fatos sensíveis a tempo. Vou redigir o documento técnico.

# Arquitetura da Camada de IA do APURAX: onde a IA agrega — e onde NÃO calcula

## 0. Princípio inegociável (reafirmado)

O **motor determinístico de regras** é o único componente autorizado a emitir valor fiscal. Ele é versionado por vigência da legislação (cada regra carrega `vigencia_inicio`/`vigencia_fim` e a `base_legal` — ex.: LC 87/96 art. 20; Lei 10.833/03 art. 3º; IN RFB 2.121/2022 art. 175; LC 214/2025), é auditável e rastreável até o dispositivo legal. A **IA (LLM) nunca produz o número do crédito**. A IA faz seis coisas — classifica, valida, descobre oportunidades, lê documentos não-estruturados, explica com base legal (RAG) e orquestra via tool-use — e, sempre que precisar de um número, **chama uma ferramenta do motor**. Toda saída numérica persistida tem proveniência `engine`, nunca `llm`.

Formalmente, a fronteira é:

| Camada | Pode emitir valor fiscal? | Exemplo de saída |
|---|---|---|
| Motor determinístico | **Sim** (única) | `vICMS_creditavel = 1.234,56`, `cst_bloqueia_credito = true` |
| IA / LLM | **Não** | `ncm_provavel = "84713012"`, `confidence = 0.87`, `risco = "alto"`, candidato a insumo, texto explicativo |

Regra de implementação: nenhum campo do tipo `valor`, `vBC`, `vICMS`, `vPIS`, `vCOFINS`, `aliquota`, `creditoApurado` aceita gravação cuja proveniência seja o LLM. Isso é validado no nível do schema de persistência (constraint), não apenas por convenção.

---

## 1. Caso de uso 1 — Classificação/validação de NCM·CFOP·CST por item

**Modelo:** `claude-haiku-4-5` (classificação em massa — baixo custo, alta vazão; o cenário do Apurax é dezenas a centenas de milhares de itens por lote de XMLs/SPED).

**Entrada (estruturada, extraída do XML por parser, NÃO pelo LLM):** por item da NF-e (`<det>`), os campos `prod/xProd` (descrição), `prod/NCM`, `prod/CFOP`, `prod/CEST`, e os grupos de tributação: `imposto/ICMS/*` (ex.: `ICMS00` com `CST=00`, ou `ICMSSN101` com `CSOSN=101`), `imposto/PIS/*` (`CST` PIS 01–99, `vBC`, `pPIS`, `vPIS`), `imposto/COFINS/*` (`CST` COFINS, `vCOFINS`). Também a finalidade da operação (`ide/finNFe`, `ide/idDest`, `ide/tpNF`) e o regime do emitente/destinatário.

**Saída (JSON validado por schema):**
```json
{
  "item_id": "det-3",
  "ncm_informado": "84713012",
  "ncm_sugerido": "84713019",
  "ncm_divergente": true,
  "cfop_compativel_operacao": false,
  "cfop_observado": "5102",
  "cfop_esperado": "6102",
  "cst_icms_observado": "60",
  "cst_bloqueia_credito_indevidamente": true,
  "motivo": "CST 60 (ICMS-ST cobrado anteriormente) na entrada de insumo industrializado sugere ressarcimento, não vedação de crédito",
  "confidence": 0.82
}
```

**O que a IA detecta (e por que LLM ali):**
- **CST/CSOSN que bloqueia crédito indevidamente.** Ex.: entrada com `CST=90` (Outras) genérico onde a operação real comportaria `CST=00`/`20` com direito a crédito; ou `CST PIS/COFINS = 70/73/75` (operação sem direito a crédito) marcado num insumo que, pela natureza, gera crédito sob o art. 3º das Leis 10.637/02 e 10.833/03. A descrição livre em `xProd` é texto natural — encontrar a incoerência entre a *descrição do produto* e o *código tributário informado* é exatamente onde o LLM supera a regra rígida.
- **CFOP incompatível com a operação.** Ex.: `CFOP 1556` (compra de material p/ uso/consumo — crédito ICMS vedado em regra, salvo exceções da LC 87/96 art. 33) usado em item que a descrição revela ser insumo de produção (deveria ser `1101`/`1126`). O CFOP determina o tratamento de crédito; CFOP errado é a causa nº 1 de crédito perdido ou autuável.
- **NCM divergente** da descrição — impacta alíquota, monofásico de PIS/COFINS, e (no novo modelo) o enquadramento em alíquota reduzida/regime específico.

**Por que não é o motor quem decide:** a *classificação* (ler "PARAFUSO SEXTAVADO M8 AÇO INOX" e inferir NCM/natureza de insumo) é um problema de linguagem e ambiguidade; a *consequência fiscal* da classificação (gera ou não crédito, e quanto) é determinística e fica no motor. A IA propõe `ncm_sugerido`/`cst_corrigido`; o motor, recebendo o código corrigido, calcula. Confidence < limiar → vai para fila de revisão humana.

---

## 2. Caso de uso 2 — Descoberta de crédito não aproveitado (zona cinzenta do Tema 779)

**Modelo:** `claude-opus-4-8` (raciocínio fiscal — exige ponderar conceito de insumo, atividade da empresa e jurisprudência).

**Contexto legal:** o STJ no **Tema 779 (REsp 1.221.170/PR)** firmou que insumo, para PIS/COFINS não-cumulativos, define-se pelos critérios de **essencialidade e relevância** ao processo produtivo/atividade — superando a interpretação restritiva da IN SRF 247/2002, hoje refletida na IN RFB 2.121/2022. Isso cria uma vasta zona cinzenta (EPI, materiais de limpeza em indústria de alimentos, frete entre estabelecimentos, embalagem, etc.).

**Entrada:** itens de entrada classificados (caso 1) + CNAE/atividade do contribuinte + histórico do que já foi creditado.

**Saída:** lista de **candidatos** a crédito não aproveitado, cada um com: item, fundamento de essencialidade/relevância, dispositivo/precedente sugerido, e `confidence`. **A IA não diz "você tem R$ X de crédito"** — diz "este item é candidato a insumo pelo critério de relevância; submeta ao motor".

**Fluxo obrigatório:** IA sugere → **contador decide** (human-in-the-loop) → motor calcula sobre `vBC`/`vPIS`/`vCOFINS` do item aprovado. O LLM cabe aqui porque o enquadramento no Tema 779 é argumentativo e dependente de contexto da operação; o cálculo, uma vez decidido o enquadramento, é aritmético e determinístico.

---

## 3. Caso de uso 3 — Detecção de anomalia / risco de autuação

**Modelo:** `claude-haiku-4-5` para triagem em massa (flag de outliers); `claude-opus-4-8` para explicar e qualificar o risco dos casos sinalizados.

**Detecta:**
- **Crédito inflado:** `vICMS` destacado incompatível com `vBC × alíquota` da UF/NCM; alíquota destacada acima da vigente.
- **Divergência XML × SPED:** item presente no XML de entrada com crédito que não consta (ou consta com valor distinto) no registro **C170/C190** do SPED Fiscal, ou base PIS/COFINS divergente entre XML e **registro C100/M100/M500**.
- **Padrões atípicos:** mesmo fornecedor com CFOP oscilando, CST mudando entre notas idênticas, crédito de uso/consumo travestido de insumo.

**Saída:** `{ tipo_anomalia, severidade, itens_afetados[], evidencia, recomendacao }` — sempre com a *evidência* sendo um confronto entre números que **o motor/parser calculou**, não que o LLM "estimou". O LLM interpreta o padrão e redige o alerta; os números do confronto vêm de ferramenta.

---

## 4. Caso de uso 4 — Leitura de documentos não-estruturados

**Modelo:** `claude-opus-4-8` (visão + extração estruturada; DANFE em PDF escaneado, contratos).

**Entrada:** PDF do DANFE (quando não há XML), contrato de frete/locação/armazenagem que embasa um insumo na zona do Tema 779. (Tecnicamente: documento via Files API / bloco `document`.)

**Saída:** extração estruturada — chave de acesso, emitente, itens, valores — em JSON com schema, **marcada como extraída por OCR/LLM e pendente de conferência**. Para crédito, esse dado **não alimenta o cálculo diretamente**: vira insumo de validação para o contador e, idealmente, é reconciliado contra o XML oficial (a fonte de verdade fiscal é sempre o XML autorizado / o evento da Distribuição DFe).

**Por que LLM:** PDF e contrato são não-estruturados; é o caso clássico de extração. Mas há guardrail forte: número fiscal lido de PDF nunca é tratado como autoritativo — o XML autorizado prevalece.

---

## 5. Caso de uso 5 — RAG sobre legislação (explicabilidade com fonte)

**Modelo:** `claude-opus-4-8` com recuperação sobre uma base versionada: LC 87/96 (Lei Kandir, crédito ICMS — arts. 19, 20, 33), Leis 10.637/02 e 10.833/03 (não-cumulatividade PIS/COFINS — art. 3º), IN RFB 2.121/2022, **LC 214/2025** (CBS/IBS), soluções de consulta COSIT, convênios CONFAZ e jurisprudência (Tema 779, etc.).

**Entrada:** pergunta do contador ("por que este item não gerou crédito?") + contexto do crédito calculado pelo motor (incluindo a `base_legal` que o próprio motor já anexou).

**Saída:** explicação em linguagem natural **sempre citando a fonte** (lei, artigo, vigência), ancorada nos trechos recuperados. Regra anti-alucinação: se o RAG não recupera respaldo, a IA responde "não há base recuperada" — não inventa dispositivo. O LLM aqui só *explica e cita*; qualquer número na explicação foi produzido pelo motor e é referenciado, não recalculado pelo texto.

**Nota de vigência (crítica em jun/2026):** a base RAG deve estar particionada por vigência porque 2026 é ano de coexistência — ver §7.

---

## 6. Caso de uso 6 — Copiloto/agente com TOOL-USE (o LLM orquestra, o motor calcula)

**Modelo:** `claude-opus-4-8` com adaptive thinking (`thinking: {type: "adaptive"}`) e `effort: "high"`.

O agente recebe um pedido em linguagem natural ("apure o crédito de ICMS aproveitável deste lote e me explique os bloqueios"), **planeja**, e **chama ferramentas do motor** para todo número. Ele nunca soma, nunca multiplica base por alíquota — delega.

### 6.1 Exemplo de definição de tool (JSON Schema — formato tool-use Anthropic)

```json
{
  "name": "calcularCreditoICMS",
  "description": "Calcula o valor de crédito de ICMS aproveitável de um item de NF-e de entrada, aplicando o motor determinístico de regras versionado por vigência. Use SEMPRE que precisar do valor de crédito de ICMS — não calcule você mesmo. Retorna o valor, a base legal e os bloqueios aplicados.",
  "input_schema": {
    "type": "object",
    "properties": {
      "chaveAcesso": { "type": "string", "description": "Chave de acesso de 44 dígitos da NF-e" },
      "itemId": { "type": "string", "description": "Identificador do item (det) na NF-e" },
      "cfop": { "type": "string", "description": "CFOP do item, ex.: 1101" },
      "cstIcms": { "type": "string", "description": "CST ICMS (regime normal) ou CSOSN (Simples), ex.: 00, 60, 101" },
      "ncm": { "type": "string", "description": "NCM de 8 dígitos" },
      "vBC": { "type": "number", "description": "Base de cálculo do ICMS informada no XML (campo vBC)" },
      "vICMS": { "type": "number", "description": "Valor do ICMS destacado no XML (campo vICMS)" },
      "ufOrigem": { "type": "string" },
      "ufDestino": { "type": "string" },
      "dataEmissao": { "type": "string", "format": "date", "description": "Usado para selecionar a regra vigente" }
    },
    "required": ["chaveAcesso", "itemId", "cfop", "cstIcms", "ncm", "vBC", "vICMS", "dataEmissao"],
    "additionalProperties": false
  }
}
```

Resposta da tool (produzida pelo motor, devolvida como `tool_result`):
```json
{
  "creditoIcmsAproveitavel": 180.00,
  "bloqueado": false,
  "regraId": "ICMS-CRED-LC87-ART20-v2024.1",
  "baseLegal": "LC 87/96 art. 20; RICMS/SP",
  "vigencia": "2024-01-01..",
  "proveniencia": "engine"
}
```

Outras tools do mesmo motor: `calcularCreditoPisCofins` (recebe `cstPis`, `cstCofins`, `vBC`, alíquotas, natureza do insumo decidida pelo contador), `validarCst` (retorna se um CST/CSOSN bloqueia crédito e o porquê legal), `confrontarXmlSped` (números do confronto do caso 3). Todas com `strict: true` no schema e `proveniencia: "engine"` no retorno.

### 6.2 Fluxo agente → motor → explicação

```
Contador: "Apure o crédito de ICMS aproveitável do lote X e explique os bloqueios."
        │
        ▼
[LLM Opus 4.8] planeja: precisa classificar itens, validar CSTs, calcular créditos
        │
        ├─ tool_use: validarCst({cstIcms:"60", ...})        ──► [MOTOR] ──► tool_result {bloqueado:true, baseLegal:"..."}
        ├─ tool_use: calcularCreditoICMS({item:"det-1",...}) ──► [MOTOR] ──► tool_result {credito:180.00, prov:"engine"}
        ├─ tool_use: calcularCreditoICMS({item:"det-2",...}) ──► [MOTOR] ──► tool_result {credito:0, bloqueado:true}
        │   (o LLM NÃO soma os valores ele mesmo — se quiser o total, chama agregarCreditos no motor)
        ▼
[LLM Opus 4.8] redige resposta: cita os números do motor + explica bloqueios via RAG (§5)
        │
        ▼
[Human-in-the-loop] contador revisa e aprova → só então o crédito é persistido (proveniencia=engine)
```

O agente roda em loop de tool-use padrão (Messages API): a cada `stop_reason: "tool_use"`, o orquestrador executa a ferramenta do motor e devolve `tool_result`, até `end_turn`. O número final exibido e persistido é o do motor; o LLM contribui o texto e a orquestração.

---

## 7. Vigência e a transição da Reforma Tributária (jun/2026)

A camada de IA precisa ser *consciente da vigência* porque 2026 é o **ano de teste/coexistência**. Fatos confirmados:

- Em **2026** há cobrança-teste com alíquota somada de **1%** — **0,9% CBS** + **0,1% IBS** — e o valor pago pode ser **compensado com PIS/COFINS** devidos; o ano tem caráter **predominantemente informativo/de adaptação** (Comunicado Conjunto CGIBS/RFB nº 01/2025), sem arrecadação efetiva dos novos tributos como regra geral. A implementação é gradual de **2026 a 2033**, com extinção progressiva de ICMS/PIS/COFINS ([Receita Federal — Orientações 2026](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-consumo/orientacoes-2026); [Tax Group](https://www.taxgroup.com.br/intelligence/reforma-tributaria-2026-guia-completo-sobre-o-que-muda-e-a-transicao/)).

**Implicação arquitetural:** o motor mantém regras das **duas famílias** (ICMS/PIS/COFINS *e* CBS/IBS da LC 214/2025) selecionadas por `dataEmissao`/vigência. A IA, ao classificar (caso 1) e explicar (caso 5), deve sinalizar quando um item já tem grupos de CBS/IBS no XML (campos novos do leiaute NT da Reforma) e roteá-lo à regra correta. A base RAG é particionada por vigência para que `claude-opus-4-8` não misture o regime de crédito antigo (não-cumulatividade do art. 3º) com o crédito amplo do IVA-dual. O cálculo dos novos tributos, como tudo, é do motor — a IA apenas reconhece o regime aplicável.

---

## 8. Ingestão via Distribuição DFe (fonte de verdade)

Quando a origem é o pull na SEFAZ via **`NFeDistribuicaoDFe`** (Nota Técnica 2014.002), há uma sutileza que a camada de IA deve respeitar: o serviço opera por **NSU** sequencial por CNPJ; para o *destinatário*, antes da **manifestação** (evento "Ciência da Operação", "Confirmação da Operação" ou "Operação não Realizada") só está disponível o **resumo da NF-e** (`resNFe`), não o XML completo — exceto o evento de cancelamento ([Web Service NFeDistribuicaoDFe — SEFAZ/PR](http://moc.sped.fazenda.pr.gov.br/NFeDistribuicaoDFe.html); [Tributos.io](https://tributos.io/blog/legislacao-e-normas/nfedistribuicaodfe-consulta-df-e-para-emitentes-e-destinatarios)).

**Implicação:** sobre um `resNFe` (resumo) o motor **não tem `vBC`/`vICMS` por item** para calcular crédito — só metadados. A IA pode, no máximo, *priorizar* quais notas merecem manifestação para baixar o XML completo (triagem por probabilidade de crédito relevante, com `claude-haiku-4-5`), mas o cálculo só ocorre após obter o XML integral. Nunca se calcula crédito a partir de resumo.

---

## 9. Guardrails (consolidados)

- **Human-in-the-loop obrigatório para crédito.** Nenhum crédito é apurado/persistido sem aprovação do contador. A IA propõe; o humano decide; o motor calcula.
- **Confidence score** em toda saída de classificação/descoberta; abaixo do limiar → fila de revisão.
- **Rastreabilidade total:** cada sugestão de IA guarda modelo, prompt/contexto, fontes RAG citadas e timestamp — revisável e reversível.
- **Proveniência no schema:** campos fiscais só aceitam `proveniencia: "engine"`; gravação com proveniência `llm` é rejeitada na borda de persistência.
- **Tool-use estrito:** todo número que o agente reporta veio de `tool_result` do motor; o LLM é instruído (system prompt) a *nunca* aritmetizar valores fiscais e a sempre chamar a ferramenta.
- **XML autorizado é a fonte de verdade** sobre PDF/OCR e sobre resumo da Distribuição DFe.

Fontes consultadas: [Receita Federal — Orientações 2026](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-consumo/orientacoes-2026), [Tax Group — Reforma 2026](https://www.taxgroup.com.br/intelligence/reforma-tributaria-2026-guia-completo-sobre-o-que-muda-e-a-transicao/), [Web Service NFeDistribuicaoDFe (SEFAZ/PR)](http://moc.sped.fazenda.pr.gov.br/NFeDistribuicaoDFe.html), [Tributos.io — NFeDistribuicaoDFe](https://tributos.io/blog/legislacao-e-normas/nfedistribuicaodfe-consulta-df-e-para-emitentes-e-destinatarios).

---

# Crédito de ICMS sobre NF-e de Entrada

## 1. Fundamento constitucional e legal da não-cumulatividade

O direito ao crédito de ICMS nasce da **não-cumulatividade** prevista no **art. 155, §2º, I da CF/88**: "o imposto será não-cumulativo, compensando-se o que for devido em cada operação relativa à circulação de mercadorias [...] com o montante cobrado nas anteriores pelo mesmo ou outro Estado". A operacionalização está na **LC 87/96 (Lei Kandir)**, notadamente:

- **Art. 19** — princípio da não-cumulatividade (compensação débito/crédito por período).
- **Art. 20** — direito de creditar-se do imposto anteriormente cobrado em operações de que tenha resultado a **entrada de mercadoria, real ou simbólica**, inclusive a destinada ao ativo permanente, ou o recebimento de serviços de transporte (interestadual/intermunicipal) e de comunicação.
- **Art. 20, §1º** — vedação ao crédito de entradas alheias à atividade e de mercadorias/serviços empregados em saídas **isentas ou não tributadas**.
- **Art. 21** — hipóteses de **estorno** (alteração de finalidade, perecimento, saída posterior isenta etc.).
- **Art. 33** — restrições temporais (uso/consumo, energia, comunicação).

O regime de apropriação é o de **crédito financeiro mitigado**: a regra geral admite crédito amplo (art. 20), mas o art. 33 introduz **vedações temporais** que reduzem isso a um modelo próximo do crédito físico para uma série de insumos indiretos.

**Atenção temporal (jun/2026):** em 2026 o ICMS permanece integralmente vigente e creditável segundo a LC 87/96. A coexistência com IBS/CBS é, neste exercício, de **alíquota-teste** (0,9% CBS + 0,1% IBS, compensável com PIS/COFINS), sem impacto sobre a sistemática de crédito do ICMS. *(verificado: a alíquota-teste 2026 é 0,1% IBS + 0,9% CBS, e o valor recolhido é compensável com PIS/COFINS do mesmo período — ou, na insuficiência de débitos, com outros tributos federais ou ressarcido — conforme LC 214/2025; Receita Federal e Tax Group, jun/2026.)* A redução do ICMS só começa em 2029 *(verificado: ICMS e ISS são reduzidos 10% ao ano entre 2029 e 2032, extinção plena em 2033 — LC 214/2025)*. Portanto, **o motor determinístico de crédito de ICMS opera hoje 100% sob LC 87/96** — o módulo IBS/CBS é paralelo, não substitutivo (ver §10).

## 2. Quando a entrada gera crédito (regra geral)

Geram crédito, em regra (art. 20 LC 87/96), as entradas de:

- **Mercadoria para revenda** (comércio) — crédito integral do vICMS destacado.
- **Insumo de industrialização** que se integra ao produto ou é consumido **no processo produtivo** (matéria-prima, material secundário, material de embalagem) — crédito integral.
- **Produto intermediário** consumido de forma imediata e integral no processo, ainda que não se integre fisicamente ao produto (tese consolidada — STJ, e diversos fiscos estaduais).
- **Serviço de transporte (CTe)** vinculado a operação tributada (frete sobre compra de insumo/mercadoria, quando o tomador é o adquirente).
- **Ativo imobilizado** — crédito **fracionado em 1/48** via CIAP (art. 20, §5º).

## 3. O que NÃO gera crédito ou é restrito

| Hipótese | Tratamento | Base legal |
|---|---|---|
| Material de **uso e consumo** | Crédito **postergado para 01/01/2033** (não creditável hoje) | Art. 33, I, LC 87/96 (red. LC 171/2019) *(verificado)* |
| **Energia elétrica** | Crédito só se: (a) consumida no **processo de industrialização**; (b) operação posterior de **exportação** (proporcional). Demais usos só a partir de 2033 | Art. 33, II, "a/b/c", LC 87/96 *(verificado)* |
| **Serviço de comunicação** | Crédito só quando vinculado a operação de saída tributada de comunicação ou a exportação (proporcional). Demais casos só a partir de 2033 | Art. 33, IV, LC 87/96 |
| **Ativo imobilizado** | Crédito em **48 parcelas** (1/48 ao mês), proporcional às saídas tributadas; perde-se as parcelas restantes na alienação antes de 48 meses | Art. 20, §5º, LC 87/96 |
| Entrada para saída **isenta/não tributada** | **Sem crédito** (ou estorno se já apropriado), salvo manutenção expressa de crédito (ex.: exportação, art. 155 §2º X "a" CF) | Art. 20, §1º e §3º; art. 21, LC 87/96 |
| Bens **alheios à atividade** | Sem crédito | Art. 20, §1º, LC 87/96 |

## 4. Decisão de crédito por item, a partir dos campos do XML

O motor decide **por item** (`<det>`), cruzando três eixos do XML da NF-e (leiaute 4.00; o layout vigente é regido pela NT 2016.002 e suas atualizações posteriores — *(corrigido: a referência "NT 2013/2024" do rascunho era imprecisa; o leiaute 4.00 origina-se da NT 2016.002, não de uma "NT 2013")*):

**Eixo 1 — CFOP de entrada** (`prod/CFOP`). É a primeira chave de elegibilidade pela **natureza/finalidade declarada**:
- **1xxx** = entrada interna; **2xxx** = entrada interestadual; **3xxx** = importação.
- Finais relevantes: `x101/x102` (compra p/ industrialização ou comercialização — **gera crédito**), `x556` (compra de material para uso/consumo — **não credita até 2033**), `x551` (compra de ativo imobilizado — **CIAP 1/48**), `x401` (compra para **industrialização** em operação com mercadoria sujeita a **ST**) / `x403` (compra para **comercialização** em operação com mercadoria sujeita a **ST**) — *(corrigido: o rascunho listava "x403/x401" como genéricos de ST; a distinção correta é x401 = industrialização e x403 = comercialização, ambos em operação com ST — sem crédito ordinário do ICMS-ST)*, `x910/x911` (bonificação/brinde — em regra não credita por ausência de onerosidade na saída).
- Observação: o CFOP é **declaratório do emitente**; o motor o usa como hipótese e **confronta com NCM + finalidade cadastrada do item** para detectar erro de classificação (ex.: CFOP de revenda em NCM de material de limpeza → alerta).

**Eixo 2 — CST de ICMS** (`imposto/ICMS/.../CST`) ou **CSOSN** (Simples, `CSOSN`). Define se há **imposto destacado** e em que regime:

| CST (regime normal) | Descrição | Dá crédito? | Condição |
|---|---|---|---|
| **00** | Tributada integralmente | **Sim** | vICMS destacado; finalidade creditável (revenda/insumo) |
| **10** | Tributada e com **ICMS-ST** | Crédito só da **operação própria** (vICMS), **não** do vICMSST | Item para revenda/insumo |
| **20** | Com **redução de base** | **Sim, proporcional** à BC reduzida (vBC já reduzida) | Vedação de crédito do valor reduzido se a legislação assim exigir (art. 20 §1º) |
| **30** | Isenta/não trib. **e com cobrança do ICMS por ST** | **Não** (operação própria isenta) | — *(verificado: CST 30 = "Isenta ou não tributada e com cobrança do ICMS por substituição tributária")* |
| **40 / 41 / 50** | Isenta / Não tributada / Suspensão | **Não** (sem imposto cobrado) | salvo crédito presumido/outorgado expresso |
| **51** | **Diferimento** | Em regra **não** credita na entrada (imposto diferido p/ etapa posterior) | conforme RICMS estadual *(verificado)* |
| **60** | ICMS **cobrado anteriormente por ST** | **Não** (crédito ordinário); cabe ressarcimento/restituição em hipóteses específicas | Ver §5 *(verificado: CST 60 = emitente substituído, ICMS já recolhido por ST em etapa anterior)* |
| **70** | Redução de base **+ ST** | Crédito proporcional da parte própria; ST não credita | — *(verificado: CST 70 = "Com redução de base de cálculo e cobrança do ICMS por substituição tributária")* |
| **90** | Outras | **Depende** — exige leitura do destaque (vICMS/vBC) e da norma estadual | analisar caso a caso |

| CSOSN (Simples Nacional) | Descrição | Dá crédito ao adquirente? |
|---|---|---|
| **101** | Com permissão de crédito | **Sim, limitado** ao percentual informado em `pCredSN`/`vCredICMSSN` (campo do grupo `ICMSSN101`) |
| **102 / 103 / 300 / 400** | Sem permissão de crédito / imune / não tributada | **Não** |
| **201** | Com permissão de crédito **e ST** | Crédito limitado (`vCredICMSSN`); ST sem crédito |
| **202 / 203** | Sem permissão de crédito, **com ST** | **Não** |
| **500** | ICMS cobrado anteriormente por **ST/antecipação** | **Não** (crédito ordinário) |
| **900** | Outros | **Depende** — verificar `vCredICMSSN` se presente |

**Ponto crítico do Simples:** o fornecedor optante pelo Simples só transfere crédito quando emite com **CSOSN 101/201** e preenche o grupo `ICMSSN101` com `pCredSN` e **`vCredICMSSN`** — e **é esse `vCredICMSSN` (não o vICMS "cheio") o valor creditável** pelo adquirente (LC 123/2006, art. 23; Resolução CGSN 140/2018). O motor deve ler `vCredICMSSN`, nunca calcular alíquota cheia sobre vBC.

## 5. ICMS-ST: ausência de crédito ordinário e hipóteses de ressarcimento

Nas entradas com **CST 10, 30, 60, 70** e **CSOSN 201, 202, 500**, o ICMS-ST já foi retido em etapa anterior — não há crédito ordinário do `vICMSST`, pois o adquirente é mero "substituído" cuja saída subsequente será **sem novo débito** (CST 60 / CSOSN 500). O crédito da operação própria (vICMS do CST 10/70), quando o adquirente é industrial/revendedor, **pode** ser apropriado.

Cabe **ressarcimento/restituição do ICMS-ST** (LC 87/96, art. 10; e **STF, RE 593.849 / Tema 201** — restituição da diferença quando a base presumida supera a real) nas hipóteses:
- Saída para **outro Estado** (a ST foi recolhida para a UF de origem);
- **Operação isenta/não tributada** posterior;
- **Perecimento/perda** da mercadoria;
- Venda a **preço inferior** à base de cálculo presumida da ST (Tema 201).

*(verificado: Tema 201 = RE 593.849/MG, tese: "É devida a restituição da diferença do ICMS pago a mais no regime de substituição tributária para frente se a base de cálculo efetiva da operação for inferior à presumida"; fundamento art. 150, §7º, CF; STF, portal de repercussão geral. Nota operacional: o ressarcimento das hipóteses clássicas — saída interestadual, isenção/não incidência posterior, perda/perecimento — tem fundamento direto no art. 10 da LC 87/96, ao passo que o Tema 201 trata especificamente da diferença base presumida × base real.)*

O motor trata ST como **trilha separada** (ressarcimento), não como crédito de não-cumulatividade.

## 6. DIFAL, antecipação e CIAP

- **DIFAL** (EC 87/2015; LC 190/2022): na entrada interestadual de mercadoria destinada a **uso/consumo ou ativo** do contribuinte, recolhe-se o diferencial de alíquota à UF de destino. **Não gera crédito** quando o destino é uso/consumo (vedação do art. 33). Para **ativo**, integra o custo do bem e segue o CIAP.
- **Antecipação tributária** (entrada interestadual de mercadoria para revenda em regimes estaduais de antecipação): o valor antecipado **é creditável** se referente a mercadoria que dará saída tributada — o motor deve distinguir antecipação **com** e **sem** encerramento de tributação (esta última equivale a ST → sem crédito ordinário).
- **CIAP** (art. 20, §5º LC 87/96): crédito do ativo em **1/48 por mês**, iniciando no mês da entrada, proporcional à razão entre saídas tributadas e saídas totais (`fator = saídas tributadas+exportação / saídas totais`). O motor gera um **cronograma de 48 parcelas** e recalcula o fator mensalmente; alienação antes do 48º mês **extingue** as parcelas vincendas.

## 7. Energia elétrica e comunicação

- **Energia (art. 33, II):** credita-se **somente** a parcela consumida no **processo de industrialização** e a proporção destinada à **exportação**. Energia de setor administrativo/comercial → crédito vedado até 2033. Exige laudo/perícia de rateio de consumo industrial; o motor armazena o percentual industrial como parâmetro do tenant e o aplica sobre o vICMS da NF-e de energia (modelo 6/66, não 55, mas a mesma regra de crédito).
- **Comunicação (art. 33, IV):** crédito só para empresa de comunicação (saída tributada de comunicação) ou proporção de exportação. Para o contribuinte comum, **vedado** até 2033.

## 8. Vedações, estornos e saídas desoneradas

- **Vedação na entrada** (art. 20, §1º e §3º): se a mercadoria/insumo se destina a saída **isenta ou não tributada**, não há crédito; se a destinação for proporcional, o crédito é **proporcional às saídas tributadas**.
- **Estorno** (art. 21): crédito legitimamente tomado deve ser estornado se a mercadoria for objeto de saída isenta/não trib., integrar produto cuja saída seja desonerada, perecer, deteriorar ou ser empregada em fim alheio à atividade.
- **Exceção da exportação** (CF art. 155 §2º X "a"; LC 87/96 art. 32): saída para exportação é imune **com manutenção do crédito** da entrada — o motor **não estorna** e ainda permite acúmulo/transferência de saldo credor.

## 9. Como o MOTOR DETERMINÍSTICO modela a regra

O motor é **versionado por vigência** (cada regra carrega `vigenciaInicio`/`vigenciaFim` e `baseLegal`), recebe os campos do item já normalizados e devolve veredito auditável. A IA (Haiku para classificação em massa, Opus para casos `90`/`900`/ambíguos) **classifica e sinaliza**, mas **chama o motor via tool-use** para obter `valorCredito` — nunca o emite.

**Entradas do motor (por item da NF-e):**
`cfop`, `cstIcms` ou `csosn`, `ncm`, `regimeAdquirente` (normal / Simples / presumido), `ufOrigem`, `ufDestino`, `finalidadeItem` (revenda / insumoIndustrializacao / usoConsumo / ativoImobilizado), `vBC`, `vICMS`, `vICMSST`, `vCredICMSSN`, `dataEmissao`.

**Saídas:** `creditoPermitido` (S/N/parcial), `valorCredito`, `tipoCredito` (integral / proporcional / CIAP / ressarcimentoST), `baseLegal[]`, `alertas[]`, `regraId`, `vigencia`.

Exemplo de regra estruturada (pseudo-JSON):

```json
{
  "regraId": "ICMS-CRED-USOCONSUMO-VEDADO",
  "vigencia": { "inicio": "2020-01-01", "fim": "2032-12-31" },
  "baseLegal": ["LC 87/96, art. 33, I (red. LC 171/2019)"],
  "quando": {
    "finalidadeItem": "usoConsumo",
    "cfop": { "sufixoIn": ["556"] },
    "cstIcms": { "in": ["00", "20", "90"] }
  },
  "entao": {
    "creditoPermitido": "N",
    "valorCredito": 0,
    "tipoCredito": "vedado",
    "alertas": ["Crédito de uso/consumo postergado para 01/01/2033 (LC 171/2019). Verificar reclassificação como insumo se houver consumo no processo produtivo."]
  }
}
```

```json
{
  "regraId": "ICMS-CRED-REVENDA-CST00-INTEGRAL",
  "vigencia": { "inicio": "1996-11-01", "fim": null },
  "baseLegal": ["CF art.155 §2º I", "LC 87/96, art. 19 e 20"],
  "quando": {
    "finalidadeItem": "revenda",
    "cstIcms": { "in": ["00"] },
    "regimeAdquirente": "normal",
    "vICMS": { "maiorQue": 0 }
  },
  "entao": {
    "creditoPermitido": "S",
    "valorCredito": "{{ item.vICMS }}",
    "tipoCredito": "integral",
    "baseLegal": ["LC 87/96 art. 20"],
    "alertas": []
  }
}
```

```json
{
  "regraId": "ICMS-CRED-SIMPLES-CSOSN101",
  "vigencia": { "inicio": "2007-07-01", "fim": null },
  "baseLegal": ["LC 123/2006, art. 23", "Res. CGSN 140/2018, art. 58 a 60"],
  "quando": { "csosn": { "in": ["101", "201"] } },
  "entao": {
    "creditoPermitido": "S",
    "valorCredito": "{{ item.vCredICMSSN }}",
    "tipoCredito": "limitadoSimples",
    "alertas": [
      "Creditar APENAS vCredICMSSN do grupo ICMSSN101; NÃO aplicar alíquota cheia sobre vBC.",
      "Se vCredICMSSN ausente/zerado com CSOSN 101, crédito = 0."
    ]
  }
}
```

Ordem de avaliação recomendada: (1) regras de **vedação** (uso/consumo, ST, isenta) têm prioridade e curto-circuitam; (2) regras de **regime** (Simples → `vCredICMSSN`); (3) regras de **fracionamento** (ativo → CIAP); (4) regra **geral** (CST 00/10/20 → integral/proporcional). O resultado sempre carrega `regraId` + `baseLegal` para trilha de auditoria.

## 10. Coexistência ICMS × IBS/CBS em 2026 (impacto no motor)

Em 2026 — **ano-teste** — o crédito de ICMS **não muda**: o motor de ICMS opera puro sob LC 87/96. O que existe de novo é a **alíquota-teste de IBS (0,1%) e CBS (0,9%)**, cujo valor pago é **compensável com PIS/COFINS** do mesmo período (não com ICMS) — e, na insuficiência de débitos de PIS/COFINS, compensável com outros tributos federais ou ressarcível em espécie *(verificado: LC 214/2025; Receita Federal, jun/2026)*. A inclusão do ICMS na base de IBS/CBS **não se aplica em 2026** (entendimento dos fiscos estaduais; debate para 2027+). O sistema deve, portanto, manter **dois motores paralelos** com vigências distintas — ICMS/PIS/COFINS (regime atual) e IBS/CBS (transição) — e nunca cruzar créditos entre eles neste exercício.

Sources:
- [Alíquota-teste de IBS e CBS (Tax Group)](https://www.taxgroup.com.br/solutions/aliquota-teste-de-ibs-e-cbs-guia-completo-de-como-vai-funcionar/)
- [Entenda a Reforma Tributária do Consumo (Receita Federal)](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-consumo/entenda)
- [Cronograma da Reforma Tributária / redução ICMS 2029-2032 (CRCSP)](https://online.crcsp.org.br/portal/noticias/noticia.asp?c=9044)
- [ICMS na base de cálculo da CBS/IBS na transição (Conjur)](https://www.conjur.com.br/2026-jan-06/icms-na-base-de-calculo-da-cbs-ibs-na-transicao-o-debate-de-2026-e-a-tendencia-de-inclusao-a-partir-de-2027/)
- [Crédito de ICMS de uso/consumo adiado para 2033 (Trajano Neto & Paciornik)](https://tnp.adv.br/en/23-01-2020-credito-do-icms-de-materiais-de-uso-ou-consumo-energia-e-comunicacao-e-adiado-para-2033/)
- [Art. 33 — LC 87/96 (Planalto)](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp87.htm)
- [Tema 201 / RE 593.849 (STF)](https://portal.stf.jus.br/jurisprudenciaRepercussao/tema.asp?num=201)
- [Tabela CST ICMS (Webmania)](https://ajuda.webmania.com.br/pt-BR/articles/12680777-cst-o-que-significa-cada-codigo-de-situacao-tributaria-do-icms)

---

# Crédito de PIS e COFINS sobre Entradas

## 1. O regime define o produto: quem tem (e quem não tem) direito a crédito

O direito ao crédito de PIS/COFINS é uma função direta do regime de apuração do contribuinte. APURAX precisa resolver isso **antes de processar qualquer NF-e de entrada** — é a primeira chave de roteamento do motor determinístico, porque um cálculo de crédito num cliente cumulativo é erro grosseiro, não otimização.

| Regime | Alíquotas | Crédito de PIS/COFINS sobre entradas? | Base legal |
|---|---|---|---|
| **Não-cumulativo** (Lucro Real, regra geral) | PIS 1,65% + COFINS 7,6% | **SIM** — desconta crédito das entradas do débito das saídas | Lei 10.637/2002, art. 3º; Lei 10.833/2003, art. 3º |
| **Cumulativo** (Lucro Presumido, regra geral) | PIS 0,65% + COFINS 3,0% | **NÃO** — vedação total ao crédito | Lei 9.718/1998; Lei 10.637/2002, art. 8º; Lei 10.833/2003, art. 10 |
| **Simples Nacional** | recolhe PIS/COFINS dentro do DAS (percentual do anexo) | **NÃO** (para o próprio optante) — tributação unificada, sem apuração de crédito | LC 123/2006, art. 23 |

**Deixar EXPLÍCITO no produto:** cliente **cumulativo ou Simples Nacional NÃO gera crédito de PIS/COFINS sobre entradas** (a vedação aqui é quanto à apuração de crédito *pelo próprio optante* — não se confunde com a possibilidade de o *adquirente não-cumulativo* creditar sobre compras feitas DE um fornecedor do Simples; ver §4). Para esses clientes, APURAX só deve trabalhar a frente de ICMS (e, na transição, IBS) — qualquer tela/relatório de "crédito de PIS/COFINS" deve ficar bloqueada ou marcada como não aplicável. Atenção a duas armadilhas que o motor precisa tratar:
- Empresa pode ter **atividades mistas** (parte da receita no cumulativo por força do art. 10 da Lei 10.833/2003, ex.: alguns serviços de telecom, transporte de passageiros), exigindo **rateio** do crédito proporcional à receita não-cumulativa.
- O regime é atributo do **adquirente** (cliente APURAX), declarado no onboarding e validado contra a EFD-Contribuições; **não** se infere da NF-e de entrada.

## 2. O que gera crédito no não-cumulativo (Lei 10.637/2002 e 10.833/2003, art. 3º)

Hipóteses de creditamento que APURAX deve reconhecer a partir da NF-e de entrada e de outras fontes (contratos, faturas de energia):

- **Bens adquiridos para revenda** (inciso I) — exceto os submetidos a monofásico/ST/alíquota zero (ver §4).
- **Bens e serviços utilizados como INSUMO** na produção/prestação de serviço (inciso II) — núcleo da zona cinzenta, tratado no §6.
- **Energia elétrica e térmica** consumida nos estabelecimentos (inciso III) — normalmente NF3e modelo 66 / conta de energia, não modelo 55. *(verificado: NF3e é o modelo 66, instituída pelo Ajuste SINIEF 01/19, em substituição ao modelo 6.)*
- **Aluguéis e arrendamento mercantil** de prédios, máquinas e equipamentos pagos a **pessoa jurídica** (incisos IV e V) — vedado se pagos a PF.
- **Armazenagem de mercadoria e frete na operação de venda** quando o ônus é do vendedor (inciso IX da Lei 10.833) — frete de **entrada** acompanha o regime do bem; CT-e modelo 57. *(verificado: o inciso IX cobre "armazenagem de mercadoria e frete na operação de venda, nos casos dos incisos I e II, quando o ônus for suportado pelo vendedor".)*
- **Depreciação/amortização de máquinas, equipamentos e outros bens do ativo imobilizado** adquiridos para produção/locação (incisos VI e VII) — crédito não é instantâneo na entrada; segue a regra de apropriação (ex.: 1/48, imediato para certos bens conforme legislação vigente).
- **Devoluções de vendas** cuja receita compôs faturamento tributado (Lei 10.833, art. 3º, VIII).

## 3. Extração do XML — grupos PIS e COFINS por item

Por item (`<det>`), o motor lê:
- Grupo **`<PIS>`**: sub-grupo conforme CST (`PISAliq`, `PISQtde`, `PISNT`, `PISOutr`), com `CST`, `vBC`, `pPIS` (alíquota %), `qBCProd`/`vAliqProd` (por unidade) e `vPIS`.
- Grupo **`<COFINS>`**: análogo (`COFINSAliq`, `COFINSQtde`, `COFINSNT`, `COFINSOutr`), com `CST`, `vBC`, `pCOFINS`, `vCOFINS`.
- Apoio cruzado: `CFOP` (natureza da operação — entrada começa com 1/2/3), `NCM` (essencial para identificar monofásico/alíquota zero via Tabela 4.3.x do SPED), `CST`/`CSOSN` de ICMS, `vProd`.

**Ponto crítico de modelagem:** o CST de PIS/COFINS que **importa para o crédito** é o da **operação de entrada na ótica do adquirente**, não necessariamente o CST que o fornecedor lançou na saída dele. O XML traz o CST sob a ótica do **emitente** (saída). Se o fornecedor vendeu mercadoria monofásica com CST de saída sujeito a alíquota zero na revenda, o adquirente revendedor **não credita**. Por isso a decisão de crédito **não pode** se basear cegamente no CST do XML — precisa cruzar **NCM + Tabelas 4.3.10 (monofásico/bebidas frias) e 4.3.13 (alíquota zero) do SPED** (a 4.3.10 foi atualizada em 30.03.2026 — verificado: versão 1.25, trata dos CST de saída 02 e 04), que é a fonte autoritativa para saber se aquele produto é monofásico/zero/ST. *(verificado: STJ, em repetitivo de 2022 — Tema 1.093/REsp 1.894.741 e correlatos —, fixou que não há direito a crédito de PIS/COFINS na aquisição de produtos sujeitos ao regime monofásico, reforçando essa trava.)*

## 4. Tabela CST PIS/COFINS de entrada → gera crédito?

CST de **entrada com direito a crédito** (faixa 50–56) e CST **sem direito** (faixa 70–75, e crédito presumido na faixa 60–67). A tabela oficial é a **4.3.4 do SPED EFD-Contribuições** (Tabela Código da Situação Tributária – CST-PIS/CST-COFINS). *(verificado: faixa 50–56 = créditos; 60–67 = crédito presumido; 70–75 = aquisições sem direito a crédito.)*

| CST | Descrição | Gera crédito? | Observação / base legal |
|---|---|---|---|
| **50** | Operação com direito a crédito — vinculada exclusivamente a receita tributada no mercado interno | **SIM** | Lei 10.637/02 e 10.833/03, art. 3º |
| **51** | Crédito vinculado exclusivamente a receita **não tributada** no mercado interno | SIM (com ressalva) | crédito existe, mas a vinculação afeta uso/ressarcimento |
| **52** | Crédito vinculado exclusivamente a receita de **exportação** | **SIM** | crédito + manutenção; gera saldo ressarcível (Lei 10.833, art. 6º) |
| **53** | Crédito vinculado a receitas tributadas e não tributadas (mercado interno) | SIM (rateio) | exige rateio proporcional |
| **54** | Crédito vinculado a receitas tributadas no MI e de exportação | SIM (rateio) | rateio |
| **55** | Crédito vinculado a receitas não tributadas no MI e de exportação | SIM (rateio) | rateio |
| **56** | Crédito vinculado a receitas tributadas e não tributadas no MI e exportação | SIM (rateio) | rateio |
| **60–66** | Crédito presumido (atividades agroindustriais e correlatas) | SIM, **presumido** | regra própria de percentual; não é crédito básico da entrada |
| **67** | Crédito presumido — outras operações | SIM, presumido | regra própria |
| **70** | Operação de aquisição **sem direito a crédito** | **NÃO** | aquisição que não autoriza crédito |
| **71** | Aquisição com **isenção** | **NÃO** | art. 3º, §2º, II das Leis 10.637/02 e 10.833/03 (com ressalva: isento usado como insumo de produto tributado pode creditar) |
| **72** | Aquisição com **suspensão** | **NÃO** | |
| **73** | Aquisição a **alíquota zero** | **NÃO** | art. 3º, §2º, II das Leis 10.637/02 e 10.833/03; consolidado na IN RFB 2.121/2022 |
| **74** | Aquisição **sem incidência** da contribuição | **NÃO** | |
| **75** | Aquisição por **substituição tributária** | **NÃO** | |
| **98** | Outras operações de entrada | analisar | exige análise caso a caso |
| **99** | Outras operações | analisar | exige análise caso a caso |

**Não geram crédito (independentemente do CST informado, por força do NCM/regime):** produtos **monofásicos** (combustíveis, **bebidas frias** — Tabela 4.3.10, autopeças do Anexo da Lei 10.485/2002, **fármacos/perfumaria** da Lei 10.147/2000), **substituição tributária**, **alíquota zero**, **suspensão**, **isenção** e **não incidência**. Também não gera crédito, em regra, a aquisição de **pessoa física/não contribuinte** (Lei 10.833, art. 3º, §2º, I).

**Correção importante — aquisição de optante do Simples Nacional GERA crédito básico:** ao contrário do que se costuma supor, a compra de **bens para revenda ou insumos feita de fornecedor optante do Simples Nacional** PERMITE ao adquirente não-cumulativo apurar crédito básico de PIS/COFINS (1,65% e 7,6% sobre o valor da aquisição), conforme **ADI RFB nº 15/2007** (interpretando o art. 3º, II das Leis 10.637/02 e 10.833/03). A vedação do art. 3º, §2º **não** alcança o Simples — alcança a aquisição de **pessoa física** e de bens/serviços **não sujeitos ao pagamento da contribuição** (isentos, não tributados, alíquota zero, não incidência). *(verificado: ADI RFB 15/2007 e jurisprudência da COSIT.)* O motor determinístico deve, portanto, tratar fornecedor Simples como **elegível ao crédito** (e não como bloqueio), ressalvadas as travas por natureza do produto (monofásico/ST/zero).

## 5. Apuração, saldo credor e ressarcimento

O motor modela a apuração como confronto **crédito da entrada × débito da saída**, por contribuição (PIS e COFINS separadamente), respeitando a vinculação por CST (mercado interno tributado / não tributado / exportação):

- **Saldo credor** acumulado quando crédito > débito. Crédito vinculado a **exportação** (CST 52) e a vendas com suspensão/alíquota zero mantém-se e é **ressarcível/compensável** via **PER/DCOMP** (Lei 10.833, art. 6º; IN RFB 2.055/2021).
- **Fonte e destino**: a **EFD-Contribuições** é a fonte de validação (regime, créditos já escriturados, CST praticados) e o **destino** do que APURAX apurar — o produto deve gerar os registros/valores conciliáveis com os blocos da EFD-Contribuições (registros M100/M105 PIS, M500/M505 COFINS, e detalhamento C100/C170/A100 etc.). Posicionar APURAX como camada que **identifica créditos não aproveitados** e devolve isso de forma rastreável para a escrituração.

## 6. Como o MOTOR DETERMINÍSTICO modela — e onde a IA entra (sem emitir o número)

**Motor determinístico** (regras versionadas por vigência da legislação, com base legal anexada a cada decisão):

```
entrada(item NF-e) → {
  regimeAdquirente            // não-cumulativo? senão creditoPermitido=false
  hipoteseCreditavel          // revenda | insumo | frete | aluguelPJ | ativo | energia | devolucao
  bloqueioPorNaturezaProduto  // monofásico/ST/zero/suspensão/isenção via NCM + Tabelas 4.3.x SPED
  fornecedorElegivel          // bloqueia PF e aquisições não sujeitas à contribuição; Simples É elegível (ADI 15/2007)
} ⇒ creditoPermitido (bool)
   + valorCredito (= vBC × pPIS / pCOFINS, ou apropriação p/ ativo)
   + baseLegal (lei, artigo, inciso, versão da regra)
   + vinculacaoReceita (define CST 50–56 e tratamento do saldo)
```

Regras determinísticas inegociáveis: o **valor** sai sempre do motor (a partir de `vBC`, `pPIS`/`pCOFINS`, `vPIS`/`vCOFINS` do XML, ou da regra de apropriação do ativo), nunca da IA.

**Onde a IA entra (classifica/valida/sinaliza, não calcula):**
- **Zona cinzenta do "insumo"** (Lei 10.833, art. 3º, II): o conceito é **essencialidade e relevância** ao processo produtivo, fixado pelo STJ no **REsp 1.221.170/PR (Tema 779)** e incorporado pelo **art. 176 da IN RFB 2.121/2022**. *(verificado: REsp 1.221.170/PR, julgado em 2018; art. 176 da IN RFB 2.121/2022 incorpora a tese de essencialidade ou relevância, com lista exemplificativa no §1º.)* Não há lista fechada — depende da atividade econômica do contribuinte (objeto social) e do uso concreto do bem. A IA (claude-opus-4-8) recebe descrição do item (`xProd`), `NCM`, CNAE/objeto social do cliente e **propõe** classificação "insumo creditável / não creditável / requer análise", com **justificativa e citação** (essencialidade × relevância), além de sinalizar **risco** de glosa. A classificação em massa de itens de baixa ambiguidade vai para claude-haiku-4-5.
- A IA **nunca** decide o crédito sozinha: ao precisar do número, faz **tool-use** chamando o motor; o motor confirma elegibilidade contra as regras versionadas e devolve `valorCredito` + `baseLegal`. A IA apenas **enquadra** o item numa hipótese; o motor **valida e quantifica**.
- Reforço jurisprudencial 2025: o **STF** validou que o legislador ordinário pode estabelecer restrições ao crédito, **preservando** o conceito de insumo do STJ. *(verificado: notícia do STF — leis 10.637/02 e 10.833/03 declaradas válidas, com manutenção do critério de essencialidade/relevância do STJ.)* Ou seja, a regra do motor deve modelar tanto a essencialidade/relevância quanto as vedações legais expressas, e a IA deve sinalizar quando as duas colidem.

## 7. Impacto da transição da Reforma Tributária em 2026 (verificado)

Em **2026** vigora o **período de teste/calibragem** da Reforma (EC 132/2023, LC 214/2025): **CBS a 0,9%** e **IBS a 0,1%**, coexistindo com PIS/COFINS/ICMS/ISS. *(verificado: alíquotas-teste de 0,9% (CBS) e 0,1% (IBS) em 2026; o valor é compensado com PIS/COFINS no mesmo período de apuração e, em regra, dispensado o recolhimento de quem cumpre as obrigações acessórias.)* Ponto operacional decisivo para APURAX: nesse ano de teste, o **valor recolhido de CBS/IBS é compensado com o devido de PIS/COFINS** no mesmo período de apuração — ou seja, o contribuinte ainda **apura PIS/COFINS normalmente** (e seus créditos de entrada continuam plenamente relevantes em 2026).

**Correção crítica de cronograma:** a extinção de PIS/COFINS **NÃO** é "progressiva até 2033". Pela **LC 214/2025 (arts. 378 a 383)**, **PIS e COFINS são extintos em 31/12/2026**, e a **CBS entra em cobrança efetiva (alíquota cheia) a partir de 01/01/2027**, substituindo integralmente as contribuições. O que se estende até **2033** é a extinção de **ICMS e ISS**, gradualmente substituídos pelo **IBS** (transição 2029–2032, extinção em 2033). *(verificado: Receita Federal e LC 214/2025 — PIS/COFINS extintos ao fim de 2026; CBS plena em 2027.)* Os **saldos credores de PIS/COFINS não aproveitados** até a data de extinção permanecem válidos e podem ser usados para compensar a CBS, ser ressarcidos em dinheiro ou compensados com outros tributos federais (LC 214/2025).

Implicação para o motor: manter o módulo de crédito PIS/COFINS **plenamente ativo em 2026** (e em 2027 ainda relevante para apuração de períodos anteriores, retificações, PER/DCOMP e aproveitamento de saldos remanescentes na virada para a CBS), mas **planejar a virada para a CBS já em 01/01/2027** — não em 2033. Em paralelo, iniciar a modelagem do **crédito amplo/financeiro da CBS** (não-cumulatividade plena da LC 214/2025) como nova frente versionada por vigência, incluindo a regra de **migração de saldo credor de PIS/COFINS para a CBS** — sem misturar as duas bases na mesma regra.

---

**Fontes consultadas (verificação jun/2026):**
- [Receita Federal — Entenda a Reforma Tributária do Consumo](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-consumo/entenda)
- [Câmara dos Deputados — Transição começa com testes de novos impostos em 2026](https://www.camara.leg.br/noticias/1237089-reforma-tributaria-comeca-fase-de-transicao-com-testes-de-novos-impostos-em-2026/)
- [Planalto — Lei Complementar 214/2025 (arts. 378–383, extinção de PIS/COFINS e transição CBS)](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm)
- [PGFN — Conceito de insumos e ajustes no creditamento (Tema 779 / IN 2.121/2022)](https://www.gov.br/pgfn/pt-br/cidadania-tributaria/por-assunto/pis-cofins-2/copy_of_nao-cumulatividade/conceito-de-insumos-e-ajustes-no-creditamento)
- [STF — valida leis que restringem aproveitamento de créditos de PIS/Cofins (conceito de insumo do STJ preservado)](https://portal.stf.jus.br/noticias/verNoticiaDetalhe.asp?idConteudo=498242&ori=1)
- [STJ — Repetitivo veda créditos de PIS/Pasep e Cofins sobre aquisição no regime monofásico (2022)](https://www.stj.jus.br/sites/portalp/Paginas/Comunicacao/Noticias/04052022-Repetitivo-veda-creditos-de-PISPasep-e-Cofins-sobre-aquisicao-no-regime-monofasico-e-fixa-outras-teses.aspx)
- [ADI RFB nº 15/2007 — créditos de PIS/COFINS em aquisições de optantes pelo Simples Nacional](http://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=5661)
- [SPED — Tabela 4.3.10 produtos monofásicos/bebidas frias, versão 1.25 (atualizada 30.03.2026)](http://sped.rfb.gov.br/arquivo/show/1638)

---

## Reforma Tributária 2026 e impacto arquitetural no APURAX: motor de regras dual-regime versionado por vigência

### 1. O contexto temporal que define o produto (jun/2026, confirmado via WebSearch)

A premissa de produto do APURAX em 2026 não é "apurar crédito de ICMS/PIS/COFINS com IA por cima" — é apurar **dois mundos fiscais simultâneos sobre a mesma NF-e de entrada**. Fatos confirmados em junho/2026:

- **Alíquotas-teste vigentes desde 01/01/2026**: CBS 0,9% e IBS 0,1% (total 1%), conforme art. 348 da LC 214/2025. São **informativas/calibradoras**, não arrecadatórias. (verificado: a alíquota de IBS de 0,1% se divide em 0,05% estadual + 0,05% municipal.)
- **Dispensa de recolhimento (art. 348, §§1º e 2º, LC 214/2025)** (verificado: a dispensa decorre dos §§1º e 2º, não apenas do §1º): o contribuinte que cumprir corretamente as obrigações acessórias — na prática, **destacar CBS/IBS no documento fiscal eletrônico (NF-e)** — fica dispensado do recolhimento em 2026. Se houver recolhimento, ele é **compensável com PIS/COFINS** devidos no mesmo período de apuração; na ausência de débitos suficientes, é compensável com **outros tributos federais** ou **ressarcível em até 60 dias** (verificado: prazo de 60 dias para ressarcimento).
- **Cronograma** (verificado): 2026 ano-teste; **2027** CBS em alíquota de referência/plena (estimativa de referência divulgada em torno de 8,8% — sujeita a calibração) e **extinção de PIS/COFINS**; IPI reduzido a **alíquota zero a partir de 2027** (salvo produtos com produção incentivada na ZFM, que mantêm IPI como instrumento de competitividade) com instituição do **Imposto Seletivo a partir de 2027**; **2029-2032** transição gradual ICMS/ISS → IBS (redução de ~10%/ano de ICMS/ISS com elevação proporcional do IBS); **2033** regime pleno (extinção definitiva de ICMS e ISS). (verificado: o **IBS permanece na alíquota simbólica de 0,1% em 2027 e 2028** — diferentemente da CBS, que assume alíquota cheia já em 2027 — só iniciando sua escalada em 2029.)
- **Paradigma do crédito (LC 214/2025)**: **não-cumulatividade plena com crédito financeiro amplo** — praticamente toda aquisição vinculada à atividade gera crédito (bens, serviços e direitos), em ruptura com o crédito físico restrito do ICMS atual. **Condição inafastável (art. 47, c/c art. 27)**: a apropriação do crédito pelo adquirente fica **condicionada à extinção do débito da operação anterior** — por compensação, pagamento pelo fornecedor, **recolhimento na liquidação financeira (split payment, arts. 31-35)** ou recolhimento pelo adquirente. Ou seja, o crédito é **financeiro existente**: depende do efetivo recolhimento do tributo na etapa anterior (verificado: art. 47 + art. 27, LC 214/2025). Vedações relevantes: bens/serviços de **uso ou consumo pessoal** do contribuinte ou de sócios/administradores (art. 57, que **não** geram crédito). Quanto a **bens de capital, os arts. 108-109 garantem crédito integral e imediato** observada a disciplina dos arts. 47-56 — trata-se de **garantia**, não de vedação (verificado: art. 108 assegura crédito pleno e imediato na aquisição de bens de capital).

Fontes: [Receita Federal — Entenda a Reforma](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-consumo/entenda), [LC 214/2025 — Planalto](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm), [Sindifisco — IBS/CBS em 2026 (art. 348)](https://sindifisco.org.br/noticias/ibs-e-cbs-em-2026-como-funciona-a-convivencia-com-os-tributos-atuais-segundo-a-lc-no-214-2025), [ConJur — direito ao crédito de IBS/CBS](https://www.conjur.com.br/2026-mai-18/direito-ao-credito-de-ibs-e-cbs-no-contexto-da-reforma-tributaria/), [Ágora Fiscal — não-cumulatividade do regime regular (art. 47/27, split payment)](https://agorafiscal.com.br/a-nao-cumulatividade-do-regime-regular-da-cbs-e-do-ibs-parte-3/), [SEFAZ-RO — bens de capital, arts. 108-109](https://reformatributaria.sefin.ro.gov.br/2025/10/24/bens-de-capital-cbs-ibs-uma-reflexao-acerca-dos-arts-108-e-109-da-lc-no-214-2025/), [CRCSP — regras de transição](https://online.crcsp.org.br/portal/noticias/noticia.asp?c=9044), [IPI/IS após 2027 — IOB](https://noticias.iob.com.br/ipi-reforma-tributaria/).

**Implicação direta:** a maior proposta de valor do APURAX em 2026-2032 não é o cálculo isolado de um regime, e sim a **reconciliação entre os dois mundos** — quanto de crédito a empresa captura hoje (legado) vs. quanto capturaria/capturará sob crédito financeiro amplo (CBS/IBS), e o delta de oportunidade que a transição abre.

### 2. O motor é versionado por vigência — não por "regime"

O erro de modelagem a evitar é tratar "ICMS/PIS/COFINS" e "CBS/IBS" como dois engines paralelos hard-coded. O modelo correto, coerente com o princípio arquitetural inegociável, é **um único motor determinístico que resolve regras por competência (data) e por aspecto tributário**. A mesma NF-e modelo 55 é submetida ao motor uma vez e produz **N projeções de crédito**, cada uma amarrada a um conjunto de regras vigentes naquela competência.

Modelagem de regra (em banco, atualizável sem deploy):

```
RuleSet {
  tributo        // ICMS | PIS | COFINS | CBS | IBS | IS
  vigencia_ini / vigencia_fim   // janela de aplicabilidade legal
  uf / municipio                // null = federal/nacional
  base_legal    // "LC 214/2025 art. 47", "RICMS/SP art. X"
  predicado     // condições sobre campos do XML (CST, CFOP, NCM, CSOSN...)
  formula_ref   // referência à função determinística de cálculo
  versao        // semver da regra; histórico imutável
}
```

A chave é que **a competência da NF-e (data de emissão / `dhEmi`, ou a competência de apuração) seleciona o RuleSet**, não uma flag de regime escolhida pelo usuário. Em 2026, a mesma nota cai sob:

- RuleSets legados (ICMS conforme UF, PIS/COFINS federal), **vigência aberta até 31/12/2026** para PIS/COFINS;
- RuleSets novos (CBS 0,9% / IBS 0,1%), **vigência iniciando 01/01/2026**.

Em 2027, o motor simplesmente para de selecionar os RuleSets de PIS/COFINS (vigência encerrada em 31/12/2026) e passa a aplicar **CBS em alíquota de referência/plena** — **sem alteração de código**, apenas pela expiração da vigência e ativação de novas regras em banco. Atenção a um ponto que o modelo de vigência captura naturalmente: **o IBS NÃO acompanha a CBS em 2027** — permanece em alíquota simbólica de 0,1% em 2027 e 2028, só escalando a partir de 2029 com a redução proporcional de ICMS/ISS (verificado). Ou seja, o RuleSet de IBS mantém alíquota-teste por mais dois exercícios enquanto o de CBS já salta — exatamente o tipo de assimetria que invalidaria um engine binário "regime antigo vs. regime novo" e que o versionamento por vigência+tributo resolve sem ramificação especial. Isso é o que torna o motor resiliente ao fato de que **a legislação ainda está em regulamentação** (regulamentos do IBS/CBS continuam sendo publicados ao longo de 2026): cada nova norma vira uma nova versão de RuleSet com `vigencia_ini` própria e base legal citada, carregada em banco.

### 3. Como uma NF-e de entrada gera os dois créditos

A leitura do XML alimenta os dois mundos a partir dos mesmos campos, mas com **lógicas de crédito diferentes**:

**Mundo legado (crédito físico restrito):**
- ICMS: lê `CST` (ex.: `00` em `ICMS00` com `vBC`/`vICMS` destacados → crédito cheio; `ICMSSN101` com `CSOSN 101` → crédito de SN limitado ao percentual informado em `pCredSN`/`vCredICMSSN`). Crédito condicionado a `CFOP` de entrada que admite crédito (ex.: 1.101/2.101 industrialização/comercialização vs. 1.556/2.556 uso e consumo, que **não** credita no modelo atual).
- PIS/COFINS: lê CST PIS/COFINS (`01`-`99`), `vBC`, `vPIS`, `vCOFINS`. Crédito não-cumulativo (CST `50`-`56`) condicionado a insumo/finalidade.

**Mundo CBS/IBS (crédito financeiro amplo):**
- A mesma aquisição que **não** creditava no legado por ser "uso e consumo" (CFOP 1.556/2.556) **passa a creditar** sob crédito financeiro amplo, desde que vinculada à atividade e não enquadrada nas vedações (uso/consumo pessoal — art. 57). **Ressalva inafastável**: o crédito de CBS/IBS é **condicionado à extinção do débito na etapa anterior** (art. 47 c/c art. 27 — pagamento/compensação/split payment/recolhimento pelo adquirente). Isso muda a modelagem: a *elegibilidade* do crédito (vínculo com a atividade) é uma coisa; a *existência financeira* dele (efetivo recolhimento a montante, hoje rastreado principalmente pelo split payment) é outra. O motor deve modelar as duas como predicados distintos e sinalizar quando o crédito é elegível porém ainda não "financeiramente existente". É exatamente aqui que mora a oportunidade que o produto descobre.
- A base é o destaque de CBS/IBS no XML (grupos da NT 2025.002 que inclui IBS/CBS/IS na NF-e a partir de jan/2026). Em 2026, como o valor é simbólico e o destaque pode estar ausente/em adaptação — **inclusive porque a regra de rejeição por ausência de IBS/CBS (UB12-10) teve sua validação técnica adiada, não havendo rejeição automática em janeiro/2026** (verificado) — o motor deve **calcular a projeção CBS/IBS a partir da base da operação** mesmo quando o XML ainda não traz o destaque, sinalizando que é projeção determinística, não valor destacado.

O resultado é uma estrutura de saída por nota:

```
CreditoApurado {
  chave_nfe, competencia
  legado:   { icms: {valor, base_legal, cfop_admite_credito}, pis, cofins }
  novo:     { cbs: {valor, base_legal}, ibs: {valor, base_legal},
              credito_existente_financeiramente }  // depende da extinção do débito a montante (art. 47/27)
  delta_oportunidade:  // crédito que existe no novo e não no legado
  flags_risco:         // ex.: "CFOP uso/consumo — credita em IBS, não em ICMS"
}
```

### 4. Onde a IA entra (e onde ela não entra)

Mantendo o princípio inegociável — **a LLM nunca emite o valor do imposto**:

- **claude-haiku-4-5** classifica em massa as linhas das NF-e (natureza do item por NCM/descrição, se é insumo/uso-consumo/ativo, se há divergência entre CFOP e CST declarados). Saída alimenta o **predicado** das regras.
- **claude-opus-4-8** atua no raciocínio fiscal de borda: interpretar se uma aquisição se enquadra em crédito financeiro amplo vs. vedação de uso/consumo pessoal (art. 57), ler PDFs/laudos, e **explicar** o delta de oportunidade ao usuário com a base legal.
- **Quando precisa de número, a IA chama o motor via tool-use** — ela diz "calcule o crédito IBS desta nota sob a regra vigente em 06/2026", o motor determinístico responde com valor + base legal + versão da regra, e a IA apenas redige/contextualiza. O número é sempre rastreável ao RuleSet versionado, nunca ao modelo.

### 5. Implicação para a ingestão (Distribuição DFe)

O pull via **NFeDistribuicaoDFe** (Ambiente Nacional, NSU sequencial por CNPJ/CPF) continua sendo o canal primário de captura de NF-e de entrada em jun/2026. Ponto a respeitar no fluxo (verificado): antes da manifestação do destinatário, o Ambiente Nacional disponibiliza apenas o **resumo da NF-e** (estrutura "resNFe") e eventos de cancelamento; o **XML completo** só é gerado com novo NSU para o destinatário **após** a manifestação ("Ciência da Operação", "Confirmação da Operação" ou "Operação não Realizada") — exceto eventos de cancelamento, disponibilizados mesmo sem manifestação. O APURAX, portanto, precisa orquestrar a manifestação para obter o XML íntegro de onde extrai `vBC`/`vICMS`/`vPIS`/`vCOFINS` e, agora, os grupos de IBS/CBS/IS. Ponto de atenção arquitetural: o layout da NF-e foi estendido pela **Nota Técnica 2025.002 (grupo UB de IBS/CBS/IS), com valor jurídico a partir de jan/2026**, então o parser de XML do APURAX precisa tolerar **schema com e sem os novos grupos** na mesma base (notas de competências distintas), versionando o leitor pela mesma chave de vigência que o motor usa. Fontes: [WS NFeDistribuicaoDFe — MOC/SPED](http://moc.sped.fazenda.pr.gov.br/NFeDistribuicaoDFe.html), [NT 2025.002 IBS/CBS/IS — Tecnospeed](https://blog.tecnospeed.com.br/nota-tecnica-reforma-tributaria-nfe-nfce/), [IOB — adiamento da rejeição por IBS/CBS não informado em janeiro/2026](https://noticias.iob.com.br/reforma-rejeicao-ibs-e-cbs/).

### 6. Risco e mitigação

A legislação infralegal do IBS/CBS segue em regulamentação durante 2026, e há litígios já desenhados (ex.: ICMS/ISS na base de CBS/IBS na transição, cumulatividade em serviços, e o desenho do crédito condicionado à extinção do débito a montante — que joga sobre o adquirente o risco de inadimplência do fornecedor). Mitigação no produto: **toda regra carregada em banco com `base_legal` e `versao`**, histórico imutável de RuleSets, e recálculo retroativo controlado — quando uma nova norma muda a interpretação de crédito, cria-se nova versão de RuleSet e o motor pode **reprocessar competências afetadas** mostrando o "antes/depois" auditável, sem perder a apuração original. Isso é o que sustenta a reconciliação dual-regime como proposta de valor central na janela 2026-2032.

---

# Fontes de Dados das NF-e de Entrada: Arquitetura de Ingestão para Aproveitamento de Créditos

## Desfazendo o equívoco fundamental: não há "API REST de download de notas"

Não existe — e não está no horizonte de jun/2026 — um endpoint REST público da Receita Federal ou das SEFAZ que permita "baixar minhas notas de entrada" com um token. Quem promete isso ou (a) revende acesso ao webservice SOAP de Distribuição DFe usando o certificado do cliente, ou (b) raspa o portal estadual. O APURAX precisa assumir, como premissa de produto, que **toda fonte automatizada de NF-e de entrada passa por SOAP + certificado digital + controle de estado por NSU**, e que isso carrega o problema de custódia de certificado descrito adiante. A pretensa simplicidade de "integração via API" é falsa; a complexidade está no estado incremental, na manifestação e no certificado.

## Fonte 1 — Upload manual de XML/ZIP (MVP imediato, sem certificado)

É o ponto de partida obrigatório porque **destrava valor sem tocar no problema de certificado**. O contribuinte já tem os XMLs autorizados das entradas (recebidos dos fornecedores ou exportados do ERP). O parser deve trabalhar sobre o grupo `<infNFe>` da NF-e modelo 55 e extrair, por item (`<det>`):

- **Identificação fiscal do item**: `NCM`, `CFOP`, `CEST` quando houver, e a descrição `xProd`.
- **ICMS** (grupo `<ICMS>`): `CST`/`CSOSN`, e conforme a tributação — `ICMS00` (tributação integral: `vBC`, `pICMS`, `vICMS`), `ICMS10` (tributada + ST: `vBCST`, `vICMSST`) e `ICMS70` (redução de base **com** ST: `pRedBC` + `vBCST`/`vICMSST`), `ICMS20` (redução de base sem ST: `pRedBC`), `ICMS60` (ICMS cobrado anteriormente por ST: `vICMSSTRet`) e os grupos do Simples `ICMSSN` (`CSOSN` 101/102/201/500). No `ICMSSN101` (e também `ICMSSN201`/`ICMSSN900`) há o crédito destacável via `pCredSN`/`vCredICMSSN`. O `CSOSN 101` é central porque carrega o crédito de ICMS transferível por fornecedor do Simples — valor que pode ser aproveitado pelo adquirente do regime normal nos termos do **art. 23 da LC 123/2006** (verificado: campo `vCredICMSSN` é exatamente "valor do crédito do ICMS que pode ser aproveitado nos termos do art. 23 da LC 123", restrito aos grupos `ICMSSN101`, `ICMSSN201` e `ICMSSN900`).
- **PIS/COFINS** (grupos `<PIS>`/`<COFINS>`): `CST` PIS/COFINS (01 a 99). Atenção crítica: **os CST 01 a 09 são de SAÍDA/receita; os CST 50 a 75 e 98/99 é que são os de ENTRADA/aquisição** — a elegibilidade ao crédito está nestes últimos, não nos primeiros (verificado contra a Tabela CST-PIS/COFINS oficial). Mapa correto (verificado): SAÍDA — **01** alíquota básica, **02** alíquota diferenciada, **03** alíquota por unidade de medida, **04** monofásica – revenda a alíquota zero, **05** ST, **06** alíquota zero, **07** isenta, **08** sem incidência, **09** suspensão. ENTRADA/aquisição — **50 a 56** com direito a crédito (vinculação da entrada a receita tributada / não tributada / exportação), **60 a 66** crédito presumido, **70** aquisição **sem** direito a crédito, **71** aquisição com isenção, **72** com suspensão, **73** a alíquota zero, **74** sem incidência, **75** por ST; **98** outras operações de entrada, **99** outras operações. Extrair `vBC`, `pPIS`/`pCOFINS`, `vPIS`/`vCOFINS`.
- **IPI** (`<IPI>`): `CST` IPI, `vIPI` — relevante para o custo e para a base de PIS/COFINS.
- **Totais** (`<total><ICMSTot>`) para reconciliação: `vNF`, `vProd`, `vICMS`, `vPIS`, `vCOFINS`, `vST`.

Validações de ingestão que NÃO são cálculo de crédito (logo, podem ficar antes do motor): assinatura digital e schema XSD, situação da chave de acesso (autorizada vs cancelada vs denegada — uma nota cancelada não gera crédito), e detecção de duplicidade por chave de 44 dígitos. O `nProt` e o status devem ser confirmados; XML em mãos não prova que a nota está autorizada hoje.

Limite honesto do upload: depende da disciplina do cliente em juntar os arquivos, e não captura notas que ele não tem (ex.: emitidas contra o CNPJ mas nunca recebidas). Por isso é MVP, não destino.

## Fonte 2 — SPED (EFD-ICMS/IPI e EFD-Contribuições): o melhor ponto de partida prático

**Recomendo priorizar SPED logo após o upload de XML, e acima do pull na SEFAZ**, por três razões: o arquivo já existe (a empresa entrega mensalmente), não exige certificado para ingerir (é upload do `.txt`), e traz o crédito **já escriturado** — o que dá ao APURAX uma baseline contra a qual o motor determinístico calcula o "crédito devido" e mede a lacuna (crédito não aproveitado). Reconstruir tudo do XML é refazer trabalho que a escrituração já consolidou.

- **EFD-ICMS/IPI**: registro **C100** (documento/nota) e **C170** (itens), com `CST_ICMS`, `CFOP`, `VL_BC_ICMS`, `VL_ICMS`, `ALIQ_ICMS`, e os campos de PIS/COFINS por item. Apuração do ICMS no bloco **E110** (e E111/E116). É a fonte para identificar créditos de ICMS sobre entradas que deixaram de ser escriturados ou foram escriturados a menor.
- **EFD-Contribuições**: blocos **M100/M105** (créditos de PIS apurados e detalhamento da base) e **M500/M505** (créditos de COFINS), além de **C100/C170/C175** e do bloco **A** (serviços). É aqui que mora a maior parte da oportunidade não-cumulativa de PIS/COFINS (insumos, energia, fretes, locação).

Atenção temporal crítica (verificado — NT 011/2026 da RFB, publicada em sped.rfb.gov.br): a **EFD-Contribuições deixa de apurar fatos geradores novos de PIS/COFINS a partir de jan/2027**, permanecendo disponível por pelo menos ~5 anos só para consulta, retificação e gestão de créditos acumulados até 31/12/2026. Não há alteração de layout em 2026 para registrar CBS/IBS/IS na EFD-Contribuições. Isso reforça a urgência do produto: **a janela para mapear e recuperar crédito de PIS/COFINS sobre o passado (período decadencial de 5 anos) é agora** — o SPED histórico é a mina, e ela para de receber dados novos em ~6 meses. Já a EFD-ICMS/IPI segue (verificado: Guia Prático versão 3.2.0 e PVA 6.0.0 vigentes a partir de 01/01/2026 — publicados em 30/09/2025; já há versão 3.2.2 posterior do Guia Prático, então trate "3.2.x" como a família vigente) e — ponto importante — **CBS/IBS/IS NÃO entram nos blocos da EFD-ICMS/IPI, EFD-Contribuições, ECD ou ECF**; os novos tributos terão obrigação acessória própria. Portanto o SPED tradicional continua sendo a fonte canônica do mundo "antigo" (ICMS/PIS/COFINS) durante toda a transição.

## Fonte 3 — NF-e Distribuição DFe (pull na SEFAZ, Ambiente Nacional): a fonte automatizada de regime

É o destino para automação contínua, mas o de maior atrito técnico e de segurança. Mecânica confirmada (NT 2014.002):

- **Webservice SOAP `NFeDistribuicaoDFe`** no Ambiente Nacional, que entrega os documentos destinados ao CNPJ (= notas de entrada). **Exige certificado digital** PJ válido em toda chamada.
- **Controle incremental por NSU** (Número Sequencial Único): o cliente guarda o `ultNSU` e consulta a partir dele (`distNSU`); a SEFAZ devolve lotes (com `maxNSU`) até esgotar. Há também consulta por chave (`consChNFe`) e por NSU específico (`consNSU`). Os documentos ficam disponíveis por **até 90 dias** após a recepção no Ambiente Nacional (verificado: tanto `distNSU` quanto `consChNFe`/`consNSU` operam sobre a janela dos últimos 90 dias; após esse prazo a NF-e não é mais recuperável por esses serviços) — logo, o pull não pode atrasar mais que isso sem perder notas.
- **Resumo vs NF-e completa**: sem manifestação, a SEFAZ entrega apenas o **resumo** (`resNFe` — chave, emitente, valor, situação), não o XML completo. A **NF-e completa** só é liberada após **manifestação do destinatário** (eventos: Ciência da Operação, Confirmação da Operação, Desconhecimento da Operação, Operação não Realizada). Isso tem consequência direta de produto: para o APURAX ter o detalhe por item (CST/CFOP/vICMS necessários ao motor de crédito), ele precisa orquestrar a manifestação — idealmente "Confirmação da Operação" para notas legítimas — o que é uma **ação fiscal em nome do cliente** e exige consentimento explícito e trilha de auditoria.
- **Limites de consulta / antiabuso** (verificado contra NT 2014.002 e regras de sincronização): há throttling rigoroso. Ao receber **cStat 137** ("Nenhum documento localizado para o destinatário/interessado"), o consumidor deve **aguardar 1 hora** antes de nova consulta; consultar de novo dentro desse intervalo gera **uso indevido**, retorna a **rejeição 656 ("Consumo Indevido")** e bloqueia o CNPJ/CPF por 1 hora. O **cStat 138** ("Documento(s) localizado(s)") é a resposta normal quando há documentos — nesse caso pode-se seguir consultando avançando o NSU até esgotar. O agendamento deve respeitar esse intervalo mínimo por CNPJ e nunca entrar em loop após 137.

Implementação: worker BullMQ por tenant, job recorrente que (1) carrega `ultNSU`, (2) chama o WS assinando com o certificado, (3) persiste resumos/XMLs, (4) avança `ultNSU`, (5) enfileira manifestação quando aplicável. Idempotência por chave de 44 dígitos compartilhada com a Fonte 1 (upload), para que XML manual e DFe convirjam no mesmo registro.

## Fonte 4 — DANFE em PDF (OCR/IA): último recurso, baixa confiança

Só quando não há XML nem SPED nem DFe (ex.: nota de fornecedor que sumiu, papel digitalizado). Aqui a IA tem papel legítimo de **extração** (ler o PDF e propor CST/CFOP/NCM/valores), mas o resultado é **dado de baixa confiança** e nunca deve alimentar o motor de crédito sem confirmação humana. Mantém-se o princípio inegociável: o PDF/OCR produz um rascunho classificável; o número do crédito sai do motor determinístico, com flag de "origem OCR — requer validação". A chave de acesso impressa no DANFE deve ser usada para tentar puxar o XML real via `consChNFe` na Distribuição DFe antes de confiar no OCR (lembrando que `consChNFe` só recupera documentos dos últimos 90 dias).

## Custódia de certificado por tenant: o problema espinhoso

Sem resolver isto, a Fonte 3 e qualquer assinatura de evento (manifestação) não saem do papel.

- **A1 (.pfx, em arquivo)** — compatível com SaaS. Arquitetura recomendada: **envelope encryption**. Uma DEK (data encryption key) **por tenant** cifra o `.pfx`; a DEK é cifrada por uma master key no **KMS** (AWS KMS / equivalente) — o `.pfx` cifrado e a DEK cifrada ficam no banco/S3, a master key nunca sai do KMS. O material descriptografado (chave privada) só existe **em memória do worker que assina**, pelo tempo da assinatura, e nunca é logado nem persistido em claro. Rotação de DEK e revogação por tenant. Trilha de auditoria de cada uso do certificado (quem/quando/qual NSU). A senha do PFX é segredo separado, também sob envelope.
- **A3 (token/cartão/HSM, não-exportável)** — **quebra o SaaS puro**, porque a chave privada não pode sair do dispositivo. Saídas: (a) **HSM em nuvem** (CloudHSM / Dinamo / similar) onde a empresa instala o certificado e o APURAX assina via PKCS#11 sem extrair a chave; (b) **agente local** instalado na infraestrutura do cliente, que detém o A3 e expõe um endpoint de assinatura para o backend — o APURAX manda o conteúdo a assinar, recebe a assinatura, nunca vê a chave. O agente local é o caminho mais realista para clientes que só têm A3, e vira um diferencial de segurança vendável.
- **Procuração eletrônica (e-CNPJ → e-CPF do contador / certificado da contabilidade)**: muitos clientes operam via contabilidade. Vale suportar o modelo em que o certificado custodiado é o do escritório contábil com procuração eletrônica para os CNPJs atendidos — isso reduz o número de certificados a custodiar e casa com o canal de vendas (contadores).

## Ordem de implementação recomendada (MVP → regime)

1. **Upload de XML/ZIP** — destrava valor sem certificado; valida parser e o contrato com o motor determinístico. (MVP, semanas 1-x.)
2. **Ingestão de SPED (EFD-Contribuições primeiro, depois EFD-ICMS/IPI)** — maior ROI imediato: traz crédito já escriturado, permite medir a lacuna no período decadencial de 5 anos e aproveita a **urgência regulatória** (EFD-Contribuições congela em jan/2027). Não exige certificado.
3. **Distribuição DFe (A1 + envelope encryption + manifestação)** — automação de regime para o fluxo contínuo de novas entradas; introduz a custódia de certificado de forma controlada (só A1 primeiro).
4. **A3 via agente local / HSM em nuvem** — atende a base instalada de A3 sem comprometer o modelo SaaS.
5. **DANFE PDF/OCR** — fechamento de lacunas, sempre com confirmação humana e tentativa prévia de recuperar o XML real pela chave.

Racional da ordem: cada degrau adiciona uma fonte mais valiosa **e** mais arriscada que o anterior, permitindo validar o motor de crédito determinístico contra dados reais (upload, depois SPED) antes de assumir o risco operacional/jurídico de custodiar certificados e manifestar notas em nome do cliente. A transição da Reforma reforça a sequência: o crédito do **modelo antigo** (ICMS/PIS/COFINS, base das Fontes 1-2-3) ainda é o produto principal em 2026, com 2026 sendo o "período de teste"/piloto — CBS a **0,9%** e IBS a **0,1%**, compensáveis com PIS/COFINS e, na prática, com **dispensa de recolhimento** para quem cumprir integralmente as obrigações acessórias (verificado: art. 348 da LC 214/2025; multas efetivas só a partir de 2027). O **crédito financeiro amplo** do novo modelo (verificado: LC 214/2025, **art. 47** — apropriação ampla de crédito de IBS/CBS condicionada à extinção do débito na etapa anterior; **exceções no art. 57**, notadamente bens/serviços de uso e consumo pessoal) tornará a qualidade do documento fiscal eletrônico (campos corretos conforme as notas técnicas de RTC da NF-e) ainda mais determinante do direito ao crédito, o que valida o investimento na infraestrutura de ingestão estruturada desde já.

## Fontes
- [NT 2014.002 — Web Service de Distribuição de DF-e (Portal NF-e)](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=wLVBlKchUb4%3D)
- [Distribuição DFe — regras de sincronização, cStat 137/138 e rejeição 656 (Tecnospeed)](https://atendimento.tecnospeed.com.br/hc/pt-br/articles/10794811536791)
- [NT 011/2026 — Descontinuidade da EFD-Contribuições (SPED/RFB)](http://sped.rfb.gov.br/pagina/show/8017)
- [Guia Prático EFD ICMS/IPI 3.2.0 e PVA 6.0.0, vigência jan/2026 (TOTVS / FENACON)](https://fenacon.org.br/noticias/nova-versao-do-guia-pratico-e-do-programa-da-efd-icms-ipi-entram-em-vigor-em-janeiro-de-2026/)
- [Alíquota-teste de IBS e CBS — guia (Tax Group)](https://www.taxgroup.com.br/solutions/aliquota-teste-de-ibs-e-cbs-guia-completo-de-como-vai-funcionar/)
- [Orientações da Reforma Tributária para 2026 (Receita Federal)](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-consumo/orientacoes-2026)
- [LC 214/2025 — texto (Planalto)](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm)
- [Direito ao crédito de IBS e CBS — arts. 47 e 57 (Conjur, mai/2026)](https://www.conjur.com.br/2026-mai-18/direito-ao-credito-de-ibs-e-cbs-no-contexto-da-reforma-tributaria/)
- [Tabela CST PIS/COFINS — códigos 01-09 (saída) e 50-99 (entrada) (Boletim Contábil)](https://www.boletimcontabil.com.br/bolet2/cstpis.html)
- [vCredICMSSN — crédito do ICMS art. 23 LC 123 nos grupos ICMSSN101/201/900 (Tecnospeed)](https://atendimento.tecnospeed.com.br/hc/pt-br/articles/360019622434)
- [CST ICMS 70 — redução de base + ST (Cosmos/Bluesoft)](https://cosmos.bluesoft.com.br/tabelas/cst/icms/70-com-reducao-de-base-de-calculo-e-cobranca-do-icms-por-substituicao-tributaria)