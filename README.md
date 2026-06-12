# Apurax — núcleo fiscal (MVP, Etapas 0–3)

SaaS de **aproveitamento de créditos tributários** (ICMS, PIS, COFINS) a partir de **NF-e de entrada**.

> **Princípio inegociável:** o **valor do crédito é calculado por um motor determinístico** (regras versionadas por vigência, rastreáveis à base legal). A IA — nas próximas etapas — **classifica, valida, descobre e explica**, mas **nunca emite o número fiscal**. Todo crédito nasce `SUGERIDO` e só vira oficial após **homologação humana**.

## O que já existe (Etapas 0–3)

| Etapa | Módulo | Entrega |
|---|---|---|
| 0 | `prisma/`, `auth/`, `prisma.service` | Multi-tenant (tenant_id + **RLS**), `Empresa.regimeTributario` (roteador do produto), JWT + RBAC (Admin/Contador/Cliente) |
| 1 | `fiscal/` | Upload de XML de NF-e 55, parser **XXE-safe**, dedup por chave de acesso |
| 2 | `motor-credito/` | **Motor determinístico** ICMS + PIS/COFINS, data-driven, versionado por vigência, com base legal por crédito |
| 3 | `auditoria/`, `apuracao/` | Trilha **append-only com hash chain** + ciclo `SUGERIDO → HOMOLOGADO / GLOSADO` |
| 6 | `sped/` | Parser **EFD-Contribuições** (índices verificados) → análise de **lacuna** de PIS/COFINS (crédito não aproveitado / indevido / divergente) + reconciliação com NF-e |
| 7 | `ia/` | **Camada de IA**: classificação/validação de NCM·CFOP·CST (`claude-haiku-4-5`, strict tool use) + agente explicador (`claude-opus-4-8`, tool-use + RAG legal). **A IA não calcula imposto** — chama o motor via ferramenta |
| + | `cte/` | Ingestão de **CT-e (modelo 57)** + **crédito de ICMS sobre frete** (motor `avaliarCreditoCte`): tomador, regime, CST e destaque, com alertas A0–A10 |
| 8 | `dfe/` | **Distribuição DFe** (puxar NF-e/CT-e da SEFAZ por NSU) + **custódia de certificado A1** (envelope encryption AES-256-GCM); máquina de estados cStat/cooldown, decode docZip, manifestação 210210. Transporte SOAP/mTLS atrás de interface |
| 9 | `reforma/` + motor | **Dual-regime CBS/IBS**: parser do grupo `IBSCBS`, `avaliarCreditoCbsIbs` (crédito financeiro amplo, art. 47 LC 214/2025) e **`compararRegimes`** — o **delta de oportunidade** (legado × novo) projetado sob alíquota de referência |
| 10-11 | `apuracao-fiscal/` | **Apuração de impostos multi-regime**: parser estendido p/ NFC-e (mod 65) via `emit/CRT`; **`apurarIcms`** (débito das saídas − crédito das entradas → saldo a recolher / credor transportado, conforme E110) [Real/Presumido]; **`calcularDas`** (PGDAS-D: alíquota efetiva + Fator R + anexos) [Simples] |
| 12 | `apuracao-fiscal/` + parser | **IPI** (parser lê `IPITrib`/`IPINT`; débito CST 50 − crédito CST 00, E520); **PIS/COFINS** (débito das saídas; não-cumulativo abate crédito, cumulativo só débito — roteado por regime); **ISS** (`apurarIss`, cumulativo, `tpRetISSQN`) |

## Stack

NestJS 10 · PostgreSQL 16 · Prisma · `nestjs-cls` (contexto de tenant) · `fast-xml-parser` · Passport JWT.

## Quickstart

```bash
# 1. Infra (Postgres, Redis, MinIO)
docker compose up -d postgres

# 2. Dependências e variáveis
npm install
cp .env.example .env          # no Windows: copy .env.example .env

# 3. Schema + dados de exemplo
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed                  # cria tenant demo, admin e 2 empresas (Real e Presumido)

# 4. Subir
npm run start:dev             # http://localhost:3000
```

Login demo: `admin@apurax.local` / `apurax123`.

### Fluxo de uso (API)

