# CT-e (modelo 57) — layout + crédito de ICMS (VERIFICADO)

# CT-e (mod. 57) — Layout para parser + Crédito de ICMS sobre frete (documento consolidado, pronto para codar)

> Verificado adversarialmente em jun/2026 contra: Anexo I – Leiaute do CT-e (portal oficial), MOC CT-e v4.00, NT 2024.001 (focusnfe/Tecnospeed/Inventti), Guia CTe_Util/flexdocs (icms00NT2015003, icms45NT24001, icmssn300, toma), Modelo CTe.INI (ACBr), e consultas tributárias SEFAZ (RC 22980/2021, RC 27136/2023, RC 29229/2024) + LC 123/06 art. 23. Fontes ao final.

---

## 0. Namespace, raiz e parsing (fast-xml-parser)

- Namespace **default** (sem prefixo): `http://www.portalfiscal.inf.br/cte`. Como é default (não `cte:`), as tags vêm limpas no JSON do `fast-xml-parser`. **(verificado)**
- Com `ignoreAttributes:false`, atributos vêm prefixados com `@_` (ex. `@_Id`, `@_versao`). `processEntities:false` é seguro para esse leiaute.
- Raiz dupla: **`cteProc.CTe.infCte`** (XML autorizado, com protocolo) **ou** `CTe.infCte` (só o documento). Normalize: `parsed.cteProc?.CTe?.infCte ?? parsed.CTe?.infCte`.
- Se algum emissor usar prefixo de namespace (raro), habilite `removeNSPrefix:true`.
- **Valores monetários vêm como string** ("50.13", ponto decimal). Mantenha string e converta com Decimal/centavos — não use `parseFloat` ingênuo. **(verificado)**

### Chave de acesso — `infCte/@_Id`
- String `"CTe"` + 44 dígitos (total 47 chars). Extraia `Id.replace(/^CTe/,'')`, valide `/^\d{44}$/`. **(verificado)**

### Versão do leiaute — `infCte/@_versao`
- `3.00` ou `4.00`. v4.00 obrigatória desde 2025. **Para o crédito, os grupos `ide`, `vPrest` e `imp/ICMS` são idênticos entre as versões**; a única diferença relevante é a NT 2024.001 (campos `vICMSDeson`/`cBenef` — ver §3). **(verificado)**

---

## 1. `ide` — `infCte.ide`

| Campo | Caminho | Observação |
|---|---|---|
| UF emitente (cód. IBGE) | `ide.cUF` | |
| **CFOP da prestação** | `ide.CFOP` | É o CFOP **da transportadora** (visão de saída, normalmente 5/6.3xx). **NÃO** é o CFOP que decide o crédito do tomador — ver §4. **(verificado)** |
| Natureza da operação | `ide.natOp` | |
| Modelo | `ide.mod` | deve ser `57` |
| Série / Número | `ide.serie` / `ide.nCT` | |
| Emissão | `ide.dhEmi` | ISO c/ TZ |
| Tipo do CT-e | `ide.tpCTe` | 0=Normal, 1=Complemento, 2=Anulação, 3=Substituto |
| Tipo de serviço | `ide.tpServ` | 0=Normal, 1=Subcontratação, 2=Redespacho, 3=Redespacho intermediário, 4=Vinculado a multimodal. **(verificado)** |
| **Tomador (grupo 3)** | `ide.toma3.toma` | 0=Remetente, 1=Expedidor, 2=Recebedor, 3=Destinatário. **(verificado)** |
| **Tomador (grupo 4)** | `ide.toma4` | presente quando tomador é "Outros" (`toma4.toma="4"`). **(verificado)** |
| UF início / fim | `ide.UFIni` / `ide.UFFim` | |
| Município início/fim | `ide.cMunIni` / `ide.cMunFim` | cód. IBGE |

> **`toma3` e `toma4` são mutuamente exclusivos** — o XML traz UM ou OUTRO. **(verificado: flexdocs — "dados cadastrais do tomador só serão informados quando 4-Outros; nos demais casos usam-se os dados já informados".)** Leia o código com `ide.toma3?.toma ?? ide.toma4?.toma`.

