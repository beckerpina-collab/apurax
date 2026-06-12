# Apuração fiscal multi-regime — NFC-e + ICMS + Simples (VERIFICADO)

# Apurax — Débito de Saídas (NFC-e mod. 65) + Apuração ICMS (regime normal / E110) + Simples Nacional (PGDAS-D)

> Documento consolidado e fact-checado para codificação. Data de referência: junho/2026. Tributos LEGADOS (ICMS/Simples) — não reforma.
> Convenção: **(verificado: <fonte>)** = batido contra fonte oficial/leiaute nesta rodada; **[INCERTO]** = depende de versão de NT/UF ou texto legal não acessado literalmente, validar antes do go-live.

---

## PARTE 1 — NFC-e (modelo 65): parser das SAÍDAS (débito de ICMS)

### 1.1 Premissa estrutural: mesmo schema da NF-e 55, leiaute 4.00
NFC-e (mod. **65**) e NF-e (mod. **55**) compartilham o **mesmo leiaute XML versão 4.00** e a mesma raiz (`nfeProc` → `NFe` → `infNFe`), definido no MOC / Ato COTEPE e nas Notas Técnicas. A diferença é o conjunto de campos obrigatórios/proibidos por `ide/mod`, não a estrutura raiz. **Estratégia: um único parser de saídas, ramificado por `ide/mod`.** Para a apuração de débito, o que importa não é o modelo, e sim **`emit/CRT`, `det/prod/CFOP`, o CST/CSOSN e o `vICMS` por item**. (verificado: leiaute 4.00 e infNFeSupl exclusivo do mod 65 — Portal SVRS NFC-e; MOC NF-e/NFC-e CONFAZ; Tecnospeed NT 2025.001.)

Diferenças mod 65 vs 55:

| Aspecto | NF-e 55 | NFC-e 65 |
|---|---|---|
| `ide/mod` | `55` | `65` (discriminador do parser) |
| `ide/indFinal` | `0` ou `1` | sempre `1` (consumidor final) |
| `ide/idDest` | 1/2/3 | sempre `1` (interna) — NFC-e **não admite** interestadual/exterior |
| `ide/indPres` | `1` ou outros | `1` (presencial), eventualmente outros |
| Grupo `dest` | **obrigatório** | **opcional/ausente** (B2C); quando presente, só `CPF`/`idEstrangeiro`, geralmente sem `enderDest` |
| `infNFeSupl` | **proibido** | **obrigatório** (`qrCode` + `urlChave`) |
| IPI | pode haver | ausente no varejo típico |
| DANFE | retrato/paisagem (tpImp 1/2) | DANFE-NFC-e (extrato, tpImp 4) |

> **[INCERTO / versão de QR-Code]**: a NT 2025.001 introduziu **QR-Code versão 3.00** (assinatura digital de campos, dispensa do CSC), com adoção obrigatória a partir de ~01/09/2025 (exceto PR e ressalvas). Muda apenas o **conteúdo do `qrCode`**, não a tag, e **é irrelevante para a apuração de ICMS** (não se parseia QR-Code para débito). Apenas registre que XML de 2025+ pode trazer QR v3. (verificado: Tecnospeed NT 2025.001; MOC SPED Fazenda PR.)

### 1.2 Identificação — `infNFe/ide`
Raiz: `nfeProc/NFe/infNFe` (`@versao="4.00"`, `@Id="NFe"+chave44`); doc autorizado em `protNFe/infProt` (`chNFe`, `cStat=100`).

| Tag | Uso na apuração |
|---|---|
| `ide/mod` | `55`/`65` — discriminador (mesmo parser) |
| `ide/serie`, `ide/nNF` | identificação/dedup junto à chave de acesso |
| `ide/dhEmi` | **define a competência** (mês de apuração). Formato UTC c/ offset, ex. `2026-06-09T10:15:00-03:00` |
| `ide/tpNF` | `0`=entrada, `1`=saída → **filtrar `tpNF=1`** p/ débito (em NFC-e é sempre 1; valide) |
| `ide/tpAmb` | `1`=produção, `2`=homologação → **rejeitar `tpAmb=2`** na apuração |
| `ide/idDest`, `ide/indFinal`, `ide/indPres`, `ide/finNFe`, `ide/cUF` | classificação |

### 1.3 Emitente e REGIME — `infNFe/emit` (roteador do motor multi-regime)
- `emit/CNPJ` (ou `CPF`), `emit/IE`.
- **`emit/CRT` é o roteador crítico:** `1`=Simples Nacional; `2`=Simples – excesso de sublimite; `3`=Regime Normal (Lucro Real/Presumido); `4`=MEI. **Use o CRT do EMITENTE da saída, não do destinatário**, e reconcilie contra o cadastro Apurax. Regra: `CRT=3` → grupo `ICMSnn` (CST) → soma `vICMS` ao débito do E110. `CRT ∈ {1,2}` → grupo `ICMSSNnnn` (CSOSN) → não gera débito; alimenta a receita segregada do PGDAS-D. (verificado: CRT 1/2/3 — leiaute NF-e/NFC-e, FocusNFe CSOSN.)
- **[INCERTO]** `CRT=4` (MEI): introduzido por NT; tratar como Simples. Confirmar disponibilidade na NT vigente da UF antes de assumir presença no XML.

