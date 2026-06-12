# Distribuição DFe + manifestação + custódia de A1 (VERIFICADO)

# Apurax Etapa 8 — Distribuição DFe (NF-e/CT-e) + Manifestação + Custódia A1

Documento consolidado e auditado para codar. Notas "(verificado: ...)" indicam confirmação contra fonte oficial/MOC; "(INCERTO: ...)" exige conferência no XSD/portal em homologação antes do deploy.

Fontes (no fim): NT 2014.002 (Distribuição DFe NF-e), NT 2015.002 (Distribuição DFe CT-e), NT 2020.001 v1.50 (Manifestação), MOC, sped-nfe, FlexDocs, Focus NFe, TecnoSpeed, NS Tecnologia.

---

## 0. Resumo das correções da auditoria (ler antes de codar)

- **cStat 656 — causa ampliada (CORRIGIDO):** não é apenas "consultar antes de 1h sem documentos". Há um **limite de frequência ~20 consultas/hora por interessado** (NT 2014.002) e bloqueio também por **consulta fora de sequência** (não usar o `ultNSU` retornado). Consultas simultâneas de mais de um sistema sobre o mesmo certificado também disparam 656. (verificado: Focus NFe, TecnoSpeed, sisloc)
- **Nome do evento 210210 — CORRIGIDO:** o nome oficial é **"Ciência da Operação"** (descEvento `Ciencia da Operacao`), NÃO "Ciência da Emissão". Algumas bases informais usam "Ciência da Emissão" como sinônimo — usar o nome oficial no código/descEvento. (verificado: FlexDocs, NT 2020.001)
- **Qual evento libera o `procNFe` completo — CONFIRMADO E PRECISADO:** o XML completo só é disponibilizado na Distribuição DFe **após manifestação**, e **qualquer** das manifestações libera: **Ciência da Operação (210210), Confirmação da Operação (210200) ou Operação não Realizada (210240)**. Antes de manifestar, só vem o **resumo** (`resNFe`). Para automação de captura, **210210 é o evento de menor compromisso fiscal** que destrava o XML. (verificado: FlexDocs, MOC RecepcaoEventoManifestacao, NT 2020.001) — **Atenção (CORRIGIDO):** o **Desconhecimento da Operação (210220)** NÃO está na lista de eventos que disponibilizam o documento para distribuição; trate-o como manifestação de repúdio, não como "destravador de XML".
- **Schemas do docZip — CONFIRMADOS** com ressalva de versionamento: `resNFe` aparece tanto como `resNFe_v1.00.xsd` quanto `resNFe_v1.01.xsd`; `resEvento` aparece como `resEvento_1.00.xsd` (sem o `v`) e `resEvento_v1.01.xsd`. **Rotear sempre pelo prefixo antes de `_` e tolerar presença/ausência de `v` e variação de versão.** (verificado: sped-nfe DistDFe.md, MOC)
- **Regra ultNSU/maxNSU — CONFIRMADA:** sempre consultar com o `ultNSU` retornado; `ultNSU == maxNSU` ⇒ sincronizado (parar). Lote de **até 50 documentos**. (verificado: sped-nfe, NT 2014.002, TecnoSpeed)
- **Prazo conclusivo reduzido — INCERTO (fonte secundária):** corte de 180→90 dias atribuído a Ajuste SINIEF (citado como 14/2026), vigência ~01/06/2026. Confirmar o Ajuste/NT vigente antes do deploy. Ciência (210210) = 10 dias. (NS Tecnologia, Nota Gateway, blog TecnoSpeed)

---

## 1. Arquitetura do webservice de Distribuição DFe

**Serviço centralizado na RFB (Ambiente Nacional), NÃO por UF/SVRS.** A Distribuição DFe é única, nacional, operada pela Receita Federal. Não importa a UF do cliente — o endpoint é sempre o AN. (verificado: NT 2014.002, portal SP)