### `toma3` — `infCte.ide.toma3`
- Contém **apenas** o filho `toma` (string "0".."3"). Reaproveita os dados do participante correspondente (`rem`/`exped`/`receb`/`dest`). **(verificado)**

### `toma4` (Outros) — `infCte.ide.toma4`
- Filhos: `toma`(="4"), **`CNPJ` ou `CPF`**, `IE`, `xNome`, **`xFant`** *(verificado: existe além de xNome)*, `fone`, bloco `enderToma` (`xLgr,nro,xCpl,xBairro,cMun,xMun,CEP,UF,cPais,xPais`), `email`. Dados próprios — não reaproveita rem/exped/receb/dest. **(verificado)**

---

## 2. Participantes e `vPrest`

### emit — `infCte.emit`
- `emit.CNPJ` (emitente é sempre PJ — transportadora), `emit.IE`, `emit.xNome`. **(verificado)**

### Participantes (para resolver o tomador via toma3)
- Remetente: `infCte.rem.CNPJ | rem.CPF`, `rem.IE`, `rem.xNome`
- Expedidor: `infCte.exped.CNPJ | exped.CPF`
- Recebedor: `infCte.receb.CNPJ | receb.CPF`
- Destinatário: `infCte.dest.CNPJ | dest.CPF`

> `exped`/`receb` podem não existir num CT-e Normal (`tpServ=0`); existem tipicamente em redespacho/subcontratação. **Trate ausência** — se `toma3.toma` aponta para um grupo ausente, é inconsistência do XML (cf. Rejeições 461/462 da SEFAZ). **(verificado)**

### vPrest — `infCte.vPrest`
- `vPrest.vTPrest` (valor total da prestação / frete), `vPrest.vRec` (valor a receber). Componentes em `vPrest.Comp[]` — **normalize com `Array.isArray`** (objeto único quando há 1). **(verificado)**
- Para crédito use a **base do ICMS (`vBC`)** e o **`vICMS` destacado**, nunca `vRec`. **(verificado)**

### Valor da carga (conferência)
- `infCte.infCTeNorm.infCarga.vCarga` — útil só para sanity check, não para crédito.

---

## 3. `imp/ICMS` — grupo polimórfico — `infCte.imp.ICMS`

`ICMS` tem **exatamente uma** chave-filha indicando o subgrupo/CST. Detecte por `const grupo = Object.keys(infCte.imp.ICMS)[0]`. **(verificado)**

| Grupo (chave JSON) | CST | Campos de tag exatos | Tem `vICMS`? |
|---|---|---|---|
| `ICMS00` | `00` | `CST, vBC, pICMS, vICMS` | **Sim** — **(verificado: flexdocs icms00NT2015003)** |
| `ICMS20` | `20` | `CST, pRedBC, vBC, pICMS, vICMS` (+ `vICMSDeson, cBenef` na NT2024.001) | Sim |
| `ICMS45` | `40` (isenta), `41` (não tributada), `51` (diferimento) | **só `CST`** (+ `vICMSDeson, cBenef` na NT2024.001) | **Não** — **(verificado: ICMS45 não traz vICMS)** |
| `ICMS60` | `60` | `CST, vBCSTRet, vICMSSTRet, pICMSSTRet, vCred` (+ `vICMSDeson, cBenef` na NT2024.001) | Não (tem `vICMSSTRet`) |
| `ICMS90` | `90` | `CST, pRedBC, vBC, pICMS, vICMS, vCred` (+ `vICMSDeson, cBenef` na NT2024.001) | Sim — **(verificado: leiaute confirma vCred = "Valor do Crédito Outorgado/Presumido")** |
| `ICMSOutraUF` | `90` | `CST, pRedBCOutraUF, vBCOutraUF, pICMSOutraUF, vICMSOutraUF` (+ `vICMSDeson, cBenef` na NT2024.001) | Sim (`vICMSOutraUF`) |
| `ICMSSN` | `90` | `CST`(=90), `indSN`(=1) | **Não** (sem destaque) — **(verificado: flexdocs icmssn300, leiaute NT2015/003)** |

