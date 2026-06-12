# CBS/IBS (reforma 2026) — layout + crédito + delta (VERIFICADO)

# Dual-regime CBS/IBS x Legado na NF-e — especificação consolidada para a Etapa 9 do Apurax

Documento técnico para codar. Datado de jun/2026. Verificado adversarialmente contra fontes oficiais (Receita Federal, Planalto/LC 214, Portal NF-e, SEFAZ-AM, Senado) e técnicas (Tecnospeed, NDD, NotaGateway, contadores.cnt.br, FlexDocs). Pontos ainda em regulamentação marcados como **(INCERTO: ...)**. É DADO para escrever código — não recapitula código existente.

> **CORREÇÃO CRÍTICA ao material de entrada:** as datas de obrigatoriedade estavam erradas. A rejeição da NF-e por falta de IBS/CBS para CRT=3 (regime normal) **NÃO** começa em 05/01/2026 — começa em **03/08/2026 em produção** (homologação 01/07/2026), conforme o cronograma **revisado da NT 2025.002 v1.40 (20/05/2026)**. A data 05/01/2026 / regra UB12-10 era do cronograma antigo (v1.30) e foi **adiada**. Isso muda o seletor "essa nota entra no cálculo CBS/IBS?" — ver §1 e §5.

---

## PARTE I — LAYOUT IBS/CBS NA NF-e (PARA O PARSER)

### 0. Versão vigente do leiaute / NT (jun/2026)

- **NT 2025.002-RTC** (IBS/CBS/IS) — cria todos os grupos IBS/CBS/IS na NF-e (mod. 55) e NFC-e (mod. 65).
- **Versão vigente: v1.40, publicada em 20/05/2026** pela Receita Federal + Comitê Gestor do IBS + ENCAT. **[CONFIRMADO]** por múltiplas fontes (contadores.cnt.br, NotaGateway, NDD). **(INCERTO:** se há revisão posterior — v1.41+ — entre 20/05 e a data de deploy; revalidar no portal NF-e antes de congelar o parser.)
- Schema XML da NF-e segue `versao="4.00"`. **(INCERTO:** identificador interno exato do pacote de schemas RTC vigente em jun/2026 — confirmar no Pacote de Liberação do portal.)

Fonte primária a validar antes do deploy: portal NF-e/Fazenda — documentação RTC e Esquemas XML (`Portal Nacional NF-e → Documentos → Esquemas XML`).

---

### 1. Convivência LEGADO × NOVO no mesmo XML (decisivo para o dual-regime)

**[CONFIRMADO] Sim — em 2026 os dois conjuntos coexistem no mesmo item da mesma NF-e** (período de "dupla conformidade").

- ICMS, IPI, PIS, COFINS e ISS **permanecem plenamente exigíveis e preenchidos** nos grupos legados (`det/imposto/ICMS`, `/IPI`, `/PIS`, `/COFINS`).
- **Adicionalmente**, o item carrega o novo grupo `det/imposto/IBSCBS`.
- **Implicação para o Apurax:** ao parsear UMA NF-e de entrada de 2026, você terá simultaneamente os campos do **crédito legado** (já implementado) e os do **crédito novo CBS/IBS**. O motor versionado calcula os dois sobre o mesmo XML; o delta é a diferença. **Não há XML separado.**

**Datas de obrigatoriedade (CORRIGIDAS — cronograma v1.40):**

| Marco | Data | O que ocorre |
|---|---|---|
| Caráter informativo / preenchimento | desde 01/01/2026 | Obrigação legal de destacar IBS/CBS existe, mas **sem rejeição automática** por omissão. Destaque é informativo. **[CONFIRMADO]** |
| Homologação obrigatória (CRT=3) | **01/07/2026** | Ambiente de homologação passa a **rejeitar** NF-e sem os campos IBS/CBS para regime normal. **[CONFIRMADO]** |
| **Produção obrigatória (CRT=3)** | **03/08/2026** | Rejeição automática em **produção** se os campos IBS/CBS não vierem preenchidos (regime normal). **[CONFIRMADO]** |
| Referenciamento de devoluções | 01/09/2026 | Cronograma próprio dentro da v1.40 (item específico, não geral). **[CONFIRMADO]** |
| Simples Nacional / MEI (CRT 1, 2, 4) | a partir de 2027 (ref. 04/01/2027) | Em 2026 NÃO precisam informar CST/cClassTrib novos. Obrigatoriedade só em 2027. **[CONFIRMADO]** |

