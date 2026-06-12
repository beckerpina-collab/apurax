# SPED EFD-Contribuições — layout dos registros (VERIFICADO)

# Layout EFD-Contribuições — VERIFICADO contra o Guia Prático oficial (parser Apurax)

Convenção: `arr = linha.split('|')` → `arr[0]` = "" (vazio), `arr[1]` = REG, `arr[2]` = campo 02, ... `arr[N]` = campo Nº N. O índice de array coincide com o "Nº" oficial do Guia porque o split insere "" em `arr[0]`.

VERIFICADO campo a campo contra os leiautes reproduzidos pela VRI Consulting (espelho do ADE Cofis 34/2010 e Guia Prático v1.35). Conferência adversarial de C100, C170, M100 e M500 concluída: **nenhum off-by-one encontrado — todas as posições do rascunho estão corretas.** Duas observações de NOME de campo (não de posição) anotadas abaixo.

---

## ATENÇÃO — premissas confirmadas (verificado)

1. (verificado) O **C170 NÃO possui NAT_BC_CRED**. O `IND_APUR` do C170 (`arr[19]`) é o indicador de apuração do **IPI** (0=mensal/1=decendial), não de PIS/COFINS. O `NAT_BC_CRED` só existe no bloco M (M105 PIS `arr[2]`, M505 COFINS `arr[2]`). C170 termina no campo 37 (COD_CTA).
2. (verificado) A natureza do crédito (NAT_BC_CRED, Tab. 4.3.7) e o código do crédito (COD_CRED, Tab. 4.3.6) vêm do bloco M. C170 dá o crédito documento-a-documento; M100/M105 (PIS) e M500/M505 (COFINS) dão o consolidado/apurado.
3. (verificado) NFC-e (mod. 65) normalmente consolida em **C175** (sem C170 item a item); mod. 01/55 vão em **C170**. Tratar ambos os caminhos.

---

## 0000 — Abertura / competência (verificado: índices não conferidos nesta rodada; manter atenção que diferem da EFD-ICMS/IPI)
| índice | campo | uso |
|---|---|---|
| 1 | REG | "0000" |
| 2 | COD_VER | versão do leiaute (logar) |
| 3 | TIPO_ESCRIT | 0=Original; 1=Retificadora |
| 4 | IND_SIT_ESP | situação especial |
| 5 | NUM_REC_ANTERIOR | recibo da retificada |
| 6 | DT_INI | início competência (ddmmaaaa) |
| 7 | DT_FIN | fim competência (ddmmaaaa) |
| 8 | NOME | nome empresarial |
| 9 | CNPJ | CNPJ da matriz |
| 10 | UF | UF |
| 11 | COD_MUN | município IBGE |
| 12 | SUFRAMA | inscrição Suframa |
| 13 | IND_NAT_PJ | natureza da PJ |
| 14 | IND_ATIV | tipo de atividade |

Nota (incerto): não revalidei o 0000 nesta rodada contra a fonte; as posições críticas verificadas foram C100/C170/M100/M500/M105/M505/M200/C175. Confirmar 0000 antes de produção.

## C100 — documento (NF/NF-e) — VERIFICADO (último campo 29)
| índice | campo | uso |
|---|---|---|
| 1 | REG | "C100" |
| 2 | IND_OPER | 0=Entrada; 1=Saída (entrada gera crédito) |
| 3 | IND_EMIT | 0=própria; 1=terceiros |
| 4 | COD_PART | liga ao 0150 (arr[2]) |
| 5 | COD_MOD | modelo (01, 1B, 04, 55, 65) |
| 6 | COD_SIT | situação do doc |
| 7 | SER | série |
| 8 | NUM_DOC | número do documento |
| 9 | CHV_NFE | chave 44 dígitos |
| 10 | DT_DOC | data emissão (ddmmaaaa) |
| 11 | DT_E_S | data entrada/saída |
| 12 | VL_DOC | valor total do documento |
| 13 | IND_PGTO | indicador de pagamento |
| 14 | VL_DESC | desconto |
| 15 | VL_ABAT_NT | abatimento não tributado |
| 16 | VL_MERC | valor das mercadorias |
| 17 | IND_FRT | frete por conta |
| 18 | VL_FRT | frete |
| 19 | VL_SEG | seguro |
| 20 | VL_OUT_DA | outras despesas |
| 21 | VL_BC_ICMS | BC ICMS |
| 22 | VL_ICMS | ICMS |
| 23 | VL_BC_ICMS_ST | BC ICMS-ST |
| 24 | VL_ICMS_ST | ICMS-ST |
| 25 | VL_IPI | IPI |
| 26 | VL_PIS | PIS (total doc) |
| 27 | VL_COFINS | COFINS (total doc) |
| 28 | VL_PIS_ST | PIS-ST |
| 29 | VL_COFINS_ST | COFINS-ST |