### 1.4 Itens — `infNFe/det` (1..N, `@nItem`) / `prod`
`det/prod`: `cProd`, `cEAN`, `xProd`, `NCM`, `CEST` (quando ST), **`CFOP`** (natureza da operação — chave da saída), `uCom`, `qCom`, `vUnCom`, **`vProd`**, `vDesc`, `vFrete`, `vSeg`, `vOutro`, `indTot` (1 = `vProd` compõe o total).

### 1.5 ICMS por item (regime normal, CRT=3) — `det/imposto/ICMS/ICMSnn`
Grupo **polimórfico** (exatamente UM filho por item), `nn` = CST. `orig` (0–8) precede o `CST`.

| Grupo (CST) | Significado | Campos p/ débito |
|---|---|---|
| `ICMS00` (00) | Tributada integral | `modBC`, `vBC`, `pICMS`, **`vICMS`** ← débito direto |
| `ICMS10` (10) | Tributada + ST | `vICMS` (próprio) + `vBCST`, `pICMSST`, `vICMSST` (ST à parte) |
| `ICMS20` (20) | Redução de BC | `pRedBC`, `vBC`, `pICMS`, **`vICMS`** |
| `ICMS30` (30) | Isenta/não-trib + ST | sem ICMS próprio; `vICMSST` |
| `ICMS40/41/50` (40/41/50) | Isenta / não-trib / suspensão | `vICMSDeson` quando há; **sem débito** |
| `ICMS51` (51) | Diferimento | `vBCFCPDif`/`vICMSDif`, `vICMS` (parte devida) — **[INCERTO]: regra de diferimento é estadual** |
| `ICMS60` (60) | ST cobrada anteriormente | `vICMSSTRet` — **NÃO gera débito próprio** na revenda |
| `ICMS70` (70) | Redução de BC + ST | `vICMS` próprio + `vICMSST` |
| `ICMS90` (90) | Outras | combinação |

**FCP** aparece no mesmo grupo (`vFCP`, `pFCP`; ST: `vFCPST`) — **segregar do ICMS próprio** (ver 2.4). CSTs que geram débito próprio: **00, 10, 20, 70, 90**. (verificado: grupos ICMSnn e campos — leiaute NF-e/NFC-e 4.00.)

### 1.6 ICMS no Simples (CRT 1/2) — `det/imposto/ICMS/ICMSSNnnn`
Emitente Simples **não destaca débito** na apuração débito-crédito; usa CSOSN (3 dígitos de situação).

| Grupo | CSOSN | Significado | Crédito p/ adquirente? |
|---|---|---|---|
| `ICMSSN101` | 101 | Tributada SN **com** permissão de crédito | Sim (`pCredSN`/`vCredICMSSN`) |
| `ICMSSN102` | 102/103/300/400 | Sem permissão de crédito / isenção / imune / não trib. | Não (sem valor de ICMS) |
| `ICMSSN201/202/203` | 201/202/203 | Com ICMS-ST (`vBCST`,`pICMSST`,`vICMSST`); 201 tem `vCredICMSSN` | 201=Sim, 202/203=Não |
| `ICMSSN500` | 500 | ST/antecipação cobrada antes (`vBCSTRet`, `vICMSSTRet`) | Não |
| `ICMSSN900` | 900 | Outros (pode ter `vICMS` próprio + ST + `vCredICMSSN`) | Conforme campos |

`vCredICMSSN` é o crédito que o emitente Simples transfere ao DESTINATÁRIO (relevante quando o Apurax processa a ENTRADA de quem comprou) — **não é débito de ICMS da saída**. (verificado: tabela CSOSN — FocusNFe; leiaute ICMSSN.)

### 1.7 Totais — `infNFe/total/ICMSTot` (conferência, não fonte primária)
Campos: `vBC`, **`vICMS`** (soma do ICMS próprio = débito total da nota), `vICMSDeson`, `vFCP`, `vBCST`, **`vST`**, `vProd`, `vFrete`, `vSeg`, `vDesc`, `vIPI`, `vPIS`, `vCOFINS`, `vOutro`, **`vNF`**; DIFAL: `vICMSUFDest`, `vICMSUFRemet`, `vFCPUFDest`.
**Conferência obrigatória (o "Conferência" do produto):** `Σ det/prod/vProd (indTot=1) == ICMSTot/vProd` **e** `Σ det ICMS/vICMS == ICMSTot/vICMS`. Divergência → flag de nota suspeita. Em NFC-e de Simples, `ICMSTot/vICMS` tende a 0. (verificado: campos ICMSTot — FlexDocs guia NF-e.)