> **CORREÇÃO (verificado: NT 2024.001):** os campos `vICMSDeson` e `cBenef` foram incluídos em **ICMS20, ICMS45, ICMS60, ICMS90 E ICMSOutraUF** — o rascunho omitia ICMS60 e ICMSOutraUF. `cBenef` é, inclusive, campo **vedado de alteração por Carta de Correção** nesses cinco grupos.

Notas-chave para o motor:
- **ICMS45 cobre 3 CST (40/41/51)** — não dá para inferir o CST pelo nome do grupo; leia `imp.ICMS.ICMS45.CST` para distinguir isento (40)/não-trib (41)/diferido (51). **(verificado)**
- **`ICMS90`, `ICMSOutraUF` e `ICMSSN` usam CST=90** — desambigue pela **chave do grupo** (+ `indSN`), nunca só pelo CST. **(verificado)**
- **`vCred` (ICMS60/ICMS90) = "Valor do crédito outorgado/presumido" informado pelo EMITENTE** — não é o crédito ordinário do tomador. O motor calcula o crédito do tomador a partir do **`vICMS` destacado**, respeitando o CST. **(verificado)**
- `imp` também pode trazer `imp.vTotTrib`, `imp.infAdFisco`, `imp.ICMSUFFim` (DIFAL — não é crédito do tomador). Ignore `infCTeComp`/`infCTeSupl` (QR-Code). **(verificado)**

### Algoritmo — resolver CNPJ/CPF do tomador
```ts
function resolverTomador(infCte) {
  const ide = infCte.ide;
  const toma = ide.toma3?.toma ?? ide.toma4?.toma; // string "0".."4"

  if (toma === '4' || ide.toma4) {
    return {
      papel: 'OUTROS',
      cnpj: ide.toma4.CNPJ ?? null,
      cpf:  ide.toma4.CPF  ?? null,
      nome: ide.toma4.xNome ?? null,
    };
  }

  const map = { '0': 'rem', '1': 'exped', '2': 'receb', '3': 'dest' };
  const grp = infCte[map[toma]];        // pode ser undefined
  if (!grp) throw new Error(`Tomador toma=${toma} sem grupo ${map[toma]} no XML`);
  return {
    papel: { '0':'REMETENTE','1':'EXPEDIDOR','2':'RECEBEDOR','3':'DESTINATARIO' }[toma],
    cnpj: grp.CNPJ ?? null,
    cpf:  grp.CPF  ?? null,
    nome: grp.xNome ?? null,
  };
}
```

---

## 4. Quem credita — tomador, CIF × FOB, e o CFOP de escrituração

**Regra-mãe (verificado: LC 87/96 art. 20 + RC 22980/2021 e RC 27136/2023 SEFAZ-SP):** o crédito do ICMS do CT-e pertence ao **TOMADOR do serviço** — *aquele que contratualmente contratou e pagou a prestação* — desde que (a) seja **contribuinte do ICMS em regime normal** (não Simples) e (b) o frete esteja **vinculado a operação tributada/creditável** (entrada para revenda/industrialização).

- **FOB:** por padrão comercial o **destinatário/adquirente** contrata e paga → é o tomador → credita o ICMS do CT-e. **(verificado)**
- **CIF:** por padrão o **remetente/vendedor** contrata e paga (frete embutido no preço) → o crédito é **do remetente**; para o comprador o CT-e CIF **não gera crédito**. **(verificado)**

> **NUANCE (verificado):** CIF/FOB são apenas o *default comercial*. A regra fiscal autoritativa é "tomador = quem contratou e pagou", e o **CT-e declara o tomador no campo `toma3`/`toma4`**. **Sempre resolva pelo campo do XML e compare o CNPJ com o da empresa** — não infira o tomador só pela cláusula CIF/FOB. Se o CNPJ resolvido **≠** CNPJ da empresa → **sem crédito** (motor barra, alerta A2). A SEFAZ-SP exige ainda que o contribuinte **comprove documentalmente** ser o efetivo tomador.

### CFOP de escrituração (ENTRADA) — o que decide o crédito
O CFOP **dentro do CT-e** (`ide.CFOP`) é da prestação (transportadora, 5/6.3xx). O crédito é avaliado pelo **CFOP de ENTRADA que a EMPRESA atribui na escrituração** (grupo 1.35x interno / 2.35x interestadual):