> **Consequência para o seletor de elegibilidade do dual-regime:** NF-e de entrada **CRT=3 emitidas antes de 03/08/2026** podem **legitimamente NÃO ter** o grupo `IBSCBS` (ou tê-lo incompleto), sem ser inválidas. Logo: **a ausência de `IBSCBS` NÃO é erro** — é o caso "nota legada pura". Trate `IBSCBS presente e preenchido` como condição para entrar no cálculo CBS/IBS; `IBSCBS ausente` → só crédito legado. Em 2026 espere uma **base mista** de notas com e sem o grupo novo.

**Alíquotas-teste de 2026 [CONFIRMADO]:**
- **CBS = 0,9%**
- **IBS total = 0,1%**, repartido como **IBS-UF (pIBSUF) = 0,1%** e **IBS-Municipal (pIBSMun) = 0%**. **[CONFIRMADO** por SEFAZ-AM: "state IBS 0.1%, municipal IBS 0%"; resolve o INCERTO anterior sobre a repartição.**]**
- Em 2026 há **dispensa de recolhimento** se cumpridas as obrigações acessórias.

---

### 2. Estrutura do item — `det/imposto/IBSCBS` (árvore literal)

**[CONFIRMADO]** `CST` e `cClassTrib` ficam **diretamente sob `IBSCBS`** (no Grupo UB), são **únicos por item** e **compartilhados** por IBS, CBS e IS. **NÃO** se repetem dentro de `gIBSUF`/`gIBSMun`/`gCBS`. A base `vBC` também é **única** dentro de `gIBSCBS` (idêntica para IBS e CBS).

```
det/imposto/IBSCBS
├── CST               (3 dígitos — tag em MAIÚSCULAS: "CST", não "cST")
├── cClassTrib        (6 dígitos — 3 primeiros = CST; ver §5)
├── indDoacao         (opcional)
├── gIBSCBS                        (tributação regular ad valorem)
│   ├── vBC                        ← BASE ÚNICA, COMPARTILHADA IBS + CBS
│   ├── gIBSUF                     (IBS — parcela ESTADUAL)
│   │   ├── pIBSUF
│   │   ├── gDif      (opc)  → pDif, vDif
│   │   ├── gDevTrib  (opc)  → vDevTrib
│   │   ├── gRed      (opc)  → pRedAliq, pAliqEfet
│   │   └── vIBSUF
│   ├── gIBSMun                    (IBS — parcela MUNICIPAL)
│   │   ├── pIBSMun                 (= 0 em 2026)
│   │   ├── gDif / gDevTrib / gRed (mesmo layout do gIBSUF)
│   │   └── vIBSMun
│   ├── vIBS                       ← total IBS do item (vIBSUF + vIBSMun)
│   ├── gCBS                       (CBS — federal)
│   │   ├── pCBS
│   │   ├── gDif / gDevTrib / gRed (mesmo layout)
│   │   └── vCBS
│   ├── gTribRegular  (opc — tributação regular p/ ZFM/ALC e casos específicos)
│   │   ├── CSTReg / cClassTribReg
│   │   ├── pAliqEfetRegIBSUF / vTribRegIBSUF
│   │   ├── pAliqEfetRegIBSMun / vTribRegIBSMun
│   │   └── pAliqEfetRegCBS / vTribRegCBS
│   ├── gCredPresOper (opc — UB120) → cCredPres, pCredPres, vCredPres   ← CRÉDITO PRESUMIDO (ver nota)
│   └── gALCZFMCBS    (opc — UB66a) → crédito presumido / tratamento ZFM/ALC (Suframa)
├── gIBSCBSMono       (opc — monofásico, ex. combustíveis, CST 620)
└── gIS                               (Imposto Seletivo, CST/cClassTrib próprios)
```

**Crédito presumido no item (CORREÇÃO ao INCERTO da entrada):** na **v1.40** o grupo de crédito presumido por operação é **`gCredPresOper` (UB120)**, com `cCredPres`, `pCredPres`, `vCredPres`. O preenchimento respeita o indicador `indCredPresOper` derivado do `cClassTrib`, e diferencia `cCredPres` por tributo (IBS vs CBS) com **datas de vigência distintas** (afeta os códigos cCredPres 3, 8, 9, 12). Para ZFM/ALC há grupo específico **`gALCZFMCBS` (UB66a)** (exige documentação de processo Suframa). Os antigos `gIBSCredPres`/`gCBSCredPres` (marcados obsoletos no FlexDocs) **foram substituídos** por esta estrutura. **(INCERTO:** posição/cardinalidade exatas de `gCredPresOper`/`gALCZFMCBS` no XSD — confirmar no schema oficial antes de codar a extração de crédito presumido.)