### 1.8 Pagamento — `infNFe/pag` (irrelevante p/ ICMS; útil só p/ conciliação de caixa)
Em 4.00 `pag` é nó raiz (saiu de dentro de `det`). `pag/detPag` (1..N): `indPag`, `tPag`, `vPag`; `pag/vTroco`. **Trate `tPag` como string de 2 dígitos; não use enum fechado** (NTs recentes acrescentaram 17=PIX dinâmico, 18=transferência/carteira, 19=fidelidade/cashback, 20=PIX estático). **[INCERTO]**: presença de cada código depende da versão de schema aceita na data de emissão.

### 1.9 Cancelamento / denegação (impacto na apuração)
NFC-e **cancelada** (evento 110111, `cStat=101/135/155`) ou **denegada** (`cStat=110/301/302`) **NÃO entra como débito**. O XML autorizado não carrega o cancelamento — é preciso **cruzar a chave com os eventos (resumo/SPED)** para excluir canceladas da competência. Carta de correção não altera valores. (verificado: lógica de eventos — práticas SVRS/MOC; confirmar `cStat` exato de cancelamento no MOC vigente.)

### 1.10 O que o parser extrai para o débito (regime normal)
Por nota não cancelada, `tpNF=1`, `tpAmb=1`, `CRT=3`, alocada por `dhEmi`:
```
debito_icms_item = vICMS (grupo ICMSnn)        // CST 40/41/50/60 => 0
debito_icms_nota = Σ itens (== ICMSTot.vICMS)
debito_icms_st   = Σ vICMSST                    // bucket SEPARADO (não entra no E110 campo 02)
```
NF-e mod 55 de saída entra na mesma trilha. SPED (C100/C190) é fonte alternativa/agregada quando não houver XML individual.

---

## PARTE 2 — Apuração de ICMS, REGIME NORMAL (débito − crédito → saldo / E110)

Base legal: **LC 87/1996 (Lei Kandir)**, art. 19–20 (não-cumulatividade) e art. 24–25 (apuração por período e transporte de saldo credor). Materialização operacional = **registro E110 da EFD-ICMS/IPI** (Guia Prático EFD-ICMS/IPI). (verificado: E110 — VRI Consulting / Guia Prático.)

### 2.1 Princípio
ICMS é **não-cumulativo e por período** (mensal, em regra): `SALDO = débitos das saídas − créditos das entradas`. Saldo devedor → ICMS a recolher; saldo credor → **transporta** para o mês seguinte (não vira dinheiro; acumula até ser consumido). O crédito de entradas já é o motor existente do Apurax; o débito vem da Parte 1.

### 2.2 Registro E110 — campos na ordem do leiaute (modelo de dados)

| # | Campo | Significado | Origem no Apurax |
|---|---|---|---|
| 01 | `REG` | "E110" | fixo |
| 02 | **`VL_TOT_DEBITOS`** | Σ débitos por saídas (operações próprias) | Σ `vICMS` das saídas (Parte 1) — ver regra CFOP em 2.3 |
| 03 | `VL_AJ_DEBITOS` | Ajustes a débito por documento | C195/C197/D195/D197 |
| 04 | `VL_TOT_AJ_DEBITOS` | Total ajustes a débito da apuração | Σ ajustes E111 (débito) |
| 05 | `VL_ESTORNOS_CRED` | Estornos de crédito | E111 |
| 06 | **`VL_TOT_CREDITOS`** | Σ créditos por entradas | **motor de crédito existente** |
| 07 | `VL_AJ_CREDITOS` | Ajustes a crédito por documento | C195/C197… |
| 08 | `VL_TOT_AJ_CREDITOS` | Total ajustes a crédito | Σ ajustes E111 (crédito) |
| 09 | `VL_ESTORNOS_DEB` | Estornos de débito | E111 |
| 10 | `VL_SLD_CREDOR_ANT` | Saldo credor do período anterior | carry-over de N-1 |
| 11 | `VL_SLD_APURADO` | Saldo devedor apurado (se ≥ 0) | fórmula 2.3 |
| 12 | `VL_TOT_DED` | Deduções (incentivos etc.) | E111 deduções |
| 13 | **`VL_ICMS_RECOLHER`** | ICMS a recolher | `VL_SLD_APURADO − VL_TOT_DED` (≥0) |
| 14 | `VL_SLD_CREDOR_TRANSPORTAR` | Saldo credor a transportar p/ N+1 | ver fórmula (inclui `+VL_TOT_DED`) |
| 15 | `DEB_ESP` | Débitos especiais (extra-apuração) | E111 |

(verificado: ordem e semântica dos campos — VRI Consulting idGuia=136 / Guia Prático EFD.)