Entrada que gera crédito → `arr[1]==='C100' && arr[2]==='0'`.

## C170 — itens (CRÍTICO) — VERIFICADO campo a campo (37 campos, sem NAT_BC_CRED)
| índice | campo | uso |
|---|---|---|
| 1 | REG | "C170" |
| 2 | NUM_ITEM | nº do item |
| 3 | COD_ITEM | liga ao 0200 |
| 4 | DESCR_COMPL | descrição |
| 5 | QTD | quantidade |
| 6 | UNID | unidade |
| 7 | **VL_ITEM** | valor total do item |
| 8 | VL_DESC | desconto |
| 9 | IND_MOV | movimentação física |
| 10 | CST_ICMS | CST ICMS |
| 11 | **CFOP** | CFOP do item |
| 12 | COD_NAT | natureza (interno) |
| 13 | VL_BC_ICMS | BC ICMS |
| 14 | ALIQ_ICMS | alíquota ICMS |
| 15 | VL_ICMS | valor ICMS |
| 16 | VL_BC_ICMS_ST | BC ICMS-ST |
| 17 | ALIQ_ST | alíquota ST |
| 18 | VL_ICMS_ST | valor ICMS-ST |
| 19 | IND_APUR | indicador apuração do IPI (NÃO PIS/COFINS) |
| 20 | CST_IPI | CST IPI |
| 21 | COD_ENQ | enquadramento IPI |
| 22 | VL_BC_IPI | BC IPI |
| 23 | ALIQ_IPI | alíquota IPI |
| 24 | VL_IPI | valor IPI |
| 25 | **CST_PIS** | CST PIS (Tab. 4.3.3) |
| 26 | **VL_BC_PIS** | BC PIS |
| 27 | **ALIQ_PIS** | alíquota PIS (%) |
| 28 | QUANT_BC_PIS | BC em quantidade |
| 29 | ALIQ_PIS_QUANT | alíquota PIS R$/un |
| 30 | **VL_PIS** | valor PIS |
| 31 | **CST_COFINS** | CST COFINS (Tab. 4.3.4) |
| 32 | **VL_BC_COFINS** | BC COFINS |
| 33 | **ALIQ_COFINS** | alíquota COFINS (%) |
| 34 | QUANT_BC_COFINS | BC COFINS quantidade |
| 35 | ALIQ_COFINS_QUANT | alíquota COFINS R$/un |
| 36 | **VL_COFINS** | valor COFINS |
| 37 | COD_CTA | conta contábil |

Crédito: `VL_PIS ≈ VL_BC_PIS × ALIQ_PIS/100` (ad valorem) **ou** `QUANT_BC_PIS × ALIQ_PIS_QUANT` (por unidade). Crédito potencial quando `IND_OPER=0` (C100 pai) e CST_PIS/CST_COFINS ∈ {50..56, 60..66}.

## C175 — consolidação (NFC-e mod. 65) — VERIFICADO (18 campos)
| índice | campo | uso |
|---|---|---|
| 1 | REG | "C175" |
| 2 | CFOP | CFOP |
| 3 | VL_OPR | valor da operação |
| 4 | VL_DESC | desconto/exclusão BC |
| 5 | CST_PIS | CST PIS |
| 6 | VL_BC_PIS | BC PIS |
| 7 | ALIQ_PIS | alíquota PIS % |
| 8 | QUANT_BC_PIS | BC quantidade |
| 9 | ALIQ_PIS_QUANT | alíquota PIS R$ |
| 10 | VL_PIS | valor PIS |
| 11 | CST_COFINS | CST COFINS |
| 12 | VL_BC_COFINS | BC COFINS |
| 13 | ALIQ_COFINS | alíquota COFINS % |
| 14 | QUANT_BC_COFINS | BC quantidade |
| 15 | ALIQ_COFINS_QUANT | alíquota COFINS R$ |
| 16 | VL_COFINS | valor COFINS |
| 17 | COD_CTA | conta contábil |
| 18 | INFO_COMPL | info complementar |

Sem IND_OPER próprio — entrada/saída herdada do C100 pai (`arr[2]`). Offsets PIS/COFINS DIFEREM do C170 (aqui CST_PIS=5; lá =25). Não compartilhar offset.