**Observações:**
- Grupos `gDif` (diferimento), `gDevTrib` (devolução), `gRed` (redução de alíquota) existem **dentro de cada** subgrupo (UF, Mun, CBS), **mesmo layout**. **[CONFIRMADO]**
- IBS é **bipartido**: crédito IBS do item = `vIBSUF + vIBSMun`.
- IBS/CBS são **"por fora"**: somam ao `vNF` como tributo, mas **não compõem o total da operação** para pagamento em 2026 (destaque informativo).

#### Caminhos EXATOS para fast-xml-parser

Namespace `http://www.portalfiscal.inf.br/nfe`; configure o parser para ignorar prefixos e use os nomes locais. `det` é **array** (atributo `@_nItem`). Caminho base: `NFe.infNFe.det[i].imposto`.

| Campo | Caminho |
|---|---|
| CST IBS/CBS | `IBSCBS.CST` |
| Classificação tributária | `IBSCBS.cClassTrib` |
| Base compartilhada | `IBSCBS.gIBSCBS.vBC` |
| Alíquota IBS estadual | `IBSCBS.gIBSCBS.gIBSUF.pIBSUF` |
| Valor IBS estadual | `IBSCBS.gIBSCBS.gIBSUF.vIBSUF` |
| Alíquota IBS municipal | `IBSCBS.gIBSCBS.gIBSMun.pIBSMun` |
| Valor IBS municipal | `IBSCBS.gIBSCBS.gIBSMun.vIBSMun` |
| Valor IBS total do item | `IBSCBS.gIBSCBS.vIBS` |
| Alíquota CBS | `IBSCBS.gIBSCBS.gCBS.pCBS` |
| Valor CBS | `IBSCBS.gIBSCBS.gCBS.vCBS` |
| Crédito presumido (código) | `IBSCBS.gIBSCBS.gCredPresOper.cCredPres` |
| Crédito presumido (valor) | `IBSCBS.gIBSCBS.gCredPresOper.vCredPres` |
| Diferimento IBS-UF | `IBSCBS.gIBSCBS.gIBSUF.gDif.vDif` |
| Devolução IBS-UF | `IBSCBS.gIBSCBS.gIBSUF.gDevTrib.vDevTrib` |
| Redução alíquota CBS | `IBSCBS.gIBSCBS.gCBS.gRed.pAliqEfet` |

Config recomendada do fast-xml-parser:
- `removeNSPrefix: true`
- `parseTagValue: false` — **mantenha strings**; não deixe o parser converter `pCBS="0.9000"`/`vBC` em number (números fiscais têm casas fixas; conversão pode perder precisão). Converta você mesmo via Decimal controlado.
- `isArray` customizado para `det` (sempre array) e para subgrupos opcionais que podem repetir.
- **Seletor do dual-regime:** ausência de `IBSCBS` ⇒ nota legada pura (só crédito legado); presença e preenchimento ⇒ entra no cálculo CBS/IBS.

---

### 3. Totais — `infNFe.total.IBSCBSTot` (Grupo W03)

IBS/CBS/IS são "por fora", somam ao total. Árvore literal:

```
total/IBSCBSTot
├── vBCIBSCBS                 (BC total IBS/CBS)
├── gIBS
│   ├── gIBSUF   → vDif, vDevTrib, vIBSUF
│   ├── gIBSMun  → vDif, vDevTrib, vIBSMun
│   ├── vIBS                  (IBS total = vIBSUF + vIBSMun)
│   ├── vCredPres
│   └── vCredPresCondSus
├── gCBS
│   ├── vDif / vDevTrib
│   ├── vCBS                  (CBS total)
│   ├── vCredPres
│   └── vCredPresCondSus
├── gMono       (monofásico) → vIBSMono/vCBSMono, vIBSMonoReten/..., vIBSMonoRet/...
└── gEstornoCred (opcional, estorno de crédito)
```

Caminhos (`NFe.infNFe.total`): `IBSCBSTot.vBCIBSCBS`, `IBSCBSTot.gIBS.vIBS`, `IBSCBSTot.gIBS.gIBSUF.vIBSUF`, `IBSCBSTot.gIBS.gIBSMun.vIBSMun`, `IBSCBSTot.gCBS.vCBS`, `IBSCBSTot.gIBS.vCredPres`, `IBSCBSTot.gCBS.vCredPres`.

> **Para o dual-regime, some item-a-item** (a partir de `det[].imposto.IBSCBS.gIBSCBS`) e use `IBSCBSTot` como **conferência/validação cruzada** — mais auditável que confiar no total emitido.