### 2.3 Fórmula determinística (a codar) — **CORRIGIDA**
```
TOTAL_DEBITOS  = VL_TOT_DEBITOS + VL_AJ_DEBITOS + VL_TOT_AJ_DEBITOS + VL_ESTORNOS_CRED
TOTAL_CREDITOS = VL_TOT_CREDITOS + VL_AJ_CREDITOS + VL_TOT_AJ_CREDITOS
                 + VL_ESTORNOS_DEB + VL_SLD_CREDOR_ANT

SALDO = TOTAL_DEBITOS − TOTAL_CREDITOS

se SALDO >= 0:                          # apuração devedora
    VL_SLD_APURADO            = SALDO
    VL_ICMS_RECOLHER          = max(VL_SLD_APURADO − VL_TOT_DED, 0)
    VL_SLD_CREDOR_TRANSPORTAR = 0
senão:                                   # apuração credora
    VL_SLD_APURADO            = 0
    VL_ICMS_RECOLHER          = 0
    VL_SLD_CREDOR_TRANSPORTAR = |SALDO| + VL_TOT_DED     # <<< CORREÇÃO
```
**CORREÇÃO importante (verificado: VRI Consulting idGuia=136, transcrição literal do Guia Prático):** quando a apuração é credora, o `VL_SLD_CREDOR_TRANSPORTAR` recebe **o valor absoluto da expressão MAIS o `VL_TOT_DED`** (as deduções são incorporadas ao saldo credor transportado), não apenas `|SALDO|`. As três versões originais traziam apenas `|resultado|` — incompleto. Na prática, com `VL_TOT_DED=0` (caso comum), o resultado coincide; mas implemente o termo `+VL_TOT_DED` para conformidade com a regra de validação do SPED.

Regras críticas:
- **`VL_ICMS_RECOLHER` nunca é negativo**; excedente de crédito vai inteiro para `VL_SLD_CREDOR_TRANSPORTAR` (art. 24 §3º LC 87/96).
- **Carry-over:** `VL_SLD_CREDOR_TRANSPORTAR[m]` → `VL_SLD_CREDOR_ANT[m+1]`. Encadear como ponteiro entre `ApuracaoImposto` consecutivas. Saldo credor não expira.
- **`VL_ICMS_RECOLHER` é o "saldo a recolher de ICMS"** que o usuário pediu.
- **Validação cruzada E116:** `VL_ICMS_RECOLHER + DEB_ESP == Σ VL_OR` dos registros E116 (obrigações a recolher). Use como teste de consistência. (verificado: regra de validação — VRI Consulting.)

### 2.3.1 Composição de `VL_TOT_DEBITOS` — regra CFOP 5605/1605 — **CONFIRMADA**
`VL_TOT_DEBITOS` (campo 02) = Σ `VL_ICMS` dos registros analíticos (C190 etc.) para **CFOP iniciado em 5, 6, 7 E CFOP 1605**; **EXCLUI CFOP 5605**. O CFOP **5605** (transferência de saldo DEVEDOR de ICMS para outro estabelecimento da mesma empresa) **NÃO compõe o débito (campo 02) — vai para `VL_TOT_CREDITOS` (campo 06)**; o **1605** (recebimento, por transferência, de saldo devedor) **compõe o débito (campo 02)** e é excluído do crédito. (verificado: regra de validação oficial do SPED — VRWiki VRsoft "Registro E110 - 2 - VL_TOT_DEBITOS"; SEFAZ-BA OT.) Para a maioria dos contribuintes 5605/1605 não ocorre; trate como caso de borda mas implemente o filtro correto.

### 2.4 O que fica DE FORA do confronto débito×crédito (apurações irmãs)

| Item | Por quê / recolhimento | Sinalização no Apurax | Registro EFD |
|---|---|---|---|
| **ICMS-ST** | apuração própria do substituto | `vICMSST` em bucket `icmsST` | **E200/E210** |
| **DIFAL EC 87/2015** (venda interestadual a consumidor final **não contribuinte**) | desde 2019 **100% UF destino**; guia/GNRE própria | `idDest=2`+`indFinal=1`+dest. não contribuinte; `vICMSUFDest`/`vICMSUFRemet` | **E300/E310** (só UF destino) + **E316** |
| **DIFAL interestadual entre contribuintes** (uso/consumo/ativo) | apuração própria; entra no E110 via ajuste em parte das UFs, ou guia | flag `isDifalContribuinte` | E110/E111 (ajuste) ou guia — **[INCERTO]: depende da UF** |
| **FCP/FECP** | adicional vinculado, código/guia próprio | bucket `fcp` (`vFCP`,`vFCPST`,`vFCPUFDest`) | **E310** (campos FCP) + E316 |
| **Antecipação tributária** | recolhimento na entrada (mercadoria de outra UF) | flag `isAntecipacao` | varia por UF — **[INCERTO]** |

**Regra de ouro:** no débito da apuração normal, **inclua apenas `vICMS` próprio** dos CST que geram débito; **exclua** `vICMSST`, `vFCP*` e os DIFAL. (verificado: ST em E210 separado, DIFAL E300/E310 100% destino desde 2019 — VRI/Sankhya/SPED-MG manuais.)