## M100 — crédito de PIS apurado — VERIFICADO (15 campos)
| índice | campo | uso |
|---|---|---|
| 1 | REG | "M100" |
| 2 | COD_CRED | tipo de crédito (Tab. 4.3.6) |
| 3 | IND_CRED_ORI | 0=própria; 1=sucessão |
| 4 | VL_BC_PIS | BC do crédito (= Σ M105.VL_BC_PIS) |
| 5 | ALIQ_PIS | alíquota do crédito (%) |
| 6 | QUANT_BC_PIS | BC em quantidade |
| 7 | ALIQ_PIS_QUANT | alíquota R$/un |
| 8 | VL_CRED | crédito apurado no período |
| 9 | VL_AJUS_ACRES | ajustes de acréscimo |
| 10 | VL_AJUS_REDUC | ajustes de redução |
| 11 | VL_CRED_DIFER | crédito diferido (nome oficial VL_CRED_DIFER; rascunho usou abrev. "VL_CRED_DIF") |
| 12 | VL_CRED_DISP | crédito disponível (08+09−10−11) |
| 13 | IND_DESC_CRED | 0=total; 1=parcial |
| 14 | VL_CRED_DESC | crédito efetivamente descontado |
| 15 | SLD_CRED | saldo para períodos futuros (12−14) |

## M105 — detalhe da BC do crédito de PIS (NAT_BC_CRED mora aqui) — VERIFICADO (10 campos)
| índice | campo | uso |
|---|---|---|
| 1 | REG | "M105" |
| 2 | NAT_BC_CRED | natureza da BC do crédito (Tab. 4.3.7) |
| 3 | CST_PIS | CST do crédito |
| 4 | VL_BC_PIS_TOT | BC total dos documentos |
| 5 | VL_BC_PIS_CUM | parcela cumulativa |
| 6 | VL_BC_PIS_NC | parcela não-cumulativa |
| 7 | VL_BC_PIS | BC específica do tipo de crédito do M100 |
| 8 | QUANT_BC_PIS_TOT | BC total em quantidade |
| 9 | QUANT_BC_PIS | BC quantidade do tipo de crédito |
| 10 | DESC_CRED | descrição |

## M500 — crédito de COFINS — VERIFICADO (15 campos, estrutura idêntica ao M100)
| índice | campo | uso |
|---|---|---|
| 1 | REG | "M500" |
| 2 | COD_CRED | tipo de crédito |
| 3 | IND_CRED_ORI | 0/1 |
| 4 | VL_BC_COFINS | BC do crédito (= Σ M505.VL_BC_COFINS) |
| 5 | ALIQ_COFINS | alíquota (%) |
| 6 | QUANT_BC_COFINS | BC em quantidade |
| 7 | ALIQ_COFINS_QUANT | alíquota R$/un |
| 8 | VL_CRED | crédito apurado no período |
| 9 | VL_AJUS_ACRES | ajustes de acréscimo |
| 10 | VL_AJUS_REDUC | ajustes de redução |
| 11 | VL_CRED_DIFER | crédito diferido (nome oficial VL_CRED_DIFER) |
| 12 | VL_CRED_DISP | crédito disponível |
| 13 | IND_DESC_CRED | 0/1 |
| 14 | VL_CRED_DESC | crédito descontado |
| 15 | SLD_CRED | saldo futuro |

## M505 — detalhe da BC do crédito de COFINS — VERIFICADO (10 campos)
| índice | campo | uso |
|---|---|---|
| 1 | REG | "M505" |
| 2 | NAT_BC_CRED | natureza da BC do crédito (Tab. 4.3.7) |
| 3 | CST_COFINS | CST do crédito |
| 4 | VL_BC_COFINS_TOT | BC total dos documentos |
| 5 | VL_BC_COFINS_CUM | parcela cumulativa |
| 6 | VL_BC_COFINS_NC | parcela não-cumulativa |
| 7 | VL_BC_COFINS | BC específica do tipo de crédito do M500 |
| 8 | QUANT_BC_COFINS_TOT | BC total em quantidade |
| 9 | QUANT_BC_COFINS | BC quantidade do tipo de crédito |
| 10 | DESC_CRED | descrição |

## M200 — consolidação PIS — VERIFICADO (13 campos)
| índice | campo | uso |
|---|---|---|
| 1 | REG | "M200" |
| 2 | VL_TOT_CONT_NC_PER | contribuição NC do período |
| 3 | VL_TOT_CRED_DESC | crédito descontado no próprio período (= Σ M100.VL_CRED_DESC) |
| 4 | VL_TOT_CRED_DESC_ANT | crédito de períodos anteriores |
| 5 | VL_TOT_CONT_NC_DEV | contribuição NC devida |
| 6 | VL_RET_NC | retenções na fonte (NC) |
| 7 | VL_OUT_DED_NC | outras deduções (NC) |
| 8 | VL_CONT_NC_REC | contribuição NC a recolher |
| 9 | VL_TOT_CONT_CUM_PER | contribuição cumulativa do período |
| 10 | VL_RET_CUM | retenções (cumulativo) |
| 11 | VL_OUT_DED_CUM | outras deduções (cumulativo) |
| 12 | VL_CONT_CUM_REC | contribuição cumulativa a recolher |
| 13 | VL_TOT_CONT_REC | total a recolher |