---

### 4. Tabela CST IBS/CBS (3 dígitos)

| CST | Situação tributária | Relevância p/ crédito |
|---|---|---|
| **000** | Tributação integral | Crédito cheio (regra geral do crédito financeiro amplo) |
| **010** | Alíquotas uniformes — setor financeiro | Caso especial |
| **011** | Alíquotas uniformes reduzidas | Caso especial |
| **200** | Alíquota reduzida | Crédito proporcional à tributação |
| **220 / 221** | Alíquota fixa / fixa proporcional | Especial |
| **222** | Redução de base de cálculo | Crédito sobre base reduzida |
| **400** | Isenção | Em regra, **sem** crédito ao adquirente |
| **410** | Imunidade e não incidência | **Sem** crédito |
| **510 / 515** | Diferimento (c/ ou s/ redução) | Crédito condicionado (`gDif`) |
| **550** | Suspensão | Condicionado (`vCredPresCondSus`) |
| **620** | Tributação monofásica | Tratamento `gIBSCBSMono`/`gMono` |
| **800** | Transferência de crédito | Caso especial |
| **810 / 811** | Ajustes (ZFM) | Especial |
| **820** | Tributação em documento específico | Especial |
| **830** | Exclusão de base de cálculo | Especial |

**(INCERTO:** a lista vem de fontes secundárias, não do XSD oficial. **Antes de hard-codar CST→regra**, baixe a **tabela oficial de CST** e a de **cClassTrib** do portal NF-e — publicadas como anexos. A semântica de crédito (coluna direita) é **interpretação da LC 214/2025**, não está literal na tabela; deve virar `RegraCredito` versionada com base legal citada.)

---

### 5. cClassTrib (Código de Classificação Tributária)

- **O que é:** código que vincula o item ao **dispositivo específico da LC 214/2025** (artigo/inciso que fundamenta o tratamento). Dá rastreabilidade à base legal — exatamente o que o motor determinístico do Apurax precisa para auditar.
- **Formato: 6 dígitos.** **3 primeiros = CST**; 3 finais = sequencial que aponta o artigo. **Exemplo confirmado:** `200034` → CST `200` (alíquota reduzida) + `034` (alimentos para consumo humano, Anexo VII, **art. 135** da LC 214/2025). **[CONFIRMADO]** o formato 6 dígitos e a composição. **(INCERTO:** se 100% dos códigos da tabela mantêm rigidamente 6 dígitos — confirmar no anexo oficial.)
- **Obrigatório** junto com CST a partir de 01/01/2026 para regime normal (CRT=3); para Simples/MEI só em 2027.
- **Uso no motor:** indexe `RegraCredito` por **`(cClassTrib, vigenciaInicio/Fim)`** — chave mais precisa que `CST` sozinho, pois o cClassTrib aponta o dispositivo legal. A IA não interpreta; o cClassTrib mapeia deterministicamente para a regra.
- Há **tabela cClassTrib oficial** (anexo da NT, versão datada de 27/01/2026 citada) e **tabela cCredPres** (~13 códigos: produtor rural não contribuinte, transportador autônomo, resíduos/reciclagem, regime automotivo, bens usados, ZFM/ALC). **Baixe ambas como dados de referência versionados.**

---

## PARTE II — REGRAS DE CRÉDITO + TRANSIÇÃO + DELTA

### 6. Cronograma e alíquotas vigentes (CORRIGIDO)

| Ano | CBS | IBS | ICMS/ISS | PIS/COFINS | IPI | Observação |
|-----|-----|-----|----------|------------|-----|------------|
| **2026** | **0,9%** (teste) | **0,1%** (UF 0,1% / Mun 0%) | cheios | cheios | cheio | Ano-teste. Destaque informativo; **dispensa de recolhimento** se obrigações acessórias cumpridas |
| **2027** | **plena** (ref. ~8,8%) **menos 0,1pp** | **0,1%** (mantém) | cheios | **EXTINTOS** | reduzido a zero (exceto ZFM) | CBS efetiva; Imposto Seletivo entra. CBS reduzida em 0,1pp para compensar o IBS-teste residual |
| **2028** | plena | **0,1%** (mantém) | cheios | — | — | IBS ainda em teste |
| 2029 | plena | ~10% da alíquota IBS / ICMS-ISS −10% | 90% | — | — | **Início da transição efetiva do IBS** |
| 2030 | plena | ~20% | 80% | — | — | |
| 2031 | plena | ~30% | 70% | — | — | |
| 2032 | plena | ~40% | 60% | — | — | |
| **2033** | plena | **100%** | **EXTINTOS** | — | — | Regime pleno |