> **[INCERTO / reforma 2026]**: já há Nota Técnica de adequação da NF-e/NFC-e para CBS/IBS (grupos novos no leiaute). Esta apuração E110 segue válida para o ICMS legado na transição; mantenha o **parser tolerante** (não quebrar com tags `IBSCBS` desconhecidas). Confirmar se há ajuste de leiaute na EFD 2026.

### 2.5 Modelagem (`ApuracaoImposto`)
Uma linha por `(empresaId, competencia YYYY-MM, imposto)`. ICMS normal:
```
ApuracaoImposto {
  empresaId, competencia, imposto: 'ICMS',
  debito,                  // E110.02 (CFOP 5/6/7 + 1605, exclui 5605)
  ajusteDebito,            // E110.03+04+05
  credito,                 // E110.06 (motor existente)
  ajusteCredito,           // E110.07+08+09
  saldoCredorAnterior,     // E110.10 (carry-over de N-1)
  totalDeducoes,           // E110.12
  debitosEspeciais,        // E110.15
  saldoApurado,            // E110.11
  aRecolher,               // E110.13 (>=0)  | mutuamente exclusivo com:
  saldoCredorTransportar,  // E110.14 = |saldo| + totalDeducoes
}
```
Buckets segregados (apurações irmãs, fora do confronto): `imposto='ICMS_ST'` (E210), `'ICMS_DIFAL'` (E310), `'FCP'`. Versionar por vigência de alíquota/UF (reusar o versionamento já existente do crédito).

---

## PARTE 3 — Simples Nacional: DAS / PGDAS-D (NÃO é débito-crédito)

Base legal: **LC 123/2006, art. 18** e **Resolução CGSN nº 140/2018**; cálculo no **PGDAS-D**. **Não há crédito de entrada nem confronto** — o tributo incide sobre a **receita bruta do mês**, com alíquota efetiva progressiva, e o DAS é guia única que reparte vários tributos. **O motor de crédito de entradas do Apurax é IRRELEVANTE para o Simples** (exceto o `vCredICMSSN`, informativo, que ela transfere ao cliente). Sinalizar isto na UI.

### 3.1 Variáveis
- **PA** = período de apuração (mês). **RPA** = receita bruta do PA (segregada por anexo + por tipo).
- **RBT12** = receita bruta acumulada dos **12 meses anteriores** ao PA (não inclui o mês corrente) → define a **faixa**.
- **Aliq** = alíquota nominal da faixa; **PD** = parcela a deduzir.

### 3.2 Fórmula da alíquota efetiva (art. 18 §1º) — **CONFIRMADA**
```
Aliquota_Efetiva = (RBT12 × Aliq − PD) / RBT12
DAS_anexo        = Receita_do_mes_no_anexo × Aliquota_Efetiva
DAS_total        = Σ DAS_anexo
Valor_tributo_X  = DAS_anexo × percentual_reparticao_X(anexo, faixa)
```
A faixa (Aliq/PD) é escolhida pela **RBT12**, não pela receita do mês. Calcula-se uma alíquota efetiva por anexo/segregação. (verificado: fórmula art. 18 §1º — Receita/Resolução CGSN 140/2018; Contabilizei.)

### 3.3 Início de atividade (RBT12 proporcional) — **CONFIRMADA**
- **1º mês:** `RBT12 = RPA_do_mês × 12`.
- **Meses 2–12:** `RBT12 = (média aritmética da RB dos meses já decorridos) × 12 = (Σ receitas dos meses anteriores / nº de meses decorridos) × 12`.
- A partir do **13º mês:** RBT12 "cheio" (soma real dos 12 meses anteriores). (verificado: regra de proporcionalização — Res. CGSN 140/2018 art. 21; Blog Contabilidade.com.)

### 3.4 Tabelas dos Anexos 2026 (valores inalterados em 2026) — **CONFIRMADAS**
Faixas (RBT12) idênticas em todos os anexos: 1ª ≤180k; 2ª 180k–360k; 3ª 360k–720k; 4ª 720k–1,8M; 5ª 1,8M–3,6M; 6ª 3,6M–4,8M.

**Anexo I — Comércio** (Aliq_nom % / PD R$): 4,00/0 · 7,30/5.940 · 9,50/13.860 · 10,70/22.500 · 14,30/87.300 · 19,00/378.000.
**Anexo II — Indústria:** 4,50/0 · 7,80/5.940 · 10,00/13.860 · 11,20/22.500 · 14,70/85.500 · 30,00/720.000. **[INCERTO: revalidar 5ª/6ª PD na Resolução]**
**Anexo III — Serviços:** 6,00/0 · 11,20/9.360 · 13,50/17.640 · 16,00/35.640 · 21,00/125.640 · 33,00/648.000. (verificado: Contabilizei Anexo III 2026.)
**Anexo IV — Serviços (CPP fora do DAS):** 4,50/0 · 9,00/8.100 · 10,20/12.420 · 14,00/39.780 · 22,00/183.780 · 33,00/828.000. **[INCERTO: revalidar na Resolução]**
**Anexo V — Serviços (Fator R < 28%):** 15,50/0 · 18,00/4.500 · 19,50/9.900 · 20,50/17.100 · 23,00/62.100 · 30,50/540.000. **[INCERTO: revalidar na Resolução]**