```bash
# login -> pega o accessToken
curl -s localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@apurax.local","senha":"apurax123"}'

# listar empresas (use o Bearer token)
curl -s localhost:3000/empresas -H "authorization: Bearer $TOKEN"

# importar uma NF-e (cole o XML no campo "xml")
curl -s localhost:3000/fiscal/nfe -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"empresaId":"<id-empresa-lucro-real>","xml":"<conteudo-do-xml>"}'
# -> retorna o crédito potencial por tributo (ICMS/PIS/COFINS), tudo SUGERIDO

# revisar e homologar
curl -s localhost:3000/apuracoes?status=SUGERIDO -H "authorization: Bearer $TOKEN"
curl -s -X PATCH localhost:3000/apuracoes/<id>/homologar -H "authorization: Bearer $TOKEN"
```

## Endpoints

| Método | Rota | Papel | Descrição |
|---|---|---|---|
| POST | `/auth/login` | público | autentica e emite JWT |
| GET | `/health` | público | readiness (checa o banco) |
| POST | `/empresas` | Admin/Contador | cadastra empresa-cliente (define o regime) |
| GET | `/empresas` | autenticado | lista empresas do tenant |
| POST | `/fiscal/nfe` | qualquer | importa NF-e, calcula crédito, audita |
| GET | `/fiscal/documentos` | autenticado | lista NF-e importadas |
| GET | `/fiscal/documentos/:id` | autenticado | NF-e/CT-e com itens e apurações |
| POST | `/fiscal/cte` | qualquer | importa CT-e (mod. 57) e calcula o crédito de ICMS do frete |
| GET | `/apuracoes?status=` | autenticado | lista créditos apurados |
| PATCH | `/apuracoes/:id/homologar` | Admin/Contador | homologa o crédito |
| PATCH | `/apuracoes/:id/glosar` | Admin/Contador | rejeita o crédito (com motivo) |
| POST | `/reforma/comparar` | qualquer | delta de oportunidade CBS/IBS × legado para uma NF-e |
| POST | `/apuracao/icms` | Admin/Contador | apura ICMS da competência (débito−crédito→saldo) [Real/Presumido] |
| POST | `/apuracao/ipi` | Admin/Contador | apura IPI da competência (débito−crédito) |
| POST | `/apuracao/pis-cofins` | Admin/Contador | apura PIS e COFINS (não-cumul. abate crédito; cumul. só débito) |
| POST | `/apuracao/iss` | Admin/Contador | apura ISS a partir de NFS-e fornecidas (cumulativo) |
| POST | `/apuracao/simples-das` | qualquer | calcula o DAS do Simples (alíquota efetiva + Fator R) |
| POST | `/certificados` | Admin/Contador | armazena o A1 (.pfx) cifrado (envelope encryption) |
| POST | `/distribuicao/sincronizar` | Admin/Contador | varre a Distribuição DFe (NF-e/CT-e) por NSU |
| GET | `/distribuicao/cursores` | autenticado | estado da varredura (ultNSU/maxNSU, cooldown) |
| POST | `/sped/import` | qualquer | importa EFD-Contribuições e mede a lacuna de crédito |
| GET | `/sped/importacoes` | autenticado | lista importações de SPED |
| GET | `/sped/importacoes/:id` | autenticado | importação com as lacunas encontradas |
| POST | `/ia/classificar-item` | qualquer | valida NCM/CFOP/CST do item (Haiku, saída estruturada) |
| POST | `/ia/perguntar` | qualquer | agente explica o crédito via tool-use (Opus chama o motor + RAG legal) |

## Isolamento por tenant (RLS) — leia antes de produção

O **Quickstart usa o superusuário `postgres`, que IGNORA RLS** — bom para dev single-tenant, mas **sem isolamento real**. Para enforçar o isolamento:

1. Use o papel não-superusuário criado por `prisma/init-db.sql` (já provisionado pelo docker-compose). Aponte a `DATABASE_URL` do `.env` para `apurax_app` (linha comentada no `.env.example`).
2. Aplique as políticas **depois** de migrar e semear:
   ```bash
   npm run db:rls
   ```
A aplicação seta `app.current_tenant` por transação (`PrismaService.scoped`); as políticas (`prisma/rls.sql`) só liberam linhas do tenant corrente — e **fail-closed** se o contexto faltar.

> **Teste de isolamento de tenant** (dois tenants, RLS, fail-closed) é o item **P0** do roadmap e o gate de merge — ver `APURAX-arquitetura.md`.

## Regras de crédito (motor)

As regras vivem em `regra_credito` (seed em `prisma/seed.ts`), são **versionadas por vigência** e avaliadas por `MotorCreditoService`. Resumo do que já está modelado:

- **ICMS:** credita CST `00/10/20/70` (operação própria) e CSOSN `101/201` (`vCredICMSSN`); veda `40/41/50/51/60/90`; **Simples não credita ICMS**; ICMS-ST nunca credita a parcela própria.
- **PIS/COFINS:** só no **Lucro Real** (não-cumulativo). Credita entrada de emitente tributado (CST `01/02`); veda monofásico/ST/alíquota zero/isento/suspensão (CST `04–09`).