| CFOP (interno / interestadual) | Significado | Gera crédito? |
|---|---|---|
| **1351 / 2351** | Aquisição de serviço de transporte para execução de serviço da **mesma natureza** (transportadora que toma frete) | Conforme regime *(verificado: CFOP 1351 existe)* |
| **1352 / 2352** | Aquisição por **estabelecimento industrial** | Sim, se vinculado a operação tributada |
| **1353 / 2353** | Aquisição por **estabelecimento comercial** | Sim (revenda tributada) |
| **1354 / 2354** | Aquisição por prestador de **comunicação** | Regra própria |
| **1355 / 2355** | Aquisição por **gerador/distribuidor de energia** | Regra própria |
| **1356 / 2356** | Aquisição por **produtor rural** | Conforme regime |
| **1360 / 2360** | Aquisição por **contribuinte substituto** quanto ao transporte (ICMS-ST do frete) | Caso especial (ST) |

> CFOP **5.350 / 6.350** (5353/6353, 5352/6352…) são da **transportadora prestando** — **nunca** geram crédito de frete na entrada. O motor deve **rejeitar/alertar** se o CFOP de escrituração começar com **5 ou 6** (alerta A3). **(verificado)**

---

## 5. Fundamento legal

- **CF/88 art. 155, II** — ICMS incide sobre transporte **interestadual e intermunicipal** (intramunicipal = ISS, sem crédito de ICMS).
- **CF/88 art. 155, §2º, I** — **não-cumulatividade** (compensa o devido com o cobrado nas operações anteriores).
- **LC 87/96 (Lei Kandir):**
  - **art. 19** — não-cumulatividade.
  - **art. 20** — direito ao crédito do imposto **anteriormente cobrado**, inclusive sobre **recebimento de serviço de transporte** interestadual/intermunicipal; **§3º** veda/estorna crédito vinculado a saída **isenta/não tributada**.
  - **art. 21** — hipóteses de estorno.
  - **art. 33** — uso/consumo (creditamento postergado, hoje só a partir de 2033) e energia/comunicação.
- **LC 123/06 art. 23** — optante do Simples **não se apropria nem transfere** crédito de ICMS. **(verificado)** A exceção do art. 23 §§1º-5º permite ao comprador NÃO-optante creditar ICMS de **mercadorias** adquiridas de optante (limitado ao ICMS devido pelo optante) — mas **exclui expressamente prestação de serviço**. Logo, **frete de transportadora optante do Simples (ICMSSN) não gera crédito ao tomador**. **(verificado)**

---

## 6. Tabela — CST do CT-e → gera crédito ao tomador?

Pressupõe: tomador = empresa, regime normal, frete vinculado a operação tributada. **Crédito = `vICMS` destacado no CT-e** (lido do XML, nunca recalculado pela IA).

| Grupo / CST | Crédito? | Valor | Observação | Base legal |
|---|---|---|---|---|
| **ICMS00** (00) | **Sim** | `ICMS00.vICMS` | Tributação normal integral | LC 87/96 art. 20; CF 155 §2º I |
| **ICMS20** (20) | **Sim** | `ICMS20.vICMS` | BC reduzida — credita o `vICMS` destacado (já reflete a redução). Checar `cBenef`/`vICMSDeson` | LC 87/96 art. 20; art. 21 (estorno proporcional) |
| **ICMS45** (40/41/51) | **Não** | 0 | Sem destaque. Isenta/NT/diferimento → nada a creditar | LC 87/96 art. 20 §3º; CF 155 §2º II |
| **ICMS60** (60 — ST/substituído) | **Não** (crédito ordinário) | 0 | ICMS do transporte já retido por ST. Eventual `vCred` segue regra própria da UF | LC 87/96; ST estadual |
| **ICMS90** (90 — outros) | **Depende do destaque** | `ICMS90.vICMS` se `>0`, senão 0 | Regimes mistos. Pode trazer `vCred` (presumido/outorgado) que **substitui** a regra geral. Checar `cBenef` | LC 87/96 art. 20; norma estadual do benefício |
| **ICMSOutraUF** (90 — prestação iniciada em outra UF) | **Em regra não** (ordinário) | 0 | Tratamento interestadual específico; não é crédito automático | LC 87/96; regras interestaduais |
| **ICMSSN** (90, `indSN=1` — emitente Simples) | **Não** | 0 | Transportadora optante do Simples não destaca ICMS creditável; art. 23 exclui prestação de serviço | LC 123/06 art. 23 |