**Confirmações e correções:**
- **2026 = 0,9% CBS + 0,1% IBS** (IBS-UF 0,1%, IBS-Mun 0%). **[CONFIRMADO]**
- **CORREÇÃO ao INCERTO anterior:** em **2027 E 2028 o IBS permanece em 0,1%** (transição efetiva só em 2029). A **CBS entra plena/efetiva em 2027** (ref. ~8,8%), **reduzida em 0,1pp** para neutralizar o IBS-teste residual. **[CONFIRMADO]**
- **Teto da alíquota de referência: 26,5%–28%** (estimativa Fazenda: ~8,8% CBS + ~17,7% IBS). É a **alíquota de referência cheia** que o produto usa para projetar o potencial (ver §8). **(INCERTO:** ainda **estimativa** — não fixada definitivamente por resolução; tratar como **parâmetro editável versionado**.)

---

### 7. Crédito no novo modelo — crédito financeiro amplo (CONFIRMADO)

**Base legal central: art. 47 da LC 214/2025.** O contribuinte do **regime regular** apropria crédito de IBS/CBS sobre **toda aquisição de bens e serviços** (materiais ou imateriais, inclusive direitos) **vinculada à atividade econômica** — não apenas insumos que se integram fisicamente. É o **crédito financeiro amplo**, oposto ao crédito físico restrito do ICMS e ao crédito por listas do PIS/COFINS. **[CONFIRMADO]**

**Vedação (art. 57):** bens e serviços de **uso e consumo PESSOAL** do contribuinte, sócios, administradores, conselheiros, empregados ou familiares **não geram crédito**. O **§1º do art. 57** menciona expressamente **imóveis residenciais e veículos** (e serviços ligados à aquisição/manutenção — seguro, combustível) como hipóteses típicas. O **inciso II** alcança bens/serviços fornecidos gratuitamente ou abaixo do valor de mercado a pessoas físicas ligadas. A vedação é por **destinação pessoal**, não por natureza física — diferente do bloqueio de "uso e consumo" do ICMS atual. **[CONFIRMADO]**

**Bens de capital (arts. 106–109):** geram crédito **integral e imediato** na aquisição (não há mais apropriação em 1/48 do ICMS-ativo). **[CONFIRMADO** que a LC trata bens de capital nesses artigos; **INCERTO** quanto ao detalhamento operacional fino — validar.]

**Condicionamento do crédito (art. 27 + art. 47):** o crédito do adquirente está condicionado à **extinção do débito** na etapa anterior (recolhimento efetivo) por qualquer modalidade do art. 27 (pagamento, compensação, **split payment**, recolhimento pelo adquirente/responsável). Difere do ICMS, em que o **mero destaque** basta. **[CONFIRMADO]** (Há debate doutrinário de que isso extrapola a não-cumulatividade — não muda o cálculo, mas registra-se.)

**Salvaguarda do art. 48:** quando **não** houver split payment nem recolhimento pelo adquirente implementados, **dispensa-se** a exigência de extinção como condição — o crédito é admitido **mesmo sem prova de recolhimento**. **Relevante para 2026/transição**, quando o split payment ainda não opera. **[CONFIRMADO]**

**Split payment — situação em jun/2026 (INCERTO/EM REGULAMENTAÇÃO):**
- **2026:** em testes; sem retenção financeira efetiva. Vale o **art. 48** (dispensa de prova de extinção).
- **2027+:** inicia **opcional e restrito a B2B**; torna-se obrigatório por ato conjunto RFB + Comitê Gestor quando houver estabilidade; depois expande para B2C. **(INCERTO:** cronograma e obrigatoriedade exatos — confirmar atos do Comitê Gestor.)

**Papel de CST + cClassTrib na elegibilidade:** a dupla define, por item, se há débito (e crédito correspondente). CST `000`/`200`/`222` geram crédito (cheio/proporcional); `400`/`410` em regra **não geram crédito** ao adquirente (sem tributo na etapa). Crédito presumido tem tabela própria (`cCredPres`, ~13 códigos) com campos em `gCredPresOper`. **[CONFIRMADO]**

---

### 8. Delta de oportunidade (núcleo do produto)

#### 8.1 Metodologia por item