NF-e e CT-e são **dois serviços separados, com séries de NSU independentes**. Modele duas séries de NSU por CNPJ (uma NF-e, uma CT-e). Não misture. (verificado)

Transporte: **SOAP 1.2**, mTLS com A1. Método NF-e: `nfeDistDFeInteresse`; método CT-e: `cteDistDFeInteresse`. (verificado: WSDL/MOC)

Endpoints (confirmar no portal antes do deploy — mudam sem aviso longo):
- NF-e Produção: `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
- NF-e Homologação: `https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`
- CT-e Produção: `https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx`
- CT-e Homologação: `https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx` (INCERTO: padrão `hom1` por analogia; confirmar no portal de homologação CT-e)

Namespaces e SOAPAction:
- NF-e: binding/WSDL `http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe`; SOAPAction `http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse`; conteúdo `distDFeInt` no namespace `http://www.portalfiscal.inf.br/nfe`; parâmetro de entrada `nfeDadosMsg`, resposta `nfeDistDFeInteresseResult`.
- CT-e: binding/WSDL `http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe`; SOAPAction `.../cteDistDFeInteresse`; conteúdo no namespace `http://www.portalfiscal.inf.br/cte`; parâmetro `cteDadosMsg`, resposta `cteDistDFeInteresseResult`.

> Implementação: o **mesmo** XML `distDFeInt` (campos idênticos) serve aos dois serviços; muda só o namespace, a URL e o método SOAP. Abstraia o transporte numa interface `IDistDFeTransport.enviar(soapAction, url, namespace, xmlDistDFeInt) -> xmlRetDistDFeInt` (testável com stub).

## 2. Request — `distDFeInt` (estrutura exata)

Schema de entrada `distDFeInt`. Versão atual `1.35` (INCERTO: baixar o XSD vigente do portal em homologação e fixar a `versao` exata — histórico 1.00 → 1.01 → 1.35). Três tipos de consulta **mutuamente exclusivos** (choice — escolha exatamente uma tag):

```xml
<distDFeInt versao="1.35" xmlns="http://www.portalfiscal.inf.br/nfe">
  <tpAmb>1</tpAmb>                 <!-- 1=prod, 2=homolog -->
  <cUFAutor>35</cUFAutor>          <!-- UF do autor da consulta (IBGE); opcional p/ AN, usar UF do interessado -->
  <CNPJ>99999999000191</CNPJ>      <!-- ou <CPF> do interessado -->
  <!-- ESCOLHA UMA: -->
  <distNSU><ultNSU>000000000000000</ultNSU></distNSU>
  <!-- <consNSU><NSU>000000000000123</NSU></consNSU> -->
  <!-- <consChNFe><chNFe>NFe44...</chNFe></consChNFe>   (CT-e: consChCTe/chCTe) -->
</distDFeInt>
```

NSU = 15 dígitos, zero-padded à esquerda. Envelopar o `distDFeInt` dentro do body SOAP do método (`nfeDadosMsg`/`cteDadosMsg`). O `distDFeInt` **não é assinado** (só a chamada usa mTLS). O evento de manifestação (seção 6) **é assinado** (XML-DSig). (verificado)

As três consultas:

| Modo | Conteúdo | Uso |
|------|----------|-----|
| `distNSU` → `ultNSU` | último NSU já processado (15 díg., zero-pad) | **Loop principal / varredura incremental.** Retorna em lote os documentos com NSU > `ultNSU`. |
| `consNSU` → `NSU` | um NSU específico (15 díg.) | Recuperar um NSU pontual (preencher buraco / reprocessar 1 doc). |
| `consChNFe` → `chNFe` | chave 44 díg. (CT-e: `consChCTe`/`chCTe`) | Buscar por chave; interessado deve ter vínculo com o documento. Não usar para varredura. |

Regra: **use `distNSU`** para a captura automática; `consNSU` só para reparo de lacuna; `consChNFe` só para enriquecimento por chave conhecida. (verificado)

## 3. Response — `retDistDFeInt`, cStat e máquina de estados

