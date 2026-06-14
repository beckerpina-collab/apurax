/** XMLs de exemplo (fictícios) p/ testar a geração de DANFE/DACTE. */

export const NFE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35260211111111000111550010000000011000000017" versao="4.00">
      <ide>
        <cUF>35</cUF><natOp>VENDA DE MERCADORIA</natOp><mod>55</mod><serie>1</serie><nNF>1</nNF>
        <dhEmi>2026-02-03T10:15:00-03:00</dhEmi><dhSaiEnt>2026-02-03T11:00:00-03:00</dhSaiEnt>
        <tpNF>1</tpNF><tpAmb>1</tpAmb>
      </ide>
      <emit>
        <CNPJ>33444555000166</CNPJ><xNome>Aço Forte Distribuidora Ltda</xNome><xFant>Aço Forte</xFant>
        <enderEmit><xLgr>Rua das Indústrias</xLgr><nro>1000</nro><xBairro>Distrito Industrial</xBairro>
          <xMun>São Paulo</xMun><UF>SP</UF><CEP>01000000</CEP><fone>1133334444</fone></enderEmit>
        <IE>110042490114</IE><CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>11111111000111</CNPJ><xNome>Comércio Lucro Real Ltda</xNome>
        <enderDest><xLgr>Av. Central</xLgr><nro>50</nro><xBairro>Centro</xBairro>
          <xMun>Campinas</xMun><UF>SP</UF><CEP>13000000</CEP><fone>1932221111</fone></enderDest>
        <IE>244556677</IE>
      </dest>
      <det nItem="1">
        <prod><cProd>A100</cProd><xProd>Chapa de aço carbono 2mm laminada a frio para estamparia</xProd>
          <NCM>72091500</NCM><CFOP>5102</CFOP><uCom>KG</uCom><qCom>500.0000</qCom>
          <vUnCom>20.0000000000</vUnCom><vProd>10000.00</vProd></prod>
        <imposto>
          <ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>10000.00</vBC><pICMS>12.00</pICMS><vICMS>1200.00</vICMS></ICMS00></ICMS>
          <PIS><PISAliq><CST>01</CST><vBC>10000.00</vBC><pPIS>1.65</pPIS><vPIS>165.00</vPIS></PISAliq></PIS>
          <COFINS><COFINSAliq><CST>01</CST><vBC>10000.00</vBC><pCOFINS>7.60</pCOFINS><vCOFINS>760.00</vCOFINS></COFINSAliq></COFINS>
        </imposto>
      </det>
      <det nItem="2">
        <prod><cProd>B200</cProd><xProd>Parafuso sextavado M8 zincado (caixa com 100 unidades)</xProd>
          <NCM>73181500</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>200.0000</qCom>
          <vUnCom>12.5000000000</vUnCom><vProd>2500.00</vProd></prod>
        <imposto>
          <ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>2500.00</vBC><pICMS>12.00</pICMS><vICMS>300.00</vICMS></ICMS00></ICMS>
        </imposto>
      </det>
      <total><ICMSTot>
        <vBC>12500.00</vBC><vICMS>1500.00</vICMS><vBCST>0.00</vBCST><vST>0.00</vST>
        <vProd>12500.00</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc>
        <vIPI>0.00</vIPI><vPIS>165.00</vPIS><vCOFINS>760.00</vCOFINS><vOutro>0.00</vOutro>
        <vNF>12500.00</vNF><vTotTrib>2625.00</vTotTrib>
      </ICMSTot></total>
      <transp><modFrete>1</modFrete>
        <transporta><CNPJ>44555666000177</CNPJ><xNome>TransLog Fretes SA</xNome><IE>111222333</IE>
          <xEnder>Rod. Anhanguera km 90</xEnder><xMun>Jundiaí</xMun><UF>SP</UF></transporta>
        <veicTransp><placa>ABC1D23</placa><UF>SP</UF></veicTransp>
        <vol><qVol>10</qVol><esp>VOLUMES</esp><pesoL>520.000</pesoL><pesoB>540.000</pesoB></vol>
      </transp>
      <cobr><dup><nDup>001</nDup><dVenc>2026-03-05</dVenc><vDup>12500.00</vDup></dup></cobr>
      <infAdic><infCpl>Documento emitido por contribuinte do Regime Normal. Mercadoria destinada a industrialização. Pedido nº 4521.</infCpl></infAdic>
    </infNFe>
  </NFe>
  <protNFe><infProt><nProt>135260000000017</nProt><dhRecbto>2026-02-03T10:16:30-03:00</dhRecbto></infProt></protNFe>
</nfeProc>`;

export const CTE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cteProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte">
  <CTe>
    <infCte Id="CTe35260222333444000155570010000000051000000098" versao="4.00">
      <ide>
        <cUF>35</cUF><CFOP>6352</CFOP><natOp>PRESTACAO DE SERVICO DE TRANSPORTE</natOp>
        <mod>57</mod><serie>1</serie><nCT>5</nCT><dhEmi>2026-02-05T14:00:00-03:00</dhEmi>
        <tpCTe>0</tpCTe><tpServ>0</tpServ><modal>01</modal><tpAmb>1</tpAmb>
        <xMunIni>São Paulo</xMunIni><UFIni>SP</UFIni><xMunFim>Campinas</xMunFim><UFFim>SP</UFFim>
        <toma3><toma>3</toma></toma3>
      </ide>
      <emit><CNPJ>22333444000155</CNPJ><IE>555666777</IE><xNome>TransLog Fretes SA</xNome><IM>0</IM>
        <enderEmit><xLgr>Rod. Anhanguera</xLgr><nro>90</nro><xMun>Jundiaí</xMun><UF>SP</UF><CEP>13200000</CEP></enderEmit></emit>
      <rem><CNPJ>33444555000166</CNPJ><IE>110042490114</IE><xNome>Aço Forte Distribuidora Ltda</xNome>
        <enderReme><xLgr>Rua das Indústrias</xLgr><nro>1000</nro><xMun>São Paulo</xMun><UF>SP</UF><CEP>01000000</CEP></enderReme></rem>
      <dest><CNPJ>11111111000111</CNPJ><IE>244556677</IE><xNome>Comércio Lucro Real Ltda</xNome>
        <enderDest><xLgr>Av. Central</xLgr><nro>50</nro><xMun>Campinas</xMun><UF>SP</UF><CEP>13000000</CEP></enderDest></dest>
      <vPrest><vTPrest>1800.00</vTPrest><vRec>1800.00</vRec>
        <Comp><xNome>FRETE PESO</xNome><vComp>1500.00</vComp></Comp>
        <Comp><xNome>PEDÁGIO</xNome><vComp>300.00</vComp></Comp>
      </vPrest>
      <imp><ICMS><ICMS00><CST>00</CST><vBC>1800.00</vBC><pICMS>12.00</pICMS><vICMS>216.00</vICMS></ICMS00></ICMS></imp>
      <infCTeNorm>
        <infCarga><vCarga>12500.00</vCarga><proPred>PRODUTOS SIDERURGICOS</proPred></infCarga>
        <infDoc><infNFe><chave>35260211111111000111550010000000011000000017</chave></infNFe></infDoc>
      </infCTeNorm>
      <compl><xObs>Entrega em horário comercial. Agendar com o recebimento.</xObs></compl>
    </infCte>
  </CTe>
  <protCTe><infProt><nProt>135260000000098</nProt><dhRecbto>2026-02-05T14:01:10-03:00</dhRecbto></infProt></protCTe>
</cteProc>`;