```
creditoLegado(item)        = vICMS_creditavel + vPIS_creditavel + vCOFINS_creditavel
creditoNovoEfetivo(item)   = vCBS_item + vIBSUF_item + vIBSMun_item        // crédito efetivo no DOC (2026: ~1% da base)
creditoNovoPotencial(item) = vBC(item) * (aliqRefCBS + aliqRefIBS)         // projeção sob alíquota PLENA de referência
deltaEfetivo(item)         = creditoNovoEfetivo(item)   - creditoLegado(item)
deltaPotencial(item)       = creditoNovoPotencial(item) - creditoLegado(item)
pctGanho(item)             = deltaPotencial(item) / creditoLegado(item)    // proteger contra divisão por zero
```

**Regras de creditabilidade por modelo (dados versionados, não código):**
- **Legado — ICMS:** credita só crédito físico (insumo/mercadoria p/ revenda/industrialização). Uso/consumo e ativo **bloqueado/diferido** hoje. `vICMS_creditavel = vICMS` só quando `finalidade ∈ {revenda, industrializacao}`; senão 0.
- **Legado — PIS/COFINS:** credita só se **não cumulativo** E item enquadrado como insumo/aquisição creditável (Lei 10.637/10.833). **Lucro presumido (cumulativo) ⇒ crédito = 0.** Entrada: `regimePisCofins`.
- **Novo — CBS/IBS:** credita **sempre** que `finalidade ≠ uso_consumo_pessoal` (art. 57) E `CST` gerar tributo na etapa anterior E (art. 48) admitido mesmo sem prova de recolhimento em 2026.

#### 8.2 A distinção CRÍTICA (efetivo 2026 x potencial sob alíquota plena)

Em 2026 o `creditoNovoEfetivo` é **irrisório** (0,9% + 0,1% = 1,0% da base) — quase sempre **menor** que o legado. **NÃO use o delta efetivo de 2026 como métrica de oportunidade**, ou o produto mostrará "delta negativo" enganoso. O valor de negócio está no **delta potencial**: projete o crédito novo sob a **alíquota de referência cheia** (default ~26,5% → ~8,8% CBS + ~17,7% IBS, **parametrizável e versionado**) e compare ao legado.

Apresente **três números, sempre rotulados:**
1. **Crédito efetivo 2026** (alíquota-teste) — o que entra na apuração agora.
2. **Crédito novo potencial** (alíquota de referência cheia) — projeção.
3. **Delta de oportunidade = potencial − legado** e **% de ganho**.

O delta potencial é **maior** em: itens de **uso/consumo** que hoje não creditam ICMS, e aquisições que hoje não creditam PIS/COFINS (empresa cumulativa, ou item fora das listas) mas que **passam a creditar** no crédito amplo. É o "crédito que hoje se perde".

#### 8.3 Agregação
- Por **documento**: `creditoLegadoDoc`, `creditoNovoEfetivoDoc`, `creditoNovoPotencialDoc`, `deltaDoc`, `pctGanhoDoc`.
- Por **competência (mês)**: soma dos documentos; relatório "oportunidade do mês".
- **Drill-down por item** com base legal (CST/cClassTrib → artigo LC 214) e motivo do delta (ex.: "item uso/consumo: legado ICMS=0, novo credita art. 47").

#### 8.4 Apresentação sugerida
Tabela por item + cards agregados: `Crédito legado | Crédito novo (2026 efetivo) | Crédito novo (potencial pleno) | Delta R$ | Ganho %`, com badge de **fonte do ganho** (uso/consumo, regime cumulativo PIS/COFINS, ativo imobilizado).

---

### 9. Migração do saldo credor de PIS/COFINS para a CBS (arts. 378–383) — CONFIRMADO

- Saldos credores de PIS/PASEP e COFINS **regularmente escriturados na EFD-Contribuições até 31/12/2026** permanecem **válidos**.
- **Apropriados até 30/06/2027.**
- **Utilização:** em **12 parcelas mensais, iguais e sucessivas**, a partir do período seguinte à apropriação, **exclusivamente para compensar débitos de CBS** (vedados ressarcimento em dinheiro e compensação com outros tributos para os saldos apropriados nessa via).
- **Ordem de consumo (art. 378):** o crédito acumulado de PIS/COFINS é usado **preferencialmente** (antes) dos créditos de CBS do novo regime.

Implicação: modele `saldoPisCofinsMigrado` com cronograma de 12 parcelas e regra de prioridade no abatimento de CBS. Relevância baixa para o crédito por NF-e de entrada, necessária para a **apuração mensal** consolidada.

---

### 10. Como o MOTOR versionado por vigência modela CBS/IBS