```xml
<retDistDFeInt versao="1.35" xmlns="http://www.portalfiscal.inf.br/nfe">
  <tpAmb>1</tpAmb>
  <verAplic>...</verAplic>
  <cStat>138</cStat>
  <xMotivo>Documento(s) localizado(s)</xMotivo>
  <dhResp>2026-06-09T10:00:00-03:00</dhResp>
  <ultNSU>000000000000123</ultNSU>   <!-- último NSU DESTE lote -->
  <maxNSU>000000000000875</maxNSU>   <!-- maior NSU existente no AN p/ o interessado -->
  <loteDistDFeInt>
    <docZip NSU="000000000000101" schema="resNFe_v1.01.xsd">H4sIAAAA...==</docZip>
    <docZip NSU="000000000000102" schema="procNFe_v4.00.xsd">H4sIAAAA...==</docZip>
    <!-- ... até 50 docZip ... -->
  </loteDistDFeInt>
</retDistDFeInt>
```

(INCERTO: o nome do elemento agregador aparece nas fontes como `loteDistDFeInt`; algumas implementações citam `loteDistDFe`. Confirmar no XSD `retDistDFeInt` vigente — parsear por nome local tolerando ambos.)

cStat no nível do `retDistDFeInt` (verificado: MOC, NT 2014.002, Focus NFe, sped-nfe):

| cStat | Significado | Ação do worker |
|---|---|---|
| **138** | Documento(s) localizado(s) | Há lote. Decodificar cada `docZip`, persistir `ultNSU`. Se `ultNSU < maxNSU`, **consultar de novo imediatamente** (próximo lote — varredura encadeada legítima). |
| **137** | Nenhum documento localizado | Lote vazio. `ultNSU` volta igual ao enviado. **Fim da varredura** → cooldown (~1h). |
| **656** | Rejeição: Consumo Indevido | **Bloqueio do interessado ~1h.** Parar imediatamente, backoff; retomar com `ultNSU` correto. Tentar durante o bloqueio **reinicia o timer**. |
| 108 / 109 | Serviço paralisado momentânea/sem previsão | Retry com backoff; não é erro de uso. |
| 215 / 232 / 233 / 252 etc. | Falha de schema/valor (versão, tpAmb divergente, NSU inválido, cUFAutor) | Erro de montagem do request — corrigir, não retentar igual. |

Tratar como sucesso operacional apenas **138 (com lote)** e **137 (vazio)**. Tudo mais → não avançar NSU.

Campos de controle: `ultNSU` = maior NSU **deste lote**; `maxNSU` = maior NSU existente no AN para o interessado naquele momento; `dhResp` = timestamp.

### Máquina de estados (lógica determinística — testável com stub)

```
IDLE --distNSU(ultNSU persistido)--> AWAIT
AWAIT(138, ultNSU<maxNSU)  --> AWAIT       (consulta imediata, sem cooldown; respeitar teto de freq.)
AWAIT(138, ultNSU==maxNSU) --> COOLDOWN(now+1h)
AWAIT(137)                 --> COOLDOWN(now+1h)
AWAIT(656)                 --> BLOCKED(now+1h, backoff exponencial se reincidir)
COOLDOWN/BLOCKED(t<expira) --> espera
COOLDOWN/BLOCKED(expirou)  --> IDLE
```

Persistir por interessado+tipo(NFe/CTe): `{lastUltNSU, lastMaxNSU, cooldownUntil, blockedUntil, lastCStat}`. **Nunca** disparar consulta sem checar `cooldownUntil`/`blockedUntil`. Relógio por interessado (CNPJ), não global.

### Regras-chave que disparam 656 — Consumo Indevido (CORRIGIDO/AMPLIADO; verificado: Focus NFe, TecnoSpeed, sisloc, NT 2014.002)

