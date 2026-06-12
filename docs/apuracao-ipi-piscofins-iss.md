# Apuração de IPI, PIS/COFINS e ISS (Etapa 12) — VERIFICADO

# Apuração de IPI, PIS/COFINS (débito) e ISS/NFS-e — especificação consolidada

> Escopo: tributos legados (junho/2026, pré-reforma para PIS/COFINS/ISS; IPI ainda plenamente vigente em 2026). DADO para código. Estende o motor de ICMS/PIS/COFINS-crédito + DAS já existente, usando o modelo `ApuracaoImposto` por (empresa, competência, imposto) com `debito/credito/saldoCredorAnterior/aRecolher/saldoCredorTransportar`. Notas "(verificado: ...)" marcam o que foi confirmado adversarialmente; **[INCERTO]** marca o que exige confirmação humana/XSD antes de hard-code.

---

# (A) Apuração de IPI (federal) — débito × crédito

## 1. Contribuinte e não-cumulatividade

Fonte: RIPI — Decreto 7.212/2010, arts. 8º, 9º, 24, 35, 225, 226, 254 ([Planalto](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/decreto/d7212.htm)).

Contribuintes (RIPI art. 24): estabelecimento **industrial** (art. 8º), **equiparado a industrial** (art. 9º — inclui importador que dá saída a produto estrangeiro; filial atacadista de importados/industrializados pela mesma firma), **importador** (fato gerador desembaraço, art. 35, I), e figuras pontuais (comerciante de bens de produção). Fato gerador (art. 35): (I) desembaraço aduaneiro de produto estrangeiro; (II) saída de produto de estabelecimento industrial/equiparado.

Não-cumulatividade (CF art. 153, §3º, II; RIPI art. 225–226): débito × crédito. Credita-se o IPI das **entradas** de MP, produto intermediário e material de embalagem destinados à industrialização (art. 226, I), **desde que a saída resultante seja tributada** (ou haja previsão legal de manutenção do crédito). **Não há crédito** de IPI sobre ativo imobilizado nem material de uso/consumo (diferente do PIS/COFINS não-cumulativo).

Roteamento por regime no app:
- **`SIMPLES_NACIONAL`**: NÃO apura IPI por débito-crédito — está embutido no DAS (LC 123/2006, Anexo II). NÃO gerar `ApuracaoImposto imposto='IPI'`. Espelha o short-circuit do ICMS no Simples.
- **Lucro Real / Lucro Presumido**: o regime de IRPJ/CSLL é IRRELEVANTE — IPI depende de a empresa **ser contribuinte do IPI**. Comercial pura (não industrial/equiparada) não é contribuinte: não credita, não debita, não gera apuração.
- **[INCERTO — modelo]** O `Empresa` hoje só tem `regimeTributario` e `uf`, sem flag de contribuinte de IPI. **Recomendação**: adicionar `Empresa.contribuinteIpi Boolean @default(false)` e só apurar IPI quando `true`. Sem a flag, usar heurística (presença de itens com CST de saída 50/99 e `vIPI>0`) e marcar a apuração com alerta de confirmação.

## 2. Layout do IPI no item da NF-e (grupo O) — (verificado)

Fonte: MOC NF-e Anexo I, grupo O; NT 2015.002 (`cEnq`). Caminho base: `NFe/infNFe/det/imposto/IPI`. O grupo `IPI` é OPCIONAL (só aparece para produto sujeito a IPI).

(verificado: flexdocs e MOC confirmam — `cEnq` (id O06) é **filho direto** de `<IPI>`, obrigatório, "999" = tributação normal; e o `<IPI>` contém **exatamente um** de `IPITrib` OU `IPINT`, mutuamente exclusivos. Exemplo válido confirmado: `cEnq=999, CST=50, vBC=1000, pIPI=7, vIPI=70`.)

**Filhos diretos de `<IPI>`** (NÃO ficam dentro de IPITrib/IPINT):

| Tag | id | Obrig. | Semântica |
|---|---|---|---|
| `clEnq` | O02 | opcional | Classe de enquadramento (cigarros/bebidas) |
| `CNPJProd` | O03 | opcional | CNPJ do produtor/importador |
| `cSelo` | O04 | opcional | Código do selo de controle |
| `qSelo` | O05 | opcional | Quantidade de selos |
| `cEnq` | O06 | **obrigatório** | Enquadramento legal (3 díg.; "999" normal) |

### 2a. `IPITrib` — TRIBUTADO (`det/imposto/IPI/IPITrib`)

| Tag | id | Semântica |
|---|---|---|
| `CST` | O09 | CST IPI (2 díg.). Tributado: 00, 49, 50, 99 |
| `vBC` | O10 | Base (só ad valorem) |
| `pIPI` | O13 | Alíquota % (só ad valorem) |
| `qUnid` | O11 | Qtde unidade tributável (só específica) |
| `vUnid` | O12 | Valor por unidade (só específica) |
| `vIPI` | O14 | **Valor do IPI** (sempre presente em IPITrib) |

Cálculo do destaque (informado no XML; o app **lê `vIPI`**, não recalcula):
- Ad valorem: `vIPI = vBC × (pIPI/100)` → `vBC`+`pIPI` presentes.
- Específica: `vIPI = qUnid × vUnid` → `qUnid`+`vUnid` presentes.