#### Entradas do motor (por item)
| Campo | Origem | Uso |
|-------|--------|-----|
| `cst` | `IBSCBS.CST` | elegibilidade + se há tributo na etapa anterior |
| `cClassTrib` | `IBSCBS.cClassTrib` | vincula ao artigo LC 214 (base legal + regra específica) — **chave de indexação da RegraCredito** |
| `vBC` | `gIBSCBS.vBC` | base para projeção potencial |
| `vCBS` | `gCBS.vCBS` | crédito CBS efetivo (2026) |
| `vIBSUF` | `gIBSUF.vIBSUF` | parcela estadual IBS |
| `vIBSMun` | `gIBSMun.vIBSMun` | parcela municipal IBS (0 em 2026) |
| `cCredPres/vCredPres` | `gCredPresOper` | crédito presumido (não é crédito comum) |
| `finalidade/uso` | classificação do item (revenda/indústria/ativo/uso-consumo/uso-pessoal) | art. 57 (vedação) + regra do legado |
| `regimePisCofins` | cadastro do contribuinte (cumulativo/não-cumulativo) | creditabilidade legada de PIS/COFINS |
| `competencia` | `dhEmi` da NF-e | seleciona a `RegraCredito` vigente |
| `aliqRefCBS / aliqRefIBS` | tabela de alíquota de referência versionada (default ~8,8%/~17,7%) | projeção do potencial |

#### Saída do motor (por item, agregável)
```jsonc
{
  "creditoLegado":        { "icms": 0, "pis": 0, "cofins": 0, "total": 0, "baseLegal": ["LC87/96 art.20", "Lei 10.833 art.3"] },
  "creditoCbs":           0,        // vCBS efetivo 2026
  "creditoIbs":           0,        // vIBSUF + vIBSMun efetivo 2026
  "creditoNovoEfetivo":   0,
  "creditoNovoPotencial": 0,        // vBC * (aliqRefCBS + aliqRefIBS)
  "deltaEfetivo":         0,
  "deltaPotencial":       0,
  "pctGanho":             0,
  "baseLegal":            ["LC 214/2025 art.47", "art.57", "cClassTrib=200034 (art.135, Anexo VII)"],
  "alertas": [
    "Item uso/consumo: nao credita ICMS no legado, credita CBS/IBS no novo (art.47).",
    "Credito novo 2026 e simbolico (aliquota-teste). Delta calculado sobre aliquota de referencia."
  ]
}
```

#### Modelagem da vigência (reaproveitando `RegraCredito.vigenciaInicio/Fim`)
- Cada **regra** (legada e nova) é **dado** com janela de vigência. Em **2026** coexistem: regra legada (ICMS/PIS/COFINS) **vigente** + regra CBS/IBS **vigente** → a mesma nota dispara os dois cálculos.
- Regra CBS/IBS parametrizada por `(cst, cClassTrib, competencia) → { credita: bool, aliqEfetiva, aliqReferencia, baseLegal }`. Em **2027** a regra de PIS/COFINS recebe `vigenciaFim = 2026-12-31` e a CBS muda `aliqEfetiva` para plena (−0,1pp); **IBS mantém 0,1% em 2027–2028**. Em **2029** entra a transição do IBS (10%...). **Nenhuma mudança de código** — só novas linhas de `RegraCredito` e da tabela de alíquota de referência.
- Mantenha **tabela de alíquota de referência** separada (versionada) para o `creditoNovoPotencial`, independente da alíquota-teste destacada na NF-e.

---

## 11. Checklist de incertezas a confirmar contra o XSD/atos oficiais ANTES do deploy

1. **(INCERTO)** Revisão posterior a v1.40 (20/05/2026) válida na data de deploy — revalidar no portal NF-e.
2. **(INCERTO)** Posição/cardinalidade exatas de `gCredPresOper` (UB120) e `gALCZFMCBS` (UB66a) no XSD — confirmar antes de codar extração de crédito presumido.
3. **(INCERTO)** IDs alfanuméricos exatos dos campos (UB02, UB09, UB12, UB35, UB54, UB67, W03/W47/W56) e profundidade dos subgrupos — tratar mapeamento ID→campo como **tabela versionada**, não constantes; nomes mudaram entre v1.10→v1.40 (`gTribRegular` vs `gIBSCBS`).
4. **(INCERTO)** Se 100% dos cClassTrib mantêm 6 dígitos (confirmado no exemplo `200034`).
5. **(INCERTO)** Alíquota de referência cheia (~26,5% / ~8,8%+~17,7%) — estimativa, não fixada por resolução; **parâmetro editável**.
6. **(INCERTO)** Split payment: cronograma/obrigatoriedade 2027+ (opcional B2B → obrigatório por ato conjunto); impacta a condição de crédito (arts. 47/48).
7. **(CONFIRMAR no XSD)** Ordem e cardinalidade (0-1/0-N) de cada subgrupo para configurar `isArray` no fast-xml-parser.
8. **(CONFIRMADO, mas monitorar)** Datas de rejeição CRT=3: homologação **01/07/2026**, produção **03/08/2026**; devoluções 01/09/2026; Simples/MEI 2027.