1. **Reenviar `ultNSU` que não avança** (loop reenviando o mesmo NSU, ou consulta fora da sequência sem usar o `ultNSU` retornado) → 656 e bloqueio.
2. **Frequência:** o serviço impõe **limite de ~20 consultas/hora por interessado** (NT 2014.002). Após `cStat=137` (sincronizado), **mínimo recomendado ≈ 1 consulta/hora**. (verificado)
3. **Consultas simultâneas** de mais de um processo/sistema sobre o **mesmo certificado/CNPJ** → 656. Garanta **um único worker por interessado** (lock/serialização). (verificado: Focus NFe)
4. Quando `cStat=138` e `ultNSU<maxNSU`, **encadear lotes é permitido e não conta como consumo indevido**, desde que cada chamada use o `ultNSU` retornado e o teto de frequência horária seja respeitado.
5. Após **656**, respeitar **~1h** de bloqueio; tentar durante o bloqueio **reinicia o cronômetro** (piora). xMotivo costuma instruir: "Deve ser utilizado o ultNSU nas solicitações subsequentes. Tente após 1 hora".
6. **Nunca reenviar `ultNSU=0`** quando já há NSU avançado — reprocessar do zero é causa clássica de 656.

Implementação: cooldown configurável (default 3600 s após 137 e após 656); idealmente um **rate-limiter de 20 req/hora por interessado** como guarda-chuva, independentemente do estado.

## 4. Conteúdo do lote — decode do `docZip`

```xml
<loteDistDFeInt>
  <docZip NSU="000000000000123" schema="resNFe_v1.01.xsd">H4sIA...base64...</docZip>
  <docZip NSU="000000000000124" schema="procNFe_v4.00.xsd">H4sIA...</docZip>
</loteDistDFeInt>
```

Cada `docZip`: **conteúdo = Base64( GZIP( XML ) )**. (verificado: sped-nfe — `content = gzdecode(base64_decode(...))`)

Decode determinístico (testável):
1. `bytes = base64Decode(conteudoTexto)`
2. `xml = gunzip(bytes)` — **GZIP/RFC 1952** (header `1F 8B`). Em Node: `zlib.gunzipSync(Buffer.from(text,'base64'))`, **NÃO** `inflateSync`.
3. `parse(xml)` roteando pelo prefixo de `schema` (§5).

Atributos obrigatórios do `docZip`: `NSU` (15 díg.) e `schema` (nome do XSD do conteúdo). **Persistir o NSU mesmo de docZip que não consumir**, para não reprocessar.

## 5. Schemas no `docZip` — roteamento do parser

O atributo `schema` traz o nome do XSD com versão. **Roteie pelo prefixo (parte antes de `_v` ou `_`), tolerando ausência do `v` e variação de versão.** Nunca roteie por inspeção do XML. Schema desconhecido → log + persistir NSU + ignorar (futuras versões). (verificado: sped-nfe, MOC)

### NF-e (namespace `http://www.portalfiscal.inf.br/nfe`)
| prefixo de `schema` | Exemplos observados | Raiz XML | Conteúdo |
|---|---|---|---|
| `resNFe` | `resNFe_v1.00.xsd`, `resNFe_v1.01.xsd` | `<resNFe>` | **Resumo** da NF-e (chave, emitente, valor, dhEmi, tpNF, situação). Entregue antes da manifestação. |
| `procNFe` | `procNFe_v3.10.xsd`, `procNFe_v4.00.xsd` | `<nfeProc>` | **NF-e completa** (NFe + protNFe). Liberada após manifestação (§7). |
| `resEvento` | `resEvento_1.00.xsd`, `resEvento_v1.01.xsd` | `<resEvento>` | Resumo de evento (cancelamento, CC-e, manifestação, EPEC). |
| `procEventoNFe` | `procEventoNFe_v1.00.xsd` | `<procEventoNFe>` | Evento completo (evento + retEvento). |