## M600 — consolidação COFINS — estrutura/índices idênticos ao M200 (13 campos)
`arr[2]`=VL_TOT_CONT_NC_PER, `arr[3]`=VL_TOT_CRED_DESC, `arr[8]`=VL_CONT_NC_REC, `arr[13]`=VL_TOT_CONT_REC. (incerto: não revalidei M600 diretamente nesta rodada; M200 confirmado e M600 é espelho oficial — confirmar se houver tempo.)

## 9999 — encerramento
| índice | campo | uso |
|---|---|---|
| 1 | REG | "9999" |
| 2 | QTD_LIN | total de linhas/registros |

---

## Índices que o parser DEVE usar (resumo verificado)

C170 item: CFOP=`arr[11]`, CST_PIS=`arr[25]`, VL_BC_PIS=`arr[26]`, ALIQ_PIS=`arr[27]`, VL_PIS=`arr[30]`, CST_COFINS=`arr[31]`, VL_BC_COFINS=`arr[32]`, ALIQ_COFINS=`arr[33]`, VL_COFINS=`arr[36]`, VL_ITEM=`arr[7]`. NAT_BC_CRED NÃO existe no C170 → M105 `arr[2]` (PIS) / M505 `arr[2]` (COFINS).

Lacuna: Σ(C170/C175 crédito potencial, entradas CST 50–66) vs M100.VL_CRED (`arr[8]`) / M500.VL_CRED (`arr[8]`); aproveitado = M100/M500.VL_CRED_DESC (`arr[14]`) → M200/M600.VL_TOT_CRED_DESC (`arr[3]`).

## Divergências entre versões
- Posições de C100/C170/bloco M são estáveis 1.21→1.35 (decorrem do ADE Cofis 34/2010). O que muda entre versões é a regra de preenchimento da BC (exclusão do ICMS — Tema 69 STF, consolidada na v1.35), não os índices. Parser por índice continua válido; a aritmética de validação da BC deve considerar a exclusão do ICMS.
- C175 para fatos geradores a partir de set/2014 (NFC-e mod. 65); arquivos antigos podem ter mod. 65 em C170 — tratar ambos.
- Logar sempre COD_VER (0000 `arr[2]`).

---

Tenho os dados confirmados. Os índices de array (índice 1 = REG) batem com o número de ordem do campo do leiaute (o índice 0 do split é vazio). Vou compor a resposta.

---

# Layout SPED EFD-Contribuições — C170, C100, CST de entrada e motor de lacuna PIS/COFINS

Convenção usada: `linha.split('|')` → índice `0` = string vazia; índice `1` = `REG`; índice `2` = primeiro campo de dado. Os índices abaixo JÁ coincidem com o "número de ordem do campo" do leiaute oficial (porque o índice 0 do split absorve o `|` inicial). Confirmado contra o Guia Prático da EFD-Contribuições v1.35 (SPED/RFB, 18/06/2021) e a tabela de CST (Tabela 4.3.3/4.3.4, base IN RFB 1.009/2010, hoje consolidada na IN RFB 2.121/2022).

## 1. Registro C170 — Itens do documento (índices de array)

`arr = linha.split('|')`. C170 é registro FILHO de C100 (a NF-e/documento vive no C100; cada item é um C170). Total: 37 campos + REG.