**Sempre usar `vIPI` lido do XML como verdade** (mesma política de `vICMS`/`vPIS`); gerar alerta se `vBC×pIPI` ou `qUnid×vUnid` divergir.

### 2b. `IPINT` — NÃO tributado (`det/imposto/IPI/IPINT`)

| Tag | id | Semântica |
|---|---|---|
| `CST` | O08 | CST IPI. Não tributado: 01, 02, 03, 04, 05, 51, 52, 53, 54, 55 |

`IPINT` **não** tem `vBC`/`vIPI`. Na entrada, indica que não há crédito a tomar.

> Parsing: diferente de ICMS (discriminador = nome do subnó ICMS00/ICMSSN101…), no IPI `cEnq`/`clEnq`/selos são **irmãos** de `IPITrib`/`IPINT`. A heurística `grupoInterno()` (pega o "primeiro objeto interno") pegaria o nó errado. **Tratar `IPITrib`/`IPINT` por nome explícito** (ver §5).

## 3. CST de IPI — débito (saída) × crédito (entrada) — (verificado)

Fonte: Tabela CST-IPI ([CDM](https://cdmcontabilidade.com.br/tabela-cst-ipi/); [TDC](https://tdcadvogados.com.br/cst-ipi-tabela-atualizada-2024/)).

(verificado: CST 00 = "Entrada com recuperação de crédito" — só credita se a entrada conferir crédito e a alíquota do IPI for > zero; CST 49 = "Outras entradas" — operações com dois documentos (um tributado, outro não); CST 50 = "Saída tributada" — alíquota > 0; CST 99 = "Outras saídas".)

**Entradas (00–49):**

| CST | Descrição | Crédito? |
|---|---|---|
| **00** | Entrada com recuperação de crédito | **SIM** — credita `vIPI` |
| 01 | Tributável alíq. zero | Não (vIPI=0) |
| 02 | Isenta | Não |
| 03 | Não-tributada | Não |
| 04 | Imune | Não |
| 05 | Suspensão | Não |
| **49** | Outras entradas | **CONDICIONAL** — só com `vIPI>0` e insumo p/ industrialização tributada; **alerta de análise manual** |

**Saídas (50–99):**

| CST | Descrição | Débito? |
|---|---|---|
| **50** | Saída tributada | **SIM** — debita `vIPI` |
| 51 | Tributável alíq. zero | Não |
| 52 | Isenta | Não |
| 53 | Não-tributada | Não |
| 54 | Imune | Não |
| 55 | Suspensão | Não |
| **99** | Outras saídas | **CONDICIONAL** — debita com `vIPI>0`; **alerta** |

**Política determinística (mesma filosofia do crédito de ICMS/PIS/COFINS):**
- **Crédito IPI (entrada)** = Σ `vIPI` de itens com CST ∈ {00} (e {49} com `vIPI>0`+alerta), em NF-e de **ENTRADA**, quando empresa é contribuinte IPI e o insumo se destina a industrialização/revenda tributada.
- **Débito IPI (saída)** = Σ `vIPI` de itens com CST ∈ {50} (e {99} com `vIPI>0`+alerta), em documentos de **SAÍDA** (XML próprio/SPED).
- CST 01–05 e 51–55 → `vIPI`=0 → registrar com valor zero, sem impacto.
- **Sinal real = `vIPI`**: critério primário "há `vIPI` em IPITrib?"; o CST refina elegibilidade/alerta. Nunca creditar/debitar de `IPINT`.

> **[INCERTO]** Crédito (CST 00/49) pode exigir **estorno** se a saída resultante for desonerada sem previsão de manutenção (RIPI art. 254). É ajuste de período (vai em "outros débitos", §4), não dedutível pelo CST da entrada. Pode exigir ajuste manual.

## 4. Apuração mensal e bloco E520 (EFD-ICMS/IPI) — (verificado)

Fonte: Guia Prático EFD-ICMS/IPI, E500/E510/E520/E530 ([RFB](http://sped.rfb.gov.br/estatico/E4/4A860113D8DEACA0CB7E609E7BDE7419EED43E/GUIA%20PR%C3%81TICO%20EFD%20ICMS%20IPI%20-%20v.%203.01.pdf); [VRI E520](https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=150); [VRI E530](https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=151)).

Hierarquia: **E500** (abre período, `IND_APUR/DT_INI/DT_FIN`) → **E510** (consolida por **CFOP + CST_IPI**: `VL_CONT_IPI`, `VL_BC_IPI`, `VL_IPI`) → **E520** (apuração, 1 por E500) → **E530** (ajustes: `IND_AJ`, `VL_AJ`, `COD_AJ`).

(verificado, validações oficiais do E520):
- `VL_DEB_IPI` (campo 03) = Σ `VL_IPI` do E510 quando **CFOP inicia em 5 ou 6** (saídas) — também C190.
- `VL_CRED_IPI` (campo 04) = Σ `VL_IPI` do E510 quando **CFOP inicia em 1, 2 ou 3** (entradas).
- `VL_OD_IPI` (campo 05) = Σ `VL_AJ` do E530 com `IND_AJ='0'` (outros débitos, inclusive estorno de crédito).
- `VL_OC_IPI` (campo 06) = Σ `VL_AJ` do E530 com `IND_AJ='1'` (outros créditos, inclusive estorno de débito).
- Regra do saldo: se `(VL_DEB_IPI + VL_OD_IPI) − (VL_SD_ANT_IPI + VL_CRED_IPI + VL_OC_IPI) ≥ 0` → campo 08 `VL_SD_IPI` recebe o resultado e `VL_SC_IPI`=0.

| Campo | Semântica | → ApuracaoImposto |
|---|---|---|
| `VL_SD_ANT_IPI` (02) | Saldo **credor** anterior (≥0) | `saldoCredorAnterior` |
| `VL_DEB_IPI` (03) | Σ débitos saídas (CFOP 5/6) | `debito` |
| `VL_CRED_IPI` (04) | Σ créditos entradas (CFOP 1/2/3) | `credito` |
| `VL_OD_IPI` (05) | Outros débitos (estornos de crédito) | → `detalhe` Json |
| `VL_OC_IPI` (06) | Outros créditos (estornos de débito) | → `detalhe` Json |
| `VL_SC_IPI` (07) | Saldo **credor** a transportar | `saldoCredorTransportar` |
| `VL_SD_IPI` (08) | Saldo **devedor** a recolher | `aRecolher` |

**Fórmula (determinística):**
```
SALDO = (VL_DEB_IPI + VL_OD_IPI) − (VL_SD_ANT_IPI + VL_CRED_IPI + VL_OC_IPI)
SALDO ≥ 0 → VL_SD_IPI = SALDO ; VL_SC_IPI = 0      (a recolher)
SALDO < 0 → VL_SC_IPI = |SALDO| ; VL_SD_IPI = 0    (credor transporta)
```
São mutuamente exclusivos — nunca `VL_SD_IPI` e `VL_SC_IPI` ambos > 0.

Mapa `ApuracaoImposto` (imposto='IPI'):
```
debito                 = VL_DEB_IPI
credito                = VL_CRED_IPI
saldoCredorAnterior    = VL_SD_ANT_IPI
deducoes               = 0   (IPI não tem "deduções" próprias no E520; incentivos vêm via E530)
aRecolher              = VL_SD_IPI
saldoCredorTransportar = VL_SC_IPI
detalhe (Json)         = { VL_OD_IPI, VL_OC_IPI, porCfopCst:[{cfop,cst,vBC,vIPI,sinal}], periodo, indApur }
```

> **[INCERTO — modelagem]** `ApuracaoImposto` não tem colunas para "outros débitos/créditos". Opção (A) recomendada: gravar `VL_OD_IPI`/`VL_OC_IPI` em `detalhe` Json e incorporá-los na fórmula do SALDO. Opção (B): adicionar `outrosDebitos`/`outrosCreditos` ao modelo — vale a pena pois o E110 do ICMS também tem `VL_OD_ICMS`/`VL_OC_ICMS`; generalizar serve aos dois.
> **[INCERTO]** Em 2026, com EC 132/2023, o IPI tende a alíquota zero geral exceto produtos com industrialização equivalente na ZFM. Não modelar como regra fixa — o `pIPI`/`vIPI` real das notas é a verdade; quando débito→0, a apuração tende a acumular saldo credor.

## 5. Mudanças de código (IPI)

1. **`schema.prisma` — `ItemDocumento`**:
   ```prisma
   cstIpi  String?  // 00,01..05,49,50..55,99
   cEnqIpi String?  // cEnq (filho direto de <IPI>)
   vBcIpi  Decimal? @db.Decimal(18, 2)
   pIpi    Decimal? @db.Decimal(7, 4)
   vIpi    Decimal? @db.Decimal(18, 2)
   ```
   (opcional `Empresa.contribuinteIpi Boolean @default(false)`.)
2. **`nfe-parser.service.ts`** — NÃO usar `grupoInterno()` para IPI:
   ```ts
   const ipi     = (imposto['IPI']    as Record<string, unknown>) ?? {};
   const ipiTrib = (ipi['IPITrib']    as Record<string, unknown>) ?? {};
   const ipiNT   = (ipi['IPINT']      as Record<string, unknown>) ?? {};
   cstIpi:  this.str(ipiTrib['CST']) ?? this.str(ipiNT['CST']),
   cEnqIpi: this.str(ipi['cEnq']),
   vBcIpi:  this.str(ipiTrib['vBC']),
   pIpi:    this.str(ipiTrib['pIPI']),
   vIpi:    this.str(ipiTrib['vIPI']),
   ```
3. **`motor-credito.types.ts`** — estender `ItemApuravel` com `cstIpi?`, `vIpi?`; `CondicaoRegra.campoValor` com `'vIpi'`; enum `Tributo.IPI` em `TRIBUTOS_PADRAO`/`carregarRegras` **apenas para entradas de contribuinte do IPI**.
4. **Crédito IPI (entrada)** — função análoga a `avaliarTributo`, com short-circuit: `SIMPLES_NACIONAL`→nega; não-contribuinte→nega; senão credita `vIpi` quando CST∈{00} (e {49}+alerta). Base: RIPI art. 226, I.
5. **Débito IPI (saída) + apuração mensal** — serviço de período análogo ao do ICMS/E110: soma `vIpi` saídas CST 50/99 → `debito`; soma créditos das entradas → `credito`; puxa `saldoCredorAnterior` da competência anterior; aplica fórmula §4; grava `ApuracaoImposto imposto='IPI'`. Lê `VL_OD_IPI`/`VL_OC_IPI` do E530 quando SPED importado, ou 0 com só XML.
6. **`spec`** — fórmula E520 (devedor, credor, zerado), exclusão do Simples, parsing IPITrib (ad valorem e específico) vs IPINT.

---

# (B) Apuração de PIS/COFINS (débito das saídas) — cumulativo × não-cumulativo

## 1. Conceito e roteamento por regime — (verificado)

O **débito** incide sobre a **receita das SAÍDAS**. O regime define alíquota e aproveitamento de crédito:

| Regime | Modalidade | PIS | COFINS | Crédito? | Apuração |
|---|---|---|---|---|---|
| **Lucro Real** | Não-cumulativo | 1,65% | 7,6% | **Sim** (motor já calcula) | `aRecolher = débito − crédito` |
| **Lucro Presumido** | Cumulativo | 0,65% | 3,0% | **Não** | `aRecolher = débito` |
| **Simples** | — | — | — | — | Dentro do **DAS**; **NÃO** gerar `ApuracaoImposto` |

Base legal: cumulativo — Lei 9.718/98 (0,65% PIS / 3% COFINS, Lucro Presumido); não-cumulativo — Lei 10.637/2002 (PIS 1,65%, art. 2º; créditos art. 3º) e Lei 10.833/2003 (COFINS 7,6%, art. 2º; créditos art. 3º).

```ts
function modalidadePisCofins(regime: Regime): 'NAO_CUMULATIVO'|'CUMULATIVO'|'SIMPLES' {
  switch (regime) {
    case 'LUCRO_REAL':      return 'NAO_CUMULATIVO';
    case 'LUCRO_PRESUMIDO': return 'CUMULATIVO';
    case 'SIMPLES':         return 'SIMPLES';
  }
}
```

> **[INCERTO / atenção do produto]** O regime PIS/COFINS **não é universalmente** definido pelo regime de IR. Há (a) receitas **cumulativas dentro do Lucro Real** (Lei 10.833/2003 art. 10 — telecom, transporte de passageiros, certos serviços, contratos pré-31/10/2003) e (b) regimes **monofásico/ST/alíquota zero**. O roteamento por regime de IR é a aproximação correta para o MVP, mas o motor deve permitir **override por item** conforme o CST. Não tratar "Lucro Real ⇒ tudo 1,65%/7,6%" como invariante.

## 2. Débito por CST no item da NF-e de saída — (verificado e CORRIGIDO)

Ler grupos `<PIS>` e `<COFINS>` de cada item das NF-e de **saída**: `CST`, `vBC`, `pPIS`/`pCOFINS` (ou `qBCProd`/`vAliqProd`), e o destaque `vPIS`/`vCOFINS`.

(verificado contra CDM Contabilidade — Tabela CST PIS/COFINS de saída. **Correção importante**: o snippet inicial de busca confundiu CST 02 com "monofásica"; a tabela oficial confirma a redação abaixo.)

| CST | Descrição oficial | Gera débito? |
|---|---|---|
| **01** | Operação Tributável com Alíquota Básica | **SIM** (destaque 1,65/7,6 ou 0,65/3 conforme regime) |
| **02** | Operação Tributável com **Alíquota Diferenciada** | **SIM** (alíquota específica do produto) |
| **03** | Operação Tributável com Alíquota **por Unidade de Medida** (`qBCProd × vAliqProd`) | **SIM** (débito por quantidade) |
| 04 | Tributável **Monofásica — Revenda a Alíquota Zero** | NÃO (concentrado na etapa anterior) |
| 05 | Tributável por **Substituição Tributária** | NÃO (recolhe o substituto) |
| 06 | **Alíquota Zero** | NÃO (vPIS/vCOFINS=0) |
| 07 | **Isenta** | NÃO |
| 08 | **Sem Incidência** | NÃO |
| 09 | **Suspensão** | NÃO |

(verificado: CST 02 = "Alíquota Diferenciada", CST 03 = "por Unidade de Medida de Produto" — confirmado na tabela CDM; é o **monofásico que está no CST 04**, não no 02.)

Base legal da tabela: IN RFB 1.009/2010 (Tabela I, faixa 01–49).

```ts
const CST_DEBITO_SAIDA = new Set(['01', '02', '03']);
function debitoItem(item: ItemNfeSaida, imposto: 'PIS'|'COFINS'): Decimal {
  const grupo = imposto === 'PIS' ? item.pis : item.cofins;
  if (!CST_DEBITO_SAIDA.has(grupo.cst)) return ZERO;
  return grupo.vTributo; // vPIS ou vCOFINS — soma o destaque do XML, não recalcula
}
```

> Princípio: o motor **soma o destaque** do XML (auditável, bate com o documento); não recalcula alíquota. Usa a alíquota só como validação cruzada/flag (ex.: Lucro Real com 0,65% em CST 01 sem amparo do art. 10 → alerta).
> **[INCERTO]** CST 49 ("outras operações de saída") pode ou não gerar débito conforme a natureza informada — tratar como exceção a revisar, não somar automaticamente.

## 3. Apuração consolidada — M200 (PIS) / M600 (COFINS) — (verificado)

Estrutura de campos **idêntica** em M200 e M600. (verificado contra VRI Consulting M200 e Guia Prático EFD-Contribuições — campos, códigos e fórmulas confirmados.)

| Campo | Código | Significado |
|---|---|---|
| 02 | `VL_TOT_CONT_NC_PER` | Contribuição **não-cumulativa** apurada (= débito NC; vem do M210) |
| 03 | `VL_TOT_CRED_DESC` | Crédito descontado do período (do M100) |
| 04 | `VL_TOT_CRED_DESC_ANT` | Crédito descontado de períodos anteriores (saldo credor transportado) |
| 05 | `VL_TOT_CONT_NC_DEV` | Não-cumulativa **devida** = `02 − 03 − 04` |
| 06 | `VL_RET_NC` | Retenções na fonte (NC) |
| 07 | `VL_OUT_DED_NC` | Outras deduções (NC) |
| 08 | `VL_CONT_NC_REC` | **A recolher NC** = `05 − 06 − 07` |
| 09 | `VL_TOT_CONT_CUM_PER` | Contribuição **cumulativa** apurada (= débito cumulativo) |
| 10 | `VL_RET_CUM` | Retenções (cumulativo) |
| 11 | `VL_OUT_DED_CUM` | Outras deduções (cumulativo) |
| 12 | `VL_CONT_CUM_REC` | **A recolher cumulativo** = `09 − 10 − 11` |
| 13 | `VL_TOT_CONT_REC` | **Total a recolher** = `08 + 12` |

(verificado: campo 05 = 02 − 03 − 04; campo 08 = 05 − 06 − 07; campo 13 = 08 + 12; campo 09 é o débito cumulativo. Regra: `VL_TOT_CRED_DESC + VL_TOT_CRED_DESC_ANT` não pode exceder `VL_TOT_CONT_NC_PER` — excedente vira saldo credor a transportar, igual ao ICMS.)

Mapeamento Apurax → M200/M600:
- `debito` → campo 02 (NC) **ou** campo 09 (cumulativo) conforme modalidade.
- `credito` → campo 03 (**apenas** NC).
- `saldoCredorAnterior` → campo 04.
- `aRecolher` → campo 08 (NC) ou 12 (cumulativo).
- `saldoCredorTransportar` → excedente de crédito não consumido.

## 4. Modelagem (PIS e COFINS)

Gerar **dois registros independentes por competência** (`imposto='PIS'`, `imposto='COFINS'`) — alíquotas e blocos distintos (M200 × M600), mesma lógica.

```ts
const ALIQ = {
  NAO_CUMULATIVO: { PIS: 0.0165, COFINS: 0.076 },
  CUMULATIVO:     { PIS: 0.0065, COFINS: 0.030 },
} as const;

function apurarPisCofins(empresaId, competencia, imposto: 'PIS'|'COFINS', regime,
    saidas, creditoEntradas, saldoCredorAnterior): ApuracaoImposto | null {
  const modalidade = modalidadePisCofins(regime);
  if (modalidade === 'SIMPLES') return null;            // sai no DAS
  const debito = saidas.reduce((a, it) => a.add(debitoItem(it, imposto)), ZERO);
  const credito = modalidade === 'NAO_CUMULATIVO' ? creditoEntradas      : ZERO;
  const credAnt = modalidade === 'NAO_CUMULATIVO' ? saldoCredorAnterior  : ZERO;
  const creditoTotal = credito.add(credAnt);
  const aRecolher = Decimal.max(debito.sub(creditoTotal), ZERO);
  const saldoCredorTransportar = Decimal.max(creditoTotal.sub(debito), ZERO);
  return { empresaId, competencia, imposto, debito, credito,
           saldoCredorAnterior: credAnt, aRecolher, saldoCredorTransportar };
}
```

Notas:
- **Roteamento explícito**: no cumulativo, zerar `credito` e `saldoCredorAnterior` no nível da apuração (o crédito é juridicamente inexistente, não "zero por acaso").
- **[INCERTO — escopo]** `ApuracaoImposto` não tem campos para retenções/outras deduções (campos 06/07/10/11). Para o MVP, `aRecolher` ≈ campo 08/12 assumindo retenção zero. Se houver retenção de PIS/COFINS na fonte (clientes PJ, órgãos públicos — Lei 10.833/2003 art. 30), prever coluna `retencaoFonte`.
- **PIS e COFINS compartilham `debitoItem`/CST** — muda só o grupo (`<PIS>`×`<COFINS>`) e a alíquota de validação.
- **[INCERTO]** Receitas mistas (cumulativo + NC no mesmo CNPJ): a EFD separa nos campos 02 e 09 do **mesmo** M200. Suportar exigiria segregar `debito` por modalidade. Fora do MVP recomendado.

## 5. Resumo de fórmulas (PIS/COFINS)
```
NÃO-CUMULATIVO (Lucro Real):
  débito      = Σ vPIS|vCOFINS (CST 01,02,03 das saídas)   [1,65% / 7,6%]
  crédito     = crédito entradas (motor) + saldo credor anterior
  a recolher  = max(débito − crédito, 0)
  transportar = max(crédito − débito, 0)
CUMULATIVO (Lucro Presumido):
  débito      = Σ vPIS|vCOFINS (CST 01,02,03)              [0,65% / 3%]
  a recolher  = débito        (crédito = 0 sempre)
  transportar = 0
SIMPLES: não apura — embutido no DAS.
```

---

# (C) Apuração de ISS (municipal) + captura de NFS-e

## 1. Fundamento legal (LC 116/2003)

Fonte: [LC 116/2003 — Planalto](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm) (arts. 1º, 3º, 6º, 7º, 8º, 8º-A).

- **Incidência / lista (art. 1º)**: serviços da lista anexa (190+ subitens, ex. `01.07`, `07.02`, `17.12`), lista **taxativa** (STF RE 784.439/Tema 296, admite interpretação extensiva dentro de cada item). Chave operacional do motor = **código de tributação da NFS-e** (`cTribNac`/`cTribMun`), não reclassificação manual.
- **Base (art. 7º)**: preço do serviço. Deduções (ex. 7.02/7.05 construção civil) já chegam resolvidas; **modele a base como vem na NFS-e** (`vBC`).
- **Alíquota (arts. 8º/8º-A)**: mínima **2%**, máxima **5%**, por lei municipal. **Não derive — use `pAliqAplic` da NFS-e.**
- **ISS é CUMULATIVO — sem crédito**: não há conta-corrente. Em `ApuracaoImposto imposto='ISS'`, `credito`, `saldoCredorAnterior`, `saldoCredorTransportar` ficam **sempre 0/null**; só `debito` e `aRecolher` são preenchidos.
- **Local de incidência (art. 3º)**: regra geral = município do estabelecimento prestador; exceções (incisos) = local da prestação. **[INCERTO]** a numeração dos incisos mudou (LC 157/2016). **NÃO hard-code o local — confie no `cLocIncid`** da NFS-e, que já resolve o art. 3º na emissão.
- **Retenção na fonte (art. 6º)**: lei municipal pode atribuir ao **tomador** a responsabilidade. **Efeito no prestador**: quando o ISS é retido pelo tomador, o prestador **não recolhe**. `aRecolher do prestador = Σ ISS dos serviços NÃO retidos`.
- **Simples Nacional**: ISS **dentro do DAS** (Anexos III/IV/V). **Exceção crítica**: se houve ISS **retido na fonte**, essa parcela é **segregada/desconsiderada** no cálculo do DAS (não tributar duas vezes). Se `regime == SIMPLES` → **NÃO** gerar `ApuracaoImposto('ISS')`; alimentar o PGDAS com a segregação por NFS-e (atividade/anexo + flag `issRetido`).

## 2. PONTO CRÍTICO — ISS vem de NFS-e, não de NFe/NFC-e/CT-e

O parser de NFe/NFC-e (ICMS/PIS/COFINS por item) **não** produz dados de ISS. Apurar ISS exige **conector + parser de NFS-e novos**.

### 2.1 Padrão Nacional da NFS-e (ambiente nacional / Sefin Nacional via SERPRO)
```
Prestador → DPS (Declaração de Prestação de Serviços, XML A1 assinado)
          → ambiente nacional valida → gera NFS-e + chave (50 díg.) + protocolo
          → DANFSe (PDF) e XML disponíveis
```
- **DPS** = o declarado (entrada); **NFS-e** = o documento autorizado (saída). DPS versão 1.01 (mar/2026).
- (verificado) **NT SE/CGNFS-e nº 007/2026** (vigência 09/02/2026) ampliou campos de retenção federal (PIS/COFINS/CSLL) e códigos de operação. **Confira a NT mais recente antes de fixar enums.**

### 2.2 Estrutura do XML — campos para apuração (verificado e CORRIGIDO)

(verificado contra Focus NFe — layout DPS/NFS-e Nacional; e Domínio — layout de importação. **Correções relevantes abaixo.**)

| Grupo | Campo | Caminho / formato | Uso |
|---|---|---|---|
| Identificação | chave de acesso | 50 díg. | chave única |
| Prestador (`prest`) | CNPJ/CPF, IM, regime | — | "minhas emitidas" |
| Tomador (`toma`) | CNPJ/CPF, nome, município IBGE | — | "minhas recebidas"/retenção |
| Serviço | **`cTribNac`** | Integer[6] — "Código de tributação nacional do ISSQN" | classificação/anexo |
| | **`cTribMun`** | Integer[3] — "Código de tributação municipal" | classificação fina |
| | **`cLocPrestacao`** | Integer[7] IBGE — local da prestação (DPS) | dimensão de local (entrada da regra) |
| | **`cLocIncid`** | IBGE — **gerado pela API** na NFS-e autorizada, a partir da regra do `cTribNac` + endereços | dimensão `municipioIncidencia` (saída, autoritativa) |
| | `xDescServ` / `cNBS` | — | conferência / classificação |
| Valores (autorizada) | **`vServ`** | `DPS/infDPS/valores/vServPrest/vServ` | base bruta |
| | **`vBC`** | `infNFSe/valores/vBC` | base × alíquota |
| | **`pAliqAplic`** | `infNFSe/valores/pAliqAplic` | alíquota aplicada (2%–5%) |
| | **`vISSQN`** | `infNFSe/valores/vISSQN` | débito |
| Tributação ISSQN (`tribMun`) | `tribISSQN` | indicador: tributável/imunidade/exportação/não-incidência | exclui não-tributáveis |
| | **`tpRetISSQN`** | **1 = NÃO Retido; 2 = Retido pelo Tomador; 3 = Retido pelo Intermediário** | decide o `aRecolher` |
| Retenção federal (`tribFed`) | `tpRetPisCofins`, `vRetPis/Cofins/CSLL/IRRF` | NT 007/2026 ampliou domínio | conciliação federal (não-ISS) |

> **CORREÇÃO CRÍTICA (verificado: Focus NFe + TecnoSpeed Rejeição E0625):** a polaridade de `tpRetISSQN` é o **INVERSO** do que a spec original assumiu. O correto é:
> - **`tpRetISSQN = 1` → ISSQN NÃO Retido** (prestador recolhe).
> - **`tpRetISSQN = 2` → Retido pelo Tomador** (prestador NÃO recolhe).
> - **`tpRetISSQN = 3` → Retido pelo Intermediário** (prestador NÃO recolhe).
> Regra de validação que confirma: quando há retenção (`tpRetISSQN` ∈ {2,3}) é obrigatório informar a alíquota; quando `tpRetISSQN=1` (não retido) e prestador é Simples, **não** se informa alíquota. **NÃO inverter na implementação.** (Há fontes secundárias que escrevem o oposto — a Focus NFe e a regra de rejeição E0625 do ambiente nacional são as autoritativas; ainda assim, validar contra o XSD oficial antes de produção.)
> **CORREÇÃO (verificado):** o local de prestação na **DPS** é `cLocPrestacao` (IBGE 7 díg.); o `cLocIncid` (local de incidência do ISSQN) é **gerado pela API** na NFS-e autorizada, derivado da regra legal vinculada ao `cTribNac` (decide se usa endereço do prestador, do tomador, ou o `cLocPrestacao`). Para a dimensão `municipioIncidencia`, **ler `cLocIncid` da NFS-e autorizada**; em DPS, usar `cLocPrestacao` como proxy.
> **[INCERTO — alto]** Caminhos/agrupamento exatos de `tribISSQN`/`tribMun`/`tribFed` e nomes residuais divergem entre fontes secundárias. **Baixar o XSD/leiaute oficial em `gov.br/nfse → documentação técnica` e validar contra XML real antes de mapear o parser.**

### 2.3 Captura — ingestão de NFS-e (sub-etapa nova)
Origem via **ambiente nacional (ADN)**, auth por **certificado e-CNPJ**:
1. **Distribuição DF-e** (recomendado): API que entrega por **NSU** os DF-e em que o contribuinte é emitente/tomador/intermediário; lote até **50** por requisição; cursor incremental pelo "último NSU". Cobre emitidas (débito do prestador) e recebidas (ISS retido como tomador-substituto).
2. **Consulta por chave (50 díg.)**: NFS-e específica (XML + DANFSe).

> **[INCERTO]** Nomes de endpoints, formato (XML direto vs base64/gzip) e cobertura dependem de o **município emissor estar conveniado** ao SN NFS-e. Municípios ainda em layout ABRASF próprio **não** aparecem no ADN — **gap conhecido** (conector municipal legado fora do escopo). Confirmar no "Guia das APIs do ADN" (gov.br/nfse).

```
[Conector NFS-e Nacional (ADN)] ── novo (auth e-CNPJ; Distribuição DFe por NSU lote 50; Consulta por chave)
   ↓ XML NFS-e
[Parser NFS-e] ── novo, isolado do parser NFe/NFC-e
   → DocumentoServico { chave, prest, toma, serv[cTribNac, cLocIncid|cLocPrestacao],
                        vServ, vBC, pAliqAplic, vISSQN, tribISSQN, tpRetISSQN }
   ↓
[Motor ISS] → ApuracaoImposto(imposto='ISS', competencia, municipioIncidencia)
```

## 3. Apuração do ISS (motor determinístico)

### 3.1 Fórmula (Lucro Real / Lucro Presumido; Simples → §1)
Por competência e por município de incidência (`cLocIncid`):
```
debito_ISS = Σ vISSQN   das NFS-e EMITIDAS com tribISSQN = tributável
                        E tpRetISSQN = 1 (NÃO retido → prestador recolhe)
issRetido  = Σ vISSQN   das NFS-e emitidas com tpRetISSQN ∈ {2,3} (já retido; informativo)
aRecolher  = debito_ISS
credito = 0 ; saldoCredorAnterior = 0 ; saldoCredorTransportar = 0
```
- `vISSQN` ausente mas com base+alíquota: `vISSQN = vBC × pAliqAplic`. Prefira sempre o **valor declarado** quando presente.
- **Excluir do débito**: `tribISSQN` = imunidade / exportação / não-incidência.
- **Não somar** ISS de NFS-e **recebidas** (insumo; ISS não credita) — só relevante se a empresa for **tomador-substituto** que reteve (§3.3).

> Atenção à correção §2.2: o débito do prestador entra **quando `tpRetISSQN = 1`** (não retido). Itens com `tpRetISSQN` 2 ou 3 saem do `aRecolher`.

### 3.2 Particionamento por município
Chave de apuração: **(empresa, competência, 'ISS', municipioIncidencia)**.
- **Opção A (recomendada)**: `ApuracaoImposto` por (empresa, competência, 'ISS') agregando todos os municípios + tabela-filha `ApuracaoIssMunicipio` para o split.
- Opção B: uma linha por município (mais fiel a "uma guia por município", mas quebra o uniqueness atual).

### 3.3 ISS retido como RESPONSÁVEL (empresa é tomador-substituto)
Quando a empresa é **TOMADOR** e a lei municipal a torna responsável, recolhe o ISS retido das NFS-e **recebidas** com `tpRetISSQN ∈ {2,3}` apontando a empresa. Modele linha separada (`imposto='ISS_RETIDO_FONTE'` ou flag `responsabilidade='SUBSTITUTO'`), `debito = Σ vISSQN retido nas recebidas`. **[INCERTO]** Provavelmente **fora do MVP** (MVP cobre o ISS-próprio do prestador).

## 4. Resumo de decisões (ISS)

| Decisão | Valor |
|---|---|
| Fonte do ISS | **NFS-e** (nunca NFe/NFC-e/CT-e) — conector + parser novos |
| Crédito | **inexistente** — `credito/saldo* = 0` |
| Alíquota/base | **lidas da NFS-e** (`pAliqAplic`, `vBC`) |
| Local/credor | **`cLocIncid`** (NFS-e autorizada; `cLocPrestacao` na DPS) — não hard-code art. 3º |
| Retenção | `tpRetISSQN`: **1=não retido (prestador recolhe)**, 2/3=retido (não recolhe) ⚠ polaridade corrigida |
| Simples | ISS no DAS; segregar receita com ISS retido; **não** criar `ApuracaoImposto('ISS')` |
| Captura | ADN / Distribuição DF-e por **NSU** (lote 50) + consulta por **chave 50 díg.**; auth **e-CNPJ** |
| Gap | municípios não conveniados (ABRASF próprio) não vêm pelo ADN |

**Antes de codar, baixar e validar contra XSD oficial**: leiaute NFS-e Nacional v1.01 + NT SE/CGNFS-e 007/2026 + Guia das APIs do ADN (gov.br/nfse). Caminhos exatos de `tribISSQN`/`tribMun` e a polaridade de `tpRetISSQN` (§2.2) devem ser revalidados no XSD.

---

## Arquivos relevantes (caminhos absolutos)
- `G:\APP\apurax\prisma\schema.prisma` — `ItemDocumento` (campos IPI), enum `Tributo` (+IPI), `ApuracaoImposto` (avaliar `outrosDebitos/outrosCreditos` e `retencaoFonte`), opcional `Empresa.contribuinteIpi`, nova `ApuracaoIssMunicipio`
- `G:\APP\apurax\src\fiscal\nfe-parser.service.ts` — parsing do grupo IPI (não usar `grupoInterno`)
- `G:\APP\apurax\src\fiscal\nfe.service.ts` — persistir campos IPI do item
- `G:\APP\apurax\src\motor-credito\motor-credito.types.ts` e `motor-credito.service.ts` — crédito de IPI determinístico
- (novo) serviço de apuração de período IPI → `ApuracaoImposto imposto='IPI'` (análogo ao ICMS/E110)
- (novo) serviço de débito PIS/COFINS → `ApuracaoImposto imposto='PIS'|'COFINS'`
- (novo) conector NFS-e Nacional (ADN) + parser NFS-e isolado + motor ISS

## Fontes
- IPI: [Decreto 7.212/2010 (RIPI)](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/decreto/d7212.htm); [Guia Prático EFD-ICMS/IPI](http://sped.rfb.gov.br/estatico/E4/4A860113D8DEACA0CB7E609E7BDE7419EED43E/GUIA%20PR%C3%81TICO%20EFD%20ICMS%20IPI%20-%20v.%203.01.pdf); [VRI E520](https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=150); [VRI E530](https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=151); [flexdocs grupo IPI](https://flexdocs.net/suporte/knowledgebase.php?article=304); [CDM CST-IPI](https://cdmcontabilidade.com.br/tabela-cst-ipi/)
- PIS/COFINS: [VRI M200](https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=496); [Guia EFD-Contribuições](http://sped.rfb.gov.br/estatico/1D/5B40578A64FD1B6DE7BC9705D82AC59D4EC0BD/Guia_Pratico_EFD_Contribuicoes_Versao_1_23.pdf); [M200/M600 Portal Revenda](https://portal.revendadesoftware.com.br/faqs/como-informar-os-registros-m200-e-m600-no-sped-contribuicoes); [CDM CST PIS/COFINS](https://www.cdmcontabilidade.com.br/tabela-cst-pis-cofins)
- ISS/NFS-e: [LC 116/2003](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm); [Focus NFe — DPS layout (cTribNac/cLocPrestacao/tpRetISSQN)](https://campos.focusnfe.com.br/nfse_nacional/EmissaoDPSXml.html); [Domínio — importação NFS-e Nacional (paths de valores)](https://suporte.dominioatendimento.com/central/faces/solucao.html?codigo=10103); [CIGAM — geração do cLocIncid](https://www.cigam.com.br/wiki/index.php?title=NFS-e_Nacional_-_Entendendo_a_gera%C3%A7%C3%A3o_do_C%C3%B3digo_do_Local_de_Incid%C3%AAncia_do_ISSQN_(Tag_cLocIncid)?); [TecnoSpeed — Rejeição E0625 (tpRetISSQN)](https://atendimento.tecnospeed.com.br/hc/pt-br/articles/36287842948759); [Manual Integração NFS-e v1.01](https://www.notacontrol.com.br/download/nfse/Manual_integracao_v101.pdf); [NT 007/2026 (TOTVS)](https://www.totvs.com/blog/fiscal-clientes/nfs-e-nacional-nota-tecnica-no-007-2026-esclarece-pis-cofins-retencoes-e-atualiza-codigos-de-operacao/)