(verificado: Anexo I e Anexo III contra fontes; manter **todas** como tabela versionada por ano-vigência. Revalidar II/IV/V contra o texto da Res. CGSN 140/2018 antes de fixar constantes.)

### 3.5 Repartição do DAS por tributo — **CORRIGIDA (faixa a faixa)**
O DAS engloba, conforme o anexo: **IRPJ, CSLL, COFINS, PIS/Pasep, CPP, ICMS** (Anexos I e II) e **ISS** (III/IV/V; IV não tem CPP no DAS — recolhida à parte).

**Anexo I — Comércio (% sobre o DAS, por faixa) — verificado faixa a faixa:**

| Faixa | IRPJ | CSLL | COFINS | PIS/Pasep | CPP | ICMS |
|---|---|---|---|---|---|---|
| 1ª | 5,50% | 3,50% | 12,74% | 2,76% | **41,50%** | **34,00%** |
| 2ª | 5,50% | 3,50% | 12,74% | 2,76% | **41,50%** | **34,00%** |
| 3ª | 5,50% | 3,50% | 12,74% | 2,76% | **42,00%** | **33,50%** |
| 4ª | 5,50% | 3,50% | 12,74% | 2,76% | **42,00%** | **33,50%** |
| 5ª | 5,50% | 3,50% | 12,74% | 2,76% | **42,00%** | **33,50%** |
| 6ª* | 13,50% | 10,00% | 28,27% | 6,13% | 42,10% | — |

\* 6ª faixa **não tem ICMS** (parcela acima do sublimite; ICMS/ISS saem do DAS). Cada linha soma 100%.

**CORREÇÃO (verificado: Lefisc Anexo I; resumo da tabela oficial Receita idArquivoBinario=48430):** a repartição CPP/ICMS **muda na 3ª faixa**, não é uniforme. Faixas **1ª e 2ª = CPP 41,50% / ICMS 34,00%**; faixas **3ª, 4ª e 5ª = CPP 42,00% / ICMS 33,50%**. O documento (A) original já trazia este recorte corretamente; os documentos (B) e (C) o simplificaram para uma única linha (B dava só a 6ª; C aplicava "41,50/34,00" só às faixas 1–2 mas listou "42,00/33,50" como se fosse o caso geral). Uma extração secundária (Contabilizei) chegou a mostrar "1ª–4ª = 42,00/33,50", o que é **errado** — artefato de scraping. **Use a matriz acima.** Diferença centesimal residual entre Σ percentuais e a alíquota efetiva é alocada ao tributo de maior repartição na faixa.

> **Carregar as matrizes de repartição dos Anexos II–V** da Res. CGSN 140/2018 como tabela versionada (I e II têm ICMS; III/IV/V têm ISS). **[INCERTO]: só as matrizes do Anexo I foram verificadas faixa a faixa nesta rodada — extrair II–V da Resolução antes de codar.** Limite: a parcela efetiva de **ISS é limitada a 5%**; excedente é redistribuído aos tributos federais (art. 21 da Resolução). (verificado: regra do teto ISS — Manual PGDAS-D / Res. 140.)

### 3.6 Fator R (Anexo III vs V) — **CONFIRMADO**
```
Fator_R = FS12 / RBT12      # FS12 = folha de salários 12m (inclui pró-labore + encargos/FGTS)
Fator_R >= 0,28  → Anexo III
Fator_R <  0,28  → Anexo V
```
Recalculado mês a mês (RBT12 e FS12 móveis). Aplica-se aos serviços listados no art. 18 §§5º-J/5º-M (TI, engenharia, consultoria, contabilidade, medicina/odontologia, arquitetura, fisioterapia etc., conforme CNAE). **[INCERTO]**: o motor precisa de mapa **CNAE → anexo / sujeito a Fator R** — extrair da LC 123/Res. 140 vigente. (verificado: limiar 28% e direção III/V — Contabilizei/Contaja.)