| Índice (arr[i]) | Campo | Conteúdo | Uso no motor |
|---|---|---|---|
| 1 | REG | `"C170"` | filtro |
| 2 | NUM_ITEM | nº sequencial do item | chave do item |
| 3 | COD_ITEM | código do item (ref. 0200) | identificação |
| 4 | DESCR_COMPL | descrição complementar | contexto p/ IA |
| 5 | QTD | quantidade | — |
| 6 | UNID | unidade de medida | — |
| 7 | VL_ITEM | valor total do item | sanity check |
| 8 | VL_DESC | desconto comercial | — |
| 9 | IND_MOV | indicador mov. física | — |
| 10 | CST_ICMS | CST ICMS | — |
| 11 | CFOP | CFOP | **crítico** (entrada começa com 1/2/3) |
| 12 | COD_NAT | natureza op. (0400) | — |
| 13 | VL_BC_ICMS | BC ICMS | — |
| 14 | ALIQ_ICMS | alíq. ICMS | — |
| 15 | VL_ICMS | valor ICMS | exclusão ICMS da BC (ver §5) |
| 16 | VL_BC_ICMS_ST | BC ICMS-ST | — |
| 17 | ALIQ_ST | alíq. ST | — |
| 18 | VL_ICMS_ST | valor ICMS-ST | — |
| 19 | IND_APUR | ind. apuração IPI | — |
| 20 | CST_IPI | CST IPI | — |
| 21 | COD_ENQ | enquadramento IPI | — |
| 22 | VL_BC_IPI | BC IPI | — |
| 23 | ALIQ_IPI | alíq. IPI | — |
| 24 | VL_IPI | valor IPI | — |
| **25** | **CST_PIS** | **CST do PIS (perspectiva adquirente)** | **elegibilidade** |
| **26** | **VL_BC_PIS** | **base de cálculo PIS (R$)** | **recálculo** |
| **27** | **ALIQ_PIS** | **alíquota PIS (%)** | **recálculo** |
| 28 | QUANT_BC_PIS | BC PIS por quantidade (ad rem) | regime por unidade |
| 29 | ALIQ_PIS_QUANT | alíquota PIS em R$/unidade | regime por unidade |
| **30** | **VL_PIS** | **valor PIS escriturado (crédito tomado)** | **valor declarado** |
| **31** | **CST_COFINS** | **CST da COFINS** | **elegibilidade** |
| **32** | **VL_BC_COFINS** | **base de cálculo COFINS (R$)** | **recálculo** |
| **33** | **ALIQ_COFINS** | **alíquota COFINS (%)** | **recálculo** |
| 34 | QUANT_BC_COFINS | BC COFINS por quantidade | regime por unidade |
| 35 | ALIQ_COFINS_QUANT | alíquota COFINS em R$/unidade | regime por unidade |
| **36** | **VL_COFINS** | **valor COFINS escriturado** | **valor declarado** |
| 37 | COD_CTA | conta contábil analítica | — |

Notas de parsing críticas:
- **Regime ad valorem vs ad rem (mutuamente exclusivos):** se `arr[28]/arr[29]` (e `arr[34]/arr[35]`) estiverem preenchidos, a contribuição é apurada por unidade de medida e os campos `arr[26]/arr[27]` (e `arr[32]/arr[33]`) vêm vazios — e vice-versa. O motor deve detectar qual regime e escolher a fórmula de recálculo (`VL_BC × ALIQ` ou `QUANT × ALIQ_QUANT`).
- **Decimais:** campos numéricos vêm com vírgula decimal brasileira (`"1.234,56"` em alguns geradores ou `"100,00"`). Normalize antes de `parseFloat`. Alíquotas percentuais vêm como número (ex.: `"1,65"` = 1,65%, não 0,0165).
- **C175 (versão alternativa):** desde leiautes mais recentes existe o `C175` (registro consolidado de itens, substitui o detalhamento item a item em alguns perfis). Se você só parsear C170 e o arquivo usar C175, perde itens. Verifique a presença de ambos.
- **C170 vinculado a C100, mas há documentos consolidados (C180/C190, C181, C185, C481/C485, C490…)** onde NÃO há C170 — crédito de entradas consolidadas não aparece item a item. Sinalize isso na reconciliação (§5): ausência de C170 não significa ausência de escrituração.

## 2. C100 — cabeçalho do documento (para reconciliação com NF-e)

`arr = linha.split('|')`, `arr[1] = "C100"`:

| Índice | Campo | Uso |
|---|---|---|
| 1 | REG (`"C100"`) | filtro |
| 2 | IND_OPER | `0`=entrada/aquisição, `1`=saída → **filtrar `0` para crédito** |
| 3 | IND_EMIT | `0`=emissão própria, `1`=terceiros |
| 4 | COD_PART | participante (ref. 0150) |
| 5 | COD_MOD | modelo (`55`=NF-e, `65`=NFC-e…) |
| 6 | COD_SIT | situação do doc. (`00`=regular, `02/03`=cancelado…) → ignorar cancelados |
| 7 | SER | série |
| 8 | NUM_DOC | número |
| **9** | **CHV_NFE** | **chave de 44 dígitos — chave de match com a NF-e** |
| 10 | DT_DOC | data emissão |
| 11 | DT_E_S | data entrada/saída |
| 12 | VL_DOC | valor total do documento |
| … | (VL_DESC, VL_MERC, VL_FRETE, VL_PIS, VL_COFINS etc. seguem) | totais p/ conferência |