**Tomador no Simples Nacional:** independentemente do CST, o **tomador optante** apura por DAS e **não toma crédito ordinário**. O motor zera o crédito quando `regimeTomador === 'SIMPLES'`. **(verificado: LC 123/06 art. 23)**

---

## 7. Vedações / estorno

1. Frete vinculado a **saída isenta/não tributada** → veda/estorna (LC 87/96 art. 20 §3º, art. 21).
2. **Tomador não-contribuinte** → sem crédito.
3. **Bem de uso/consumo** → sem crédito (postergado, hoje vedado).
4. **Ativo imobilizado** → o frete segue a regra do bem (CIAP, 1/48) — não creditar 100% de uma vez.
5. **CT-e CIF para o comprador** → empresa não é tomadora → sem crédito.
6. **CT-e cancelado/denegado/com evento de desacordo** → conferir `cteProc.protCTe` (status do protocolo) antes de creditar.
7. **Transporte intramunicipal** → ISS, sem crédito de ICMS.
8. **Crédito presumido/outorgado** (`vCred`, `cBenef`) → pode **substituir** o destacado (não soma) — exige confirmação da norma estadual.

---

## 8. Motor determinístico

### Entrada (DTO)
```ts
interface EntradaCreditoCTe {
  grupoIcms: 'ICMS00'|'ICMS20'|'ICMS45'|'ICMS60'|'ICMS90'|'ICMSOutraUF'|'ICMSSN';
  cstIcms: string;            // imp.ICMS.<grupo>.CST
  vIcms: number;              // vICMS destacado (centavos); 0/undefined se grupo sem destaque
  vCred?: number;             // crédito presumido/outorgado (ICMS60/ICMS90)
  cBenef?: string;            // código de benefício (NT2024.001) → sinaliza regra estadual
  cfopEscrituracao: string;   // CFOP que a EMPRESA atribui na entrada (1/2.35x esperado)
  regimeTomador: 'NORMAL' | 'SIMPLES';
  tomadorEhEmpresa: boolean;  // CNPJ resolvido (toma3/toma4) == CNPJ da empresa
  operacaoVinculadaTributada?: boolean; // undefined → alerta de confirmação
}
```

### Saída
```ts
interface ResultadoCreditoCTe {
  creditoPermitido: boolean;
  valorCredito: number;       // = vICMS destacado (ou vCred em regra de benefício), senão 0
  baseLegal: string[];        // ex.: ['LC 87/96 art. 20', 'CF art. 155 §2º I']
  alertas: string[];
}
```

### Decisão (ordem)
1. `regimeTomador === 'SIMPLES'` → false, 0, alerta **A1**.
2. `tomadorEhEmpresa === false` → false, 0, alerta **A2** (provável CIF / empresa não é tomadora).
3. CFOP de escrituração começa com **5/6** → false, 0, alerta **A3**.
4. Por grupo:
   - `ICMS00` → true, valor=`vIcms`. base `[LC 87/96 art.20; CF 155 §2º I]`.
   - `ICMS20` → true, valor=`vIcms` (se `>0`; senão **A6**). base idem + `[art.21]`. Se `cBenef` → **A7**.
   - `ICMS45` → false, 0, alerta **A4**.
   - `ICMS60` → false, 0. Se `vCred>0` → **A8**.
   - `ICMS90` → se `vIcms>0` → true, valor=`vIcms`; senão se `vCred>0` → **A8** + valor candidato `vCred`, `creditoPermitido` pendente; senão false. **A7** se `cBenef`.
   - `ICMSOutraUF` → false, 0, alerta **A9**.
   - `ICMSSN` → false, 0, alerta **A5**.
5. Se `creditoPermitido===true` **e** `operacaoVinculadaTributada !== true` → manter crédito + alerta **A0** (não bloqueia; pendência para homologação humana).
6. Sanidade: se `vIcms > vTPrest` → alerta **A10** (XML inconsistente).