### CT-e (namespace `http://www.portalfiscal.inf.br/cte`)
| prefixo de `schema` | Raiz XML | Conteúdo |
|---|---|---|
| `resCTe` | `<resCTe>` | Resumo do CT-e. |
| `procCTe` | `<cteProc>` | CT-e completo (CTe + protCTe). |
| `resEvento` (ou `resEventoCTe`) | `<resEvento>` | Resumo de evento de CT-e. (INCERTO: confirmar prefixo `resEvento` vs `resEventoCTe` no XSD CT-e) |
| `procEventoCTe` | `<procEventoCTe>` | Evento completo de CT-e. |

## 6. Webservice de recepção de evento + estrutura (manifestação)

Serviço: **`RecepcaoEvento` / método `nfeRecepcaoEvento`** — **por SEFAZ autorizadora/SVRS**, distinto da Distribuição DFe (AN). Para eventos de manifestação do destinatário usa-se **`cOrgao = 91` (Ambiente Nacional)**. O lote (`envEvento`) aceita **1 a 20 eventos**. (verificado: MOC RecepcaoEventoManifestacao)

```xml
<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="ID210210{chNFe(44)}{nSeqEvento(2)}">
      <cOrgao>91</cOrgao>            <!-- 91 = Ambiente Nacional p/ manifestação -->
      <tpAmb>1</tpAmb>
      <CNPJ>99999999000191</CNPJ>    <!-- destinatário que manifesta (ou <CPF>) -->
      <chNFe>44 dígitos</chNFe>
      <dhEvento>2026-06-09T10:00:00-03:00</dhEvento>
      <tpEvento>210210</tpEvento>
      <nSeqEvento>1</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Ciencia da Operacao</descEvento>
        <!-- xJust SOMENTE p/ 210240 (Operacao nao Realizada) -->
      </detEvento>
    </infEvento>
    <Signature>...XML-DSig sobre infEvento via Id...</Signature>
  </evento>
</envEvento>
```

Regras determinísticas:
- **`Id`** = `"ID" + tpEvento + chNFe(44) + nSeqEvento(2 díg.)`. A assinatura referencia esse `Id`.
- **`cOrgao` = 91** (AN) para manifestação do destinatário.
- **`descEvento`** fixo por tipo, **sem acento** (exatamente como na tabela §7).
- **`nSeqEvento`** 1–20. Reenvio idêntico → **573 (duplicidade)**. Sequência além do limite → **594**.
- **`xJust`** obrigatório só no **210240** (mín. 15 / máx. 255 chars). Faltando → **595**.

Retorno (`retEnvEvento` → `retEvento`/`infEvento`), cStat (verificado: MOC):

| cStat | Significado | Tratamento |
|---|---|---|
| **135** | Evento registrado e vinculado à NF-e | sucesso |
| **136** | Evento registrado, **não vinculado** à NF-e (nota não está na base) | sucesso parcial |
| 573 | Duplicidade de evento | idempotência — já manifestado |
| 575 | Autor do evento difere do destinatário da NF-e | erro de negócio, não-retentável |
| 594 | nSeqEvento acima do permitido | erro |
| 595 | xJust obrigatório não informado | erro de montagem |
| 596 | Evento fora do prazo | erro de negócio, não-retentável |

Trate 135/136 como sucesso; 573 como idempotência.

## 7. resNFe → procNFe: manifestação que libera o XML completo (NF-e)

Pela NT 2014.002 / NT 2020.001, o destinatário (não-emitente) recebe via Distribuição DFe **apenas o `resNFe` (resumo)** das notas contra seu CNPJ. **O `procNFe` completo só é disponibilizado na distribuição APÓS o destinatário manifestar.** (verificado: FlexDocs, MOC, NT 2020.001)

Os documentos/eventos passam a ser disponibilizados para distribuição se o destinatário manifestar **Ciência da Operação (210210), Confirmação da Operação (210200) ou Operação não Realizada (210240)**. (verificado: nfe.fazenda.gov.br / MOC) — **o Desconhecimento (210220) NÃO consta como liberador de XML** (é repúdio).