O campo `arr[9]` (CHV_NFE) é a chave determinística da reconciliação com NF-e ingerida no Apurax. Atenção: em documentos modelo diferente de 55/65 a chave pode vir vazia — nesses casos o match cai para `COD_PART + COD_MOD + SER + NUM_DOC` (`arr[4]+arr[5]+arr[7]+arr[8]`).

## 3. Tabela de CST de PIS/COFINS na ESCRITURAÇÃO DE ENTRADA (C170, perspectiva do ADQUIRENTE)

Mesma codificação para PIS (Tabela 4.3.3) e COFINS (Tabela 4.3.4). Base legal: Lei 10.637/2002 (PIS), Lei 10.833/2003 (COFINS), Lei 10.865/2004 (vinculação por destino da receita), consolidadas na IN RFB 2.121/2022 (revogou a IN 1.009/2010).

| CST | Gera crédito? | Descrição oficial | Observação para o motor |
|---|---|---|---|
| 50 | **SIM** | Operação com Direito a Crédito – Vinculada Exclusivamente a Receita Tributada no Mercado Interno | crédito integral; `VL ≈ BC×ALIQ` |
| 51 | **SIM** | …Vinculada Exclusivamente a Receita Não-Tributada no Mercado Interno | crédito existe mas pode ser estornado/limitado por rateio |
| 52 | **SIM** | …Vinculada Exclusivamente a Receita de Exportação | crédito ressarcível/compensável |
| 53 | **SIM** | …Vinculada a Receitas Tributadas e Não-Tributadas no MI | sujeito a **rateio proporcional/método de apropriação** |
| 54 | **SIM** | …Vinculada a Receitas Tributadas no MI e de Exportação | rateio |
| 55 | **SIM** | …Vinculada a Receitas Não-Tributadas no MI e de Exportação | rateio |
| 56 | **SIM** | …Vinculada a Receitas Tributadas e Não-Tributadas no MI, e de Exportação | rateio (3 destinos) |
| 60 | **SIM (presumido)** | Crédito Presumido – Aquisição Vinculada Excl. a Receita Tributada no MI | alíquota efetiva reduzida (ex.: agroindústria); **não usar 1,65/7,6 cheio** |
| 61 | **SIM (presumido)** | …Excl. Receita Não-Tributada no MI | idem |
| 62 | **SIM (presumido)** | …Excl. Receita de Exportação | idem |
| 63 | **SIM (presumido)** | …Tributadas e Não-Tributadas no MI | idem + rateio |
| 64 | **SIM (presumido)** | …Tributadas no MI e Exportação | idem |
| 65 | **SIM (presumido)** | …Não-Tributadas no MI e Exportação | idem |
| 66 | **SIM (presumido)** | …Tributadas e Não-Tributadas no MI, e Exportação | idem |
| 67 | **SIM (presumido)** | Crédito Presumido – Outras Operações | alíquota específica por norma |
| 70 | **NÃO** | Operação de Aquisição sem Direito a Crédito | crédito > 0 aqui = **risco de glosa** |
| 71 | **NÃO** | Operação de Aquisição com Isenção | sem crédito |
| 72 | **NÃO** | Operação de Aquisição com Suspensão | sem crédito |
| 73 | **NÃO** | Operação de Aquisição a Alíquota Zero | sem crédito |
| 74 | **NÃO** | Operação de Aquisição sem Incidência da Contribuição | sem crédito |
| 75 | **NÃO** | Operação de Aquisição por Substituição Tributária | sem crédito (já tributado a montante) |
| 98 | **NÃO** (em regra) | Outras Operações de Entrada | genérico; **exige IA/análise** caso a caso |
| 99 | **NÃO** (em regra) | Outras Operações | genérico; analisar |

Observações de leiaute/divergência entre versões:
- O Guia v1.35 ainda referencia a IN 1.009/2010 e a IN 932/2009 como base do CST. **Essas foram revogadas pela IN RFB 2.121/2022** (que consolidou toda a legislação de PIS/COFINS). A CODIFICAÇÃO numérica dos CST (50-99) NÃO mudou — só a base normativa citada. No relatório do Apurax, cite a IN 2.121/2022 como vigente em 2026.
- CST 60-66 (presumido): a alíquota NÃO é a básica (1,65% PIS / 7,6% COFINS). Cada crédito presumido tem percentual próprio na legislação. O motor não pode recalcular esses por `BC×1,65%`; deve tratar como "alíquota declarada confiável" e só checar consistência interna (`VL = BC×ALIQ_declarada`).

## 4. Diferença CRÍTICA: CST do XML da NF-e (emitente) ≠ CST do C170 (adquirente)

São DUAS tabelas de domínios distintos. O motor precisa de dois parsers/dicionários:

| Origem | Perspectiva | Domínio de CST relevante | Significado |
|---|---|---|---|
| **XML NF-e** (tags `<PIS>`/`<COFINS>`, campo `CST`) | **EMITENTE / operação a montante** | `01` (tributável alíq. básica), `02` (alíq. diferenciada), `03` (por quantidade), `04` (monofásico/tributação concentrada – alíq. zero na revenda), `05` (ST), `06` (alíq. zero), `07` (isenta), `08` (sem incidência), `09` (suspensão), `49`, `50`-`56`, `60`-`67`, `70`-`75`, `98`, `99` | como o VENDEDOR tributou a saída dele |
| **C170 SPED** (`arr[25]` CST_PIS, `arr[31]` CST_COFINS) | **ADQUIRENTE / direito a crédito** | `50`-`56`, `60`-`67` = tomou crédito; `70`-`75`, `98`, `99` = não | se EU tenho direito a crédito |

Implicação para o Apurax: o CST que aparece no XML de entrada (ex.: `04` monofásico, `06` alíquota zero) indica que **na revenda** aquele item não gera débito — mas isso NÃO determina sozinho o CST de crédito no C170. O mapeamento XML→C170 é heurístico, não bijetivo:
- XML `01` (tributado normal) → esperado C170 `50-56` (crédito) se houver direito legal.
- XML `04`/`05`/`06` (monofásico/ST/alíq. zero) → geralmente C170 `70-75` (sem crédito), mas há exceções legais.
- Por isso o motor mantém os dois campos separados e usa o CST do C170 como verdade de elegibilidade; o CST do XML serve de **sinal de inconsistência** (ex.: XML `04` monofásico + C170 `50` crédito = forte indício de erro de classificação → Etapa 7/IA).

## 5. Metodologia de LACUNA (determinística) + fronteira com IA

Premissa: lacuna = (crédito a que tem direito) − (crédito efetivamente escriturado). Tudo abaixo só roda em itens de ENTRADA: `C100.arr[2]=='0'` (IND_OPER entrada) e idealmente `CFOP` (`C170.arr[11]`) iniciando em 1/2/3.

### 5.1 Completude (crédito não aproveitado) — DETERMINÍSTICO
Regra: CST elegível mas crédito zerado/ausente.
```
elegivel = CST_PIS ∈ {50..56, 60..66}
se elegivel e (VL_PIS == 0 ou vazio) e (VL_BC_PIS > 0):
    lacuna_pis = VL_BC_PIS * (ALIQ_PIS/100)     # regime ad valorem
    # ou QUANT_BC_PIS * ALIQ_PIS_QUANT          # regime ad rem
```
Idem COFINS com `arr[31..36]`. **Exceção crítica:** para CST 60-66 (presumido) NÃO aplique alíquota básica — sem `ALIQ` confiável no item, marque como "lacuna potencial, requer alíquota presumida da norma" e não calcule valor automático.

### 5.2 Consistência (crédito mal calculado) — DETERMINÍSTICO
```
esperado_pis = VL_BC_PIS * (ALIQ_PIS/100)
divergencia = abs(VL_PIS - esperado_pis)
se divergencia > tolerancia (ex.: R$0,02 de arredondamento):
    flag CONSISTENCIA
```
Captura erro de digitação de alíquota, BC errada, ICMS não excluído. **Exclusão do ICMS da base (Tema 69 STF / seções 11 e 12 da v1.35):** a BC de PIS/COFINS não deve conter ICMS. Se você reconcilia com a NF-e, pode testar se `VL_BC_PIS ≈ (VL_ITEM − VL_ICMS)` quando aplicável — divergência sistemática indica base inflada (crédito a maior = risco) ou base sem ajuste.

### 5.3 Indébito / risco de glosa — DETERMINÍSTICO
```
sem_direito = CST_PIS ∈ {70,71,72,73,74,75}
se sem_direito e VL_PIS > 0:
    flag RISCO_GLOSA   # crédito indevido escriturado
```
CST 98/99 com crédito > 0 → flag de revisão (não glosa automática; domínio genérico).

### 5.4 Reconciliação com NF-e (entradas não escrituradas) — DETERMINÍSTICO + IA na borda
Objetivo: NF-e de entrada já ingeridas no Apurax na competência que NÃO aparecem nos C100 do SPED → crédito potencialmente não aproveitado.