### Alertas
- **A0** — Confirmar vínculo com operação tributada/creditável (entrada p/ revenda/industrialização). *(sempre que houver crédito sugerido)*
- **A1** — Tomador optante do Simples não toma crédito ordinário (LC 123/06 art. 23).
- **A2** — Empresa não é a tomadora (toma3/toma4 diverge do CNPJ) — provável CIF; crédito é do remetente.
- **A3** — CFOP de escrituração é de saída/prestação (5/6xxx); tomada exige 1/2.35x.
- **A4** — Sem destaque de ICMS (CST 40/41/51) — sem crédito.
- **A5** — Transportadora optante do Simples (ICMSSN) — sem crédito ordinário.
- **A6** — ICMS20 sem `vICMS` destacado (>0) — verificar XML.
- **A7** — Há `cBenef`/`vICMSDeson` — possível crédito presumido/outorgado; confirmar norma estadual.
- **A8** — ICMS-ST (CST 60) ou `vCred` informado — crédito segue regra de ST da UF; não é ordinário.
- **A9** — `ICMSOutraUF` — tratamento interestadual específico; sem crédito ordinário automático.
- **A10** — `vICMS` incompatível com `vTPrest` — inconsistência no XML.

> **Integração Apurax:** `DocumentoFiscal` modelo **57** carrega item `{ grupoIcms, cstIcms, vBC, pICMS, vICMS, vCred, cBenef, cfop=ide.CFOP, vTPrest, tomadorCnpjResolvido }`. Motor gera crédito **SUGERIDO**; alertas A0/A2/A7/A8/A9 viram pendências antes de **HOMOLOGADO**. Cada crédito grava `baseLegal[]`.

---

## Fontes
- [Anexo I – Leiaute do CT-e (portal oficial)](https://www.cte.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=7V+i40m98sg%3D)
- [NT 2024.001 CT-e (Focus NFe)](https://focusnfe.com.br/notas-tecnicas/cte/2024-001/) · [NT 2024.001 (Tecnospeed)](https://blog.tecnospeed.com.br/ct-e-e-ct-e-os-nota-tecnica-2024-001-novos-campos-e-alteracao-das-regras-de-validacao/) · [CT-e 4.0 NT2024.001 (Inventti)](https://documentacao.inventti.com.br/CTePack2/pt-br/v_24_2_1/NT2024001/index.html)
- [Guia CTe_Util — ICMS00 (NT2015/003)](https://flexdocs.net/guiaCTe/gerarCTe.imp.icms00NT2015003.html) · [ICMS45 (NT2024.001)](https://flexdocs.net/guiaCTe/gerarCTeSimp.imp.icms45NT24001.html) · [ICMSSN (NT2015/003)](https://www.flexdocs.net/guiaCTe/gerarCTe.imp.icmssn300.html) · [Tomador toma3/toma4](https://flexdocs.net/guiaCTe/gerarCTe.toma.html)
- [Modelo CTe.INI — ACBrMonitor](https://acbr.sourceforge.io/ACBrMonitor/ModeloCTeINI.html)
- [RC 22980/2021 SEFAZ-SP (tomador, CIF/FOB)](https://www.legisweb.com.br/legislacao/?id=410600) · [RC 27136/2023](https://www.legisweb.com.br/legislacao/?id=441928) · [RC 29229/2024](https://legislacao.fazenda.sp.gov.br/Paginas/RC29229_2024.aspx)
- [LC 123/06 (texto, art. 23)](https://www.comprasnet.gov.br/legislacao/leis/lei123_2006.htm) · [Crédito ICMS Simples — SEFAZ-RS](https://atendimento.receita.rs.gov.br/uma-empresa-optante-pelo-simples-nacional-pode-transferir-credito-de-icms)
- [CFOP 1352 (Contadores CNT)](https://www.contadores.cnt.br/cfop/1352-aquisicao-de-servico-de-transporte-por-estabelecimento-industrial.html) · [CFOP 1353 (TOTVS)](https://www.totvs.com/blog/gestao-logistica/cfop-1353/) · [Grupo 1350 (Bluesoft Cosmos)](https://cosmos.bluesoft.com.br/tabelas/cfop/1350-aquisicoes-de-servicos-de-transporte)