### 3.7 Sublimite de ICMS/ISS — R$ 3.600.000,00 — **CORRIGIDA a fonte**
- **Sublimite 2026 = R$ 3.600.000,00** para todos os Estados e DF, fixado pela **Portaria CGSN nº 54/2025, de 17/11/2025** (DOU 19/11/2025). (verificado: Receita/Simples Nacional; FENACON; Senior — Portaria CGSN 54/2025.) **CORREÇÃO:** o documento (B) citou "Portaria CGSN nº 49/2024" — incorreta para 2026 (a 49/2024 fixou o sublimite de 2025). Use **54/2025**.
- `RBT12 ≤ 3.600.000` → ICMS e ISS dentro do DAS.
- `RBT12 > 3.600.000` (e ≤ 4,8M) → permanece no Simples para tributos **federais**; **ICMS e ISS saem do DAS** e passam ao regime normal (débito-crédito de ICMS — volta à Parte 2; o motor de crédito do Apurax volta a ser relevante). Reflete no XML como `emit/CRT=2`. Flag `icmsForaDoSimples`.
- **Regra de virada do sublimite (art. 12 Res. CGSN 140) — CONFIRMADA:** excesso **≤ 20%** do sublimite → efeitos no **ano-calendário seguinte**; excesso **> 20%** → efeitos a partir do **mês seguinte** ao da ultrapassagem. (verificado: Res. CGSN 140/2018 art. 12; RC SEFAZ-SP.)

### 3.8 O que fica FORA do DAS (recolhido à parte) — **CONFIRMADA**
- **ICMS-ST** (substituição): já recolhido por ST → segregar a receita (não recolhe ICMS de novo no DAS). Itens `CSOSN 500/201/202/203`.
- **ICMS antecipação / DIFAL de entrada** (fronteira): fora do DAS, regra estadual.
- **DIFAL EC 87/2015 (consumidor final NÃO contribuinte):** por decisão do **STF**, o optante do Simples **NÃO recolhe** esse DIFAL → tratar como **não devido**. (verificado: STF — liminar ADI 5464 e mérito ADI 5469, cláusula nona do Convênio ICMS 93/2015 inconstitucional p/ optantes do Simples.) Distinto do diferencial de alíquota do art. 13 §1º XIII da LC 123 (antecipação interna), que pode ser devido conforme a UF.
- **ICMS importação**, **ISS retido na fonte** (recolhido pelo tomador), **CPP do Anexo IV** (contribuição patronal à parte): fora do DAS.

### 3.9 Segregação de receitas (o que o parser de saídas alimenta no PGDAS-D)
Para emitente Simples (`CRT 1/2`), classifique cada item/nota por:
- **Anexo** (I–V) — pela atividade/CNAE, **não pelo XML** (precisa do mapa CNAE→anexo).
- **Com vs sem ICMS-ST/monofásico:** `CSOSN 500/201/202/203` → receita "com ICMS por ST" → a parcela de ICMS da repartição é **segregada/desconsiderada**. `CSOSN 101/102/103/300/400/900` sem ST → tributada normalmente no DAS.
- **Exportação / imune / isenção-redução estadual** → segregações próprias que reduzem a parcela de ICMS/ISS.
O **`CSOSN` é o discriminador de segregação de receita** para o PGDAS-D, análogo ao CST/CFOP no regime normal.

### 3.10 Modelagem (`ApuracaoSimples`)
```
ApuracaoSimples {
  empresaId, competencia,
  receitaMes (RPA, segregada por anexo+tipo),
  rbt12, fs12?, fatorR?, anexo, faixa,
  aliquotaNominal, parcelaDeduzir,
  aliquotaEfetiva,            // (rbt12*aliqNom - PD)/rbt12
  dasTotal,                   // Σ (receita_anexo * aliqEfetiva)
  reparticao: { irpj, csll, cofins, pis, cpp, icms, iss? },  // matriz[anexo][faixa]
  foraDoDAS: { icmsST, difalAntecip, issRetido, cppAnexoIV },
  icmsForaDoSimples: bool,    // rbt12 > 3.600.000
}
```
**Diferença estrutural vs ICMS normal:** sem `credito`, sem `saldoCredorAnterior`, sem transporte. Cada mês é independente (salvo o encadeamento da RBT12, que só lê receitas passadas).

---

## PARTE 4 — Resumo de decisões para o motor multi-regime

```
para cada PA, por empresa:
  regime = empresa.regime (validar contra emit/CRT dos XMLs de saída)

  se CRT==3 (ou Simples acima do sublimite p/ ICMS):
      // Parte 2 — débito-crédito (E110)
      debito  = Σ vICMS saídas (mod 65 + 55 + SPED C190), exclui canceladas e CST 40/41/50/60;
                inclui CFOP 5/6/7 + 1605, exclui 5605
      credito = motor_credito_entradas (existente)
      saldo   = E110(debito, credito, saldoCredorAnt, ajustes, deducoes)
      saida   = VL_ICMS_RECOLHER  XOR  saldoCredorTransportar (=|saldo|+VL_TOT_DED)

  se CRT==1/2 (Simples dentro do sublimite p/ ICMS):
      // Parte 3 — PGDAS-D (sem débito-crédito)
      por anexo: aliqEfetiva = (RBT12*aliqNom - PD)/RBT12   // FatorR decide III vs V
      DAS = Σ (receita_anexo * aliqEfetiva)
      reparticao = DAS_anexo * matriz[anexo][faixa]
      foraDoDAS = {ICMS-ST, DIFAL/antecip., ISS retido, CPP AnexoIV}; DIFAL EC87 = não devido
```