**Fontes oficiais prioritárias:** portal NF-e/Fazenda (NT 2025.002-RTC v1.40 e anexos: tabelas CST, cClassTrib, cCredPres, alíquotas 2026–2028, XSD do pacote de schemas), LC 214/2025, EC 132/2023, atos do Comitê Gestor do IBS.

---

## Fontes

- [Planalto — LC 214/2025](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm)
- [Receita Federal — Orientações 2026](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026)
- [Fazenda — créditos PIS/Cofins na transição (jun/2026)](https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/junho/receita-federal-esclarece-as-regras-para-uso-de-creditos-de-pis-cofins-na-transicao-para-a-cbs)
- [Portal NF-e — NT 2025.002](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY%3D)
- [Portal NF-e — Esquemas XML](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w%3D)
- [SEFAZ-AM — campos IBS/CBS obrigatórios em 2026 (alíquotas-teste; IBS-Mun 0%)](https://www.sefaz.am.gov.br/noticias/31893)
- [contadores.cnt.br — NT 2025.002 v1.40 (20/05/2026); prazos 01/07 e 03/08/2026; gCredPresOper](https://www.contadores.cnt.br/noticias/tecnicas/2026/05/25/nt-2025-002-v-1-40-publicada-em-20-05-2026-o-checklist-tecnico-que-o-escritorio-precisa-cobrar-do-erp-do-cliente-ate-03-08-2026.html)
- [NDD — NT v1.40 define início das rejeições (homologação 01/07, produção 03/08/2026; UB12-10 adiada)](https://reformatributaria.ndd.tech/atencao-aos-prazos-nt-2025-002-v1-40-define-inicio-das-rejeicoes-por-falta-de-ibs-e-cbs/)
- [NotaGateway — NT 2025.002-RTC v1.40](https://notagateway.com.br/blog/nt-2025-002-rtc-chega-a-versao-1-40-com-novos-campos-e-regras-para-nf-e-e-nfc-e-na-reforma-tributaria/)
- [ConJur — direito a crédito IBS/CBS (arts. 47/48, condicionamento)](https://www.conjur.com.br/2026-mai-18/direito-ao-credito-de-ibs-e-cbs-no-contexto-da-reforma-tributaria/)
- [Tecnospeed — grupos/campos NT 2025.002](https://blog.tecnospeed.com.br/nota-tecnica-reforma-tributaria-nfe-nfce/) | [tabelas cClassTrib/CST/cCredPres](https://blog.tecnospeed.com.br/tabela-cclasstrib/)
- [Taxcel — tabela cClassTrib/CST (exemplo 200034 → art.135)](https://taxcel.com.br/cclass-cst-ibs-cbs)
- [SEFIN-RO — informe técnico tabelas cClassTrib/CST/cCredPres](https://reformatributaria.sefin.ro.gov.br/2026/04/22/informe-tecnico-detalha-tabelas-de-classificacao-tributaria-cst-e-credito-presumido-do-ibs-e-da-cbs/)
- [Régys/ACBr — hierarquia gIBSCBS/gIBSCBSMono](https://regys.com.br/acbrnfe-e-nt-2025-002-o-guia-definitivo-da-reforma-tributaria-ibs-cbs-para-desenvolvedores-delphi/)
- [Coimbra, Chaves & Batista — art. 57 uso/consumo pessoal (veículos, imóveis)](https://coimbrachaves.com.br/ibs-cbs-operacoes-de-uso-ou-consumo-pessoal/)
- [SEFIN-RO — bens de capital arts. 106–109](https://reformatributaria.sefin.ro.gov.br/2025/10/24/bens-de-capital-cbs-ibs-uma-reflexao-acerca-dos-arts-108-e-109-da-lc-no-214-2025/)
- [Serasa — cronograma](https://www.serasaexperian.com.br/conteudos/cronograma-da-reforma-tributaria/) | [Startups — alíquotas de transição (IBS 0,1% em 2027–2028; CBS −0,1pp)](https://startups.com.br/coluna/reforma-tributaria-quais-serao-as-aliquotas-de-ibs-e-cbs-no-periodo-de-transicao/)
- [Senado — implementação 2026](https://www12.senado.leg.br/noticias/materias/2026/01/02/ano-de-2026-marca-implementacao-da-reforma-tributaria)