| tpEvento | Nome oficial | descEvento (sem acento) | Conclusivo? | xJust | Libera procNFe? |
|---|---|---|---|---|---|
| **210210** | **Ciência da Operação** | `Ciencia da Operacao` | Não (intermediário) | Não | **SIM** — menor compromisso fiscal; preferido p/ captura automática |
| **210200** | Confirmação da Operação | `Confirmacao da Operacao` | Sim | Não | SIM |
| **210220** | Desconhecimento da Operação | `Desconhecimento da Operacao` | Sim (repúdio) | Não | Não é o propósito (não libera por esta via) |
| **210240** | Operação não Realizada | `Operacao nao Realizada` | Sim | **Sim** (xJust 15–255) | SIM |

> CORREÇÃO de nomenclatura: o 210210 é **"Ciência da Operação"** na NT/XSD. "Ciência da Emissão" aparece em material informal como sinônimo — não usar como nome oficial.

Fluxo de captura completo (NF-e de entrada):
1. Varredura `distNSU` → recebe `resNFe` de notas novas.
2. Para cada chave nova, registrar **210210 (Ciência)** automaticamente (com consentimento — §10) para destravar o XML.
3. Próxima varredura → AN gera **novo NSU** com o `procNFe` completo daquela chave, capturado no próximo `distNSU`. Ou seja: o pipeline precisa do ciclo **manifestação → re-consulta**.

Prazos (NT 2020.001 v1.50):
- **Ciência da Operação (210210): até 10 dias** da autorização da NF-e (intermediária/opcional). (verificado)
- **Manifestação conclusiva (210200/210220/210240):** historicamente **180 dias**; **INCERTO: redução para 90 dias** atribuída a Ajuste SINIEF (citado como 14/2026), vigência ~01/06/2026 — **confirmar o Ajuste/NT vigente antes do deploy (junho/2026).** (fontes secundárias: NS Tecnologia, Nota Gateway, blog TecnoSpeed)
- v1.50: passou a permitir **retificar até 2 vezes** a manifestação conclusiva por NF-e, valendo a última registrada (Ajuste SINIEF 43/23). (verificado: NS Tecnologia, Inventti)
- Manifestação **obrigatória** em segmentos sensíveis (ex.: combustíveis). (verificado: FlexDocs)

CT-e **não** possui esse fluxo de manifestação para liberar o `procCTe` — o resumo/processo é distribuído conforme vínculo do ator. Eventos de CT-e (ex.: Prestação de Serviço em Desacordo) são próprios e **não reaproveitam** os tpEvento de NF-e. (verificado)

## 8. mTLS + XML-DSig em Node.js

**Transporte (mTLS):** a chamada SOAP autentica via TLS mútuo com o A1 do cliente.
```js
const agent = new https.Agent({ pfx: pfxBuffer, passphrase, keepAlive: true });
// usar o agent no cliente HTTP (axios/undici/got) para o POST SOAP 1.2
```
Cabeçalho SOAP 1.2: `Content-Type: application/soap+xml; charset=utf-8`. `pfxBuffer`/`passphrase` vêm **descriptografados só em memória** (§9). O agent real fica atrás da interface de transporte (stub nos testes).

**Assinatura do evento (XML-DSig):** o `infEvento` é assinado com a **chave privada do A1**. Padrão DFe: canonicalização **C14N exclusiva**, `<Reference URI="#ID...">` apontando o `Id` do `infEvento`, transforms `enveloped-signature` + C14N, `<X509Certificate>` no KeyInfo. (INCERTO: SignatureMethod/DigestMethod — o padrão NF-e historicamente usa **SHA1 (RSA-SHA1)**; confirmar na NT vigente se já há exigência de SHA-256.)