**Discriminadores-chave no parser:** `ide/mod` (55/65 → mesmo parser), `emit/CRT` (1/2/3/4 → qual apuração roda), `det/imposto/ICMS/<grupo>` (CSTnn → débito destacado vs CSOSNnnn → receita segregada), `det/prod/CFOP` (débito / estorno / transferência 5605/1605).

---

## Pendências a fechar com fonte primária antes do go-live (resumo dos [INCERTO])
1. **Matrizes de repartição dos Anexos II–V** e **PD das 5ª/6ª faixas dos Anexos II/IV/V** — extrair do texto da **Res. CGSN 140/2018** (só Anexo I foi verificado faixa a faixa; Anexo III faixas/PD verificadas).
2. **Mapa CNAE → anexo / sujeito a Fator R** — LC 123 art. 18 §§5º + Res. 140.
3. **Diferimento (CST 51)** e **antecipação tributária** — regras estaduais por UF.
4. **DIFAL entre contribuintes** — entra no E110 (ajuste) ou guia, conforme UF; tabela 5.1.1 do E111 por UF; E115/E116 por UF.
5. **`cStat` exato de cancelamento/denegação** e enum completo de `tPag` — confirmar no MOC/XSD (PL_009 / 4.00) vigente na data de emissão; **CRT=4 (MEI)** na NT da UF.
6. **EFD 2026 / reforma** — verificar se há campos novos (CBS/IBS) no leiaute; manter parser tolerante.

---

## Fontes
- Leiaute NF-e/NFC-e 4.00, CRT, CSOSN, ICMSTot, infNFeSupl: [Portal NFC-e SVRS](https://dfe-portal.svrs.rs.gov.br/Nfce/Documentos), [MOC NF-e CONFAZ](https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais/moc7-anexo-i-leiaute-e-rv.pdf), [CSOSN — FocusNFe](https://focusnfe.com.br/blog/csosn/), [ICMSTot — FlexDocs](https://flexdocs.net/guia-nfe/total-icms/)
- NT 2025.001 (QR-Code 3.00): [Tecnospeed](https://blog.tecnospeed.com.br/nota-tecnica-2025-001-nfc-e-qr-code/), [MOC SPED Fazenda PR](http://moc.sped.fazenda.pr.gov.br/DanfeQrCodeNFCe.html)
- E110 (campos, fórmula, validação E116): [VRI Consulting idGuia=136](https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=136), [Guia Prático EFD-ICMS/IPI (RFB/CONFAZ)](https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais/06___anexoguia_pratico_da_escrituracao_fiscal_digital___efd.pdf)
- Regra CFOP 5605/1605 no E110: [VRWiki VRsoft — VL_TOT_DEBITOS](https://wiki.vrsoft.com.br/wiki/index.php/Registro_E110_-_2_-_VL_TOT_DEBITOS), [SEFAZ-BA OT pagamento/EFD](https://www.sefaz.ba.gov.br/docs/inspetoria-eletronica/icms/OT_pagamento_imposto_informar_EFD.pdf)
- DIFAL/ST registros E200/E210/E300/E310/E316: [Sankhya](https://ajuda.sankhya.com.br/hc/pt-br/articles/360048634673), [SPED-MG Manual DIFAL EC87](https://portalsped.fazenda.mg.gov.br/spedmg/export/sites/spedmg/efd/downloads/EFD-Manual-de-Escrituracao-DIFAL-Origem-MG-EC87-2015-v.2017.03.pdf)
- Simples — fórmula, anexos, Fator R, repartição: [LC 123/2006 art. 18 — Planalto](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm), [Res. CGSN 140/2018](https://www.normaslegais.com.br/legislacao/resolucao-cgsn-140-2018.htm), [Anexo I Receita idArquivoBinario=48430](http://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=48430), [Anexo I repartição — Lefisc](https://www.lefisc.com.br/sn/anexos2018/anexoI.htm), [Anexo III 2026 — Contabilizei](https://www.contabilizei.com.br/contabilidade-online/anexo-3-simples-nacional/), [Manual PGDAS-D](https://www8.receita.fazenda.gov.br/simplesnacional/arquivos/manual/manual_pgdas-d_2018_v4.pdf)
- Sublimite 2026 (Portaria CGSN 54/2025): [Receita/Simples Nacional](https://www8.receita.fazenda.gov.br/simplesnacional/noticias/NoticiaCompleta.aspx?id=94c10cc2-7eb5-4ef0-bfb2-5479e72caff8), [FENACON](https://fenacon.org.br/noticias/simples-nacional-sublimite-de-icms-e-iss-e-mantido-em-r-36-milhoes-para-2026/)
- DIFAL não devido por optante do Simples (STF): [ADI 5464 STF](https://www.stf.jus.br/arquivo/cms/noticiaNoticiaStf/anexo/ADI5464.pdf), [ECONET — DIFAL Simples](https://blog.econeteditora.com.br/difal-simples-nacional/)