Algoritmo de match por CHV_NFE:
1. **Conjunto SPED:** percorrer todos os `C100` com `arr[2]=='0'` (entrada) e `arr[6] ∈ {regular}` (descartar cancelados `02/03/04`); coletar `chave = arr[9]` (CHV_NFE, 44 dígitos).
2. **Conjunto Apurax:** todas as chaves de NF-e de entrada ingeridas na mesma competência (mês/UF/CNPJ destinatário).
3. **Match primário:** `chave_nfe` exata (44 díg.). 
4. **Match secundário (chave vazia no C100 — modelos ≠ 55/65):** fallback por tupla `COD_PART(arr[4]) + COD_MOD(arr[5]) + SER(arr[7]) + NUM_DOC(arr[8])`, normalizando zeros à esquerda.
5. **Diferença `Apurax − SPED`:** chaves no Apurax ausentes no SPED = **entradas não escrituradas**. Para cada, lacuna = crédito potencial calculável a partir dos itens da NF-e (CST do XML + BC), porém o CST de crédito (C170) é incerto → estimativa, não certeza.
6. **Antes de acusar lacuna**, descontar legitimamente: documentos que entraram via registros CONSOLIDADOS (C180/C190, C481/C485, C490, C860…) — sem C100/C170 individual. Se o regime do contribuinte usa consolidação, a ausência de C100 individual NÃO é lacuna. Sinalize a necessidade de checar o perfil/consolidação antes de quantificar.

### 5.5 Fronteira motor (determinístico) × IA (Etapa 7)

| Tarefa | Motor determinístico | IA (Etapa 7) |
|---|---|---|
| Elegibilidade por CST (50-56/60-66 vs 70-75) | ✅ tabela fixa | — |
| Recálculo `VL = BC×ALIQ` (ad valorem e ad rem) | ✅ | — |
| Flag crédito zerado em CST elegível | ✅ | — |
| Flag crédito > 0 em CST sem direito | ✅ | — |
| Match NF-e↔SPED por chave/tupla | ✅ | — |
| Crédito presumido (60-66): valor da alíquota correta | parcial (só consistência interna) | ✅ qual % presumido por NCM/atividade |
| **Reclassificação de CST de item que veio errado** (ex.: deveria ser 50 mas veio 70; XML monofásico `04` mas C170 `50`) | sinaliza inconsistência | ✅ **decide o CST correto** com base em NCM, CFOP, natureza, descrição (`arr[4]`) |
| CST 98/99 (genéricos): há ou não direito | ✅ só levanta flag | ✅ classifica a operação real |
| Vedações legais (ex.: bem para uso/consumo, ativo imobilizado sem direito, optante Simples no fornecedor) | parcial (CFOP/NCM) | ✅ julgamento da hipótese de crédito |

Resumo do fluxo: o motor produz lacunas **determinísticas e auditáveis** (completude, consistência, indébito, reconciliação por chave); a IA só entra para (a) reclassificar CST de itens classificados errado e (b) resolver os domínios ambíguos (presumido, 98/99, vedações), sempre marcando essas saídas como "sugestão revisável" e não como cálculo certo.

---

### Divergências de versão a registrar no código
- **Base legal do CST:** Guia v1.35 cita IN 1.009/2010 e IN 932/2009 (revogadas). Vigente em 2026: **IN RFB 2.121/2022**. Codificação 50-99 inalterada.
- **Exclusão do ICMS da BC:** introduzida formalmente nas seções 11 e 12 do Cap. I na v1.35 (Tema 69 STF). Em arquivos de competências antigas a BC pode incluir ICMS — o teste de consistência precisa ser sensível à competência.
- **C175** (item consolidado) coexiste com C170 em leiautes recentes — não assuma que todo item está em C170.
- **C170 não existe** em documentos escriturados de forma consolidada (C180/C190 etc.) — ausência ≠ falta de crédito.

Fontes:
- [Guia Prático da EFD-Contribuições – Versão 1.35 (SPED/RFB, 18/06/2021) – PDF oficial](http://sped.rfb.gov.br/estatico/AD/06A0F5C4E4CC8CA16035EB891A3AE31EA79708/Guia_Pratico_EFD_Contribuicoes_Versao_1_35%20-%2018_06_2021.pdf)
- [Manuais SPED – Receita Federal (índice oficial)](http://sped.rfb.gov.br/pasta/show/1989)
- [Registro C170 da EFD-Contribuições – VRI Consulting (leiaute campo a campo)](https://www.vriconsulting.com.br/guias/guiasIndex.php?idGuia=390)
- [Tabela 4.3.3 – CST-PIS (SPED/RFB)](http://sped.rfb.gov.br/arquivo/show/1629)
- [Tabela CST PIS/COFINS – Ideal Softwares (códigos 50-99)](http://www.idealsoftwares.com.br/tabelas/tabela.php?id=347)
- [EFD-Contribuições – Guia Prático 1.35 (resumo das mudanças, TOTVS)](https://www.totvs.com/blog/fiscal-clientes/efd-contribuicoes-guia-pratico-1-35/)