Bibliotecas Node:
- **`xml-crypto`** (`SignedXml`) para a assinatura enveloped sobre o `infEvento`.
- **`node-forge`** ou `node:crypto` (PKCS#12) para extrair cert+chave do `.pfx` quando o signer exigir PEM. Para o transporte, `https.Agent({pfx})` aceita o buffer PFX direto.
- Referências de layout (não dependência): `nfephp-org/sped-nfe` (PHP).

Material extraído (chave PEM, passphrase): **nunca em log, disco ou banco** — só em memória do worker, descartado após uso.

## 9. Custódia de certificado A1 — envelope encryption

**Por que A1 e não A3:** A1 é `.pfx` (cert + chave privada **exportável**), custodiável e usável server-side. **A3 vive em token/smartcard/HSM com chave não-exportável** — fora de escopo. Suportar só A1.

**Envelope encryption (concreto):**
1. **DEK por certificado:** DEK aleatória de 256 bits (`crypto.randomBytes(32)`) por A1.
2. **Cifrar o PFX** com `AES-256-GCM` usando a DEK: IV de 96 bits aleatório por operação; guardar `ciphertext`, `iv`, `authTag`. Cifrar **também a passphrase** (mesmo esquema, IV próprio).
3. **Embrulhar a DEK** (wrap) com a **master key / KMS** (AWS KMS `Encrypt`, GCP KMS, Azure Key Vault, ou master key em HSM). Persistir só a DEK **cifrada** (`encryptedDek`). A master key **nunca** sai do KMS.
4. **No banco:** apenas `encryptedPfx`, `pfxIv`, `pfxAuthTag`, `encryptedPassphrase`, `passIv`, `passAuthTag`, `encryptedDek`, `kmsKeyId`, `notBefore`, `notAfter`, `cnpj`, `thumbprint`. **Nenhum material em claro.**
5. **No uso (worker):** KMS `Decrypt(encryptedDek)` → DEK em memória → AES-256-GCM decrypt do PFX e da passphrase (verificar `authTag` — falha = adulteração) → passar `pfx`/`passphrase` ao `https.Agent` e ao signer → **zerar buffers** após (`buffer.fill(0)`). Material em claro **só em memória do worker**, nunca serializado/logado.
6. **Auditoria imutável de cada uso/descriptografia:** append-only (WORM / log assinado), registrando `certId`, `cnpj`, `quando`, `worker/host`, `operação` (DistDFe / manifestação 210210 etc.), `NSU enviado`, `cStat`, `qtd docZip`, `chNFe quando aplicável`, `resultado`. Sem o conteúdo do certificado.
7. **Rotação/expiração:** monitorar `notAfter`; alertar 30/15/7 dias antes; **bloquear uso** após `notAfter`. Rotação de master key via KMS (rewrap das DEKs sem re-cifrar PFX). Rotação de DEK em re-upload.
8. **Validação de carga:** ao ingerir o `.pfx`, validar passphrase (parse), extrair CNPJ/thumbprint/validade, conferir que o CNPJ do cert bate com o do cliente.

## 10. Manifestação é ato fiscal — consentimento e idempotência

Registrar manifestação é **ato fiscal irreversível** em nome do cliente perante a SEFAZ, com efeito jurídico. Requisitos:
- **Consentimento explícito e específico por CNPJ** antes de qualquer manifestação automática. Distinga: "só capturar resumo" (sem manifestar) × "manifestar 210210 para baixar XML" × "manifestação conclusiva (210200/210220/210240)".
- **210210 automático** é o único defensável para automação ampla (efeito jurídico mínimo, apenas declara ciência). **210200/210220/210240 jamais automáticos sem ação humana explícita** — confirmam/repudiam a operação e alteram responsabilidade tributária.
- **Idempotência:** antes de enviar, checar se já existe evento (`tpEvento`+`chNFe`) para não tomar 573 nem duplicar ação fiscal.
- Auditoria imutável: `quem/quando/qual evento/qual chave/nSeqEvento/protocolo de retorno`.

## 11. Particularidades CT-e

- Serviço separado: `CTeDistribuicaoDFe` / `cteDistDFeInteresse`, **NSU próprio**. Schemas `resCTe`/`procCTe`/eventos próprios.
- Mesma mecânica de `distNSU`/`consNSU`/`consChCTe`, mesmos cStat 137/138/656, mesmo cooldown ~1h, mesmo docZip GZIP+Base64.
- **Janela de disponibilidade:** documentos disponíveis por período limitado no AN após recepção (INCERTO: confirmar prazo vigente — citado ~3 meses; validar na NT 2015.002/portal). Consultar com regularidade para não perder a janela.
- Para captura de entrada, o CT-e geralmente já entrega `procCTe` sem manifestação (o tomador costuma constar no CT-e), mas valide caso a caso.

## 12. Testes determinísticos (stub do transporte)

Fixtures de `retDistDFeInt` canônicos: (a) 138 com lote multi-schema, (b) 138 com `ultNSU<maxNSU` (encadeamento), (c) 137 (vazio → cooldown), (d) 656 (bloqueio → backoff), (e) lote no limite de 50. Fixtures de `docZip` (base64+gzip de cada schema) para validar decode e roteamento por prefixo (incl. `resEvento_1.00.xsd` sem `v`). Testar rate-limiter de 20/h e lock de worker único por interessado.

## Pontos a fechar antes do deploy (junho/2026)
1. `versao` exata do `distDFeInt`/`retDistDFeInt` (baixar XSD vigente em homologação) e nome do agregador (`loteDistDFeInt` vs `loteDistDFe`).
2. Prazo conclusivo vigente (180 vs 90 dias) — confirmar Ajuste SINIEF/NT em vigor.
3. URL de homologação CT-e (`hom1.cte.fazenda.gov.br`).
4. Algoritmo de assinatura aceito (SHA1 vs SHA256).
5. Prefixo de evento no CT-e (`resEvento` vs `resEventoCTe`) e janela de disponibilidade CT-e.

## Fontes
- [NT 2014.002 — NFeDistribuicaoDFe (nfe.fazenda.gov.br)](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=wLVBlKchUb4%3D)
- [MOC — WS NFeDistribuicaoDFe (sped.fazenda.pr.gov.br)](http://moc.sped.fazenda.pr.gov.br/NFeDistribuicaoDFe.html)
- [MOC — RecepcaoEvento Manifestação (sped.fazenda.pr.gov.br)](http://moc.sped.fazenda.pr.gov.br/RecepcaoEventoManifestacao.html)
- [sped-nfe — DistDFe.md (schemas, ultNSU/maxNSU, decode gzip, limite 50)](https://github.com/nfephp-org/sped-nfe/blob/master/docs/metodos/DistDFe.md)
- [Manifestação do Destinatário — eventos, nomes e XML completo (FlexDocs)](https://flexdocs.net/guia-nfe/manifestacao-destinatario/)
- [Rejeição 656 / Consumo Indevido — 20 consultas/hora, cooldown 1h, consultas simultâneas (Focus NFe)](https://focusnfe.com.br/blog/rejeicao-656/)
- [Distribuição DFe — sincronização e uso indevido (TecnoSpeed)](https://atendimento.tecnospeed.com.br/hc/pt-br/articles/10794811536791)
- [Distribuição DF-e 137/656 (sisloc)](https://atendimento.sisloc.com.br/hc/pt-br/articles/5801020281755)
- [NT 2020.001 v1.50 — Manifestação do Destinatário (NS Tecnologia)](https://blog.nstecnologia.com.br/nt-2020-001-v1-50-mudanca-da-manifestacao-do-destinatario/)
- [NT 2020.001 v1.10 / prazos atualizados (Nota Gateway)](https://notagateway.com.br/blog/manifestacao-do-destinatario-na-nf-e-entenda-a-recente-nt-2020-001-v1-10-e-os-prazos-atualizados/)
- [NT 2015.002 — CTeDistribuicaoDFe (cte.fazenda.gov.br)](https://www.cte.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=5c1PwLTdrCA%3D)
- [Endpoints/SOAP 1.2 Ambiente Nacional (portal SP)](https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/URL-WEBSERVICES.aspx)