Cobertura em `src/motor-credito/motor-credito.service.spec.ts` (`npm test`).

## Análise de lacuna (SPED) — como funciona

`POST /sped/import` faz o parser do EFD-Contribuições, e para cada item de entrada (C170) compara o crédito **escriturado** com o **devido** (motor):

- **NAO_APROVEITADO** — CST com direito (50-56) mas crédito zerado → lacuna = `VL_BC × alíquota`.
- **INCONSISTENCIA** — crédito escriturado diverge de `VL_BC × alíquota`.
- **INDEVIDO** — CST sem direito (70-75) com crédito > 0 → risco de glosa.
- **REVISAO_PRESUMIDO** — crédito presumido (60-67) não escriturado → marcado p/ revisão (não calculado automaticamente).
- **ENTRADA_NAO_ESCRITURADA** — NF-e de entrada já ingerida no Apurax (mesma competência) que **não** aparece no SPED → crédito potencialmente não escriturado.

Detalhe do layout verificado em [docs/sped-efd-contribuicoes-layout.md](docs/sped-efd-contribuicoes-layout.md).

## Apuração de impostos multi-regime (Etapas 10–11)

O Apurax agora **apura**, não só recupera crédito. Os três regimes têm lógicas distintas:

- **Lucro Real / Presumido — `POST /apuracao/icms`:** soma o **débito** das saídas (NF-e/NFC-e, ICMS próprio dos CST 00/10/20/70/90) e confronta com o **crédito** das entradas (motor) + saldo credor anterior → **ICMS a recolher** ou **saldo credor transportado** (regra do registro **E110** da EFD; ST/DIFAL/FCP ficam fora do confronto). As saídas vêm de import de XML/SPED (o app não emite).
- **Simples Nacional — `POST /apuracao/simples-das`:** não é débito-crédito; calcula o **DAS** pela alíquota efetiva `(RBT12×alíq−PD)/RBT12`, com **Fator R** (folha ≥ 28% → Anexo III, senão V) e os anexos I–V de 2026 (LC 123/2006, art. 18).

`emit/CRT` no XML roteia o regime (1/2=Simples, 3=Normal). Detalhe verificado em [docs/apuracao-multiregime.md](docs/apuracao-multiregime.md).

**Etapa 12** adicionou **IPI** (confronto débito-crédito), **PIS/COFINS** (débito das saídas, roteado por regime cumulativo×não-cumulativo) e **ISS** (cumulativo). Detalhe em [docs/apuracao-ipi-piscofins-iss.md](docs/apuracao-ipi-piscofins-iss.md). Ressalva do ISS: ele vem de **NFS-e** (documento municipal/padrão nacional), não de NF-e — o `apurarIss` recebe as NFS-e já parseadas; a **captura/parser de NFS-e** é uma sub-etapa a fazer. Em construção: apuração CBS/IBS (E13) e conferência fiscal (E14).

## Dual-regime CBS/IBS — delta de oportunidade (Etapa 9)

`POST /reforma/comparar` parseia uma NF-e de entrada e, sobre a **mesma nota**, calcula o crédito **legado** (ICMS/PIS/COFINS) e o **novo** (CBS/IBS, crédito financeiro amplo — LC 214/2025 **art. 47**; vedação a uso/consumo pessoal **art. 57**), devolvendo **três números sempre rotulados**:

1. **Crédito efetivo 2026** — alíquota-teste (CBS 0,9% / IBS 0,1%), simbólico.
2. **Crédito novo potencial** — projeção sob a **alíquota de referência cheia** (~26,5%, parametrizável: `APURAX_ALIQ_REF_*`).
3. **Delta de oportunidade** = potencial − legado, com `% de ganho`.

O delta é positivo onde o regime atual **perde** crédito: empresa do **Lucro Presumido** (não credita PIS/COFINS), itens de **uso/consumo** (não creditam ICMS hoje), e **Simples** (crédito 100% novo). Funciona até em **nota legada pura** (sem o grupo `IBSCBS`), projetando o potencial sobre o valor do item. Detalhe verificado em [docs/cbs-ibs-dual-regime.md](docs/cbs-ibs-dual-regime.md).

> Em 2026 a NF-e tem **dupla conformidade** (grupos legados + `IBSCBS` no mesmo XML); a obrigatoriedade (rejeição) para regime normal começa em **03/08/2026** (NT 2025.002 v1.40) — ausência do grupo não é erro.

## Distribuição DFe + custódia de A1 (Etapa 8)

Captura automática de NF-e/CT-e de entrada na SEFAZ (Ambiente Nacional), com o certificado A1 do cliente.

- **Custódia (`dfe/crypto-envelope`):** o `.pfx` e a senha são cifrados com uma **DEK por certificado (AES-256-GCM)**; a DEK é embrulhada pela master key (KMS em prod; `APURAX_KMS_MASTER_KEY` em dev). **Nada em claro** no banco; o material só é descriptografado em memória do worker e zerado após o uso. Cada uso é auditado.
- **Varredura (`dfe/distribuicao`):** NF-e e CT-e têm **cursores de NSU independentes**. A máquina de estados respeita `cStat` (138 encadeia lotes → avança NSU; 137 → cooldown 1h; **656 consumo indevido → bloqueio**), com **um worker por interessado** (a SEFAZ pune consulta concorrente/fora de sequência). Cada `docZip` é `base64→gunzip`, roteado pelo prefixo do schema; NF-e/CT-e completas alimentam a ingestão existente.
- **Manifestação (`dfe/manifestacao`):** a DFe entrega só o **resumo** das notas de terceiros; o **XML completo** vem após manifestar **210210 (Ciência da Operação)** — ato fiscal que exige consentimento.

> **Pré-deploy (ver [docs/dfe-protocolo-custodia.md](docs/dfe-protocolo-custodia.md)):** o transporte SOAP/mTLS e a assinatura XML-DSig da manifestação são esqueletos validados por tipo, mas **não exercitados contra a SEFAZ** (exigem certificado + rede). Confirmar em homologação: `versao` do `distDFeInt`, URLs, algoritmo de assinatura (SHA1/SHA256), e migrar a master key para KMS real.

## Crédito de ICMS sobre CT-e (frete)

`POST /fiscal/cte` faz o parser do CT-e modelo 57 (`docs/cte-layout-credito.md`), resolve o **tomador** (`toma3`/`toma4`) e calcula o crédito de ICMS do frete pelo motor (`MotorCreditoService.avaliarCreditoCte`). Regra (CF art. 155 §2º I; LC 87/96 arts. 19-20; LC 123/06 art. 23):

- Credita o **`vICMS` destacado** quando: a empresa é a **tomadora**, regime **normal** (Simples não credita) e há destaque (**ICMS00/20/90**).
- Não credita: tomador ≠ empresa (provável CIF — A2), Simples (A1), CST 40/41/51 isento/NT/diferido (A4), ICMS-ST CST 60 (A8), ICMSSN transportadora do Simples (A5), ICMSOutraUF (A9).
- Todo crédito sugerido carrega o alerta **A0** (confirmar vínculo do frete com operação tributada) — pendência para a homologação humana.

O CT-e vira `DocumentoFiscal` modelo 57 e sua apuração de ICMS aparece em `/apuracoes`, com o mesmo ciclo SUGERIDO → HOMOLOGADO.

## Camada de IA (Etapa 7) — onde a IA entra (e onde NÃO entra)

**Princípio:** a IA nunca emite o número do imposto. Modelos Claude via Anthropic API:

- `POST /ia/classificar-item` — `claude-haiku-4-5` valida coerência de NCM/CFOP/CST em massa, com **saída estruturada forçada** (strict tool use). Retorna `origemIA: true` + `confianca` — sugestão revisável, não cálculo.
- `POST /ia/perguntar` — `claude-opus-4-8` com **tool-use** (adaptive thinking + effort high): o agente chama `apurar_credito_item` (→ motor determinístico, de onde vem o número) e `buscar_base_legal` (→ RAG sobre LC 87/96, Leis 10.637/10.833, IN 2.121/2022, Tema 779, EC 132/2023), e então explica citando a fonte.

Guardrail testado: os valores em `valoresMotor` vêm sempre do motor (`proveniencia: engine`); o texto do LLM é explicação para homologação humana. Defina `ANTHROPIC_API_KEY` no `.env`.

## Próximas etapas / pendências

Validar transporte SOAP/mTLS da DFe + assinatura XML-DSig da manifestação em homologação · KMS real para a master key · persistir CBS/IBS no `ItemDocumento` e a apuração dual-regime por competência · confirmar contra o XSD oficial os campos `IBSCBS` (NT 2025.002 v1.40+), tabelas CST/cClassTrib e a alíquota de referência · migração de saldo PIS/COFINS→CBS (arts. 378-383) na apuração mensal · RAG com pgvector.
