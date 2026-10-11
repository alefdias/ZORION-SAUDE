# PROCEDIMENTO OPERACIONAL PADRÃO (POP)

| **HOSPITAL / SERVIÇO DE SAÚDE** | **FARMÁCIA CENTRAL** | **ZORION SAÚDE** |
| :--- | :--- | :--- |
| **Código:** POP-CENT-003 | **Versão:** 02/2026 | **Data de Emissão:** 11/10/2026 |
| **Título:** Separação e Expedição de Transferências para as Farmácias Satélites | **Próxima Revisão:** 11/10/2027 | **Página:** 1 de 3 |

---

### 1. OBJETIVO
Definir o fluxo de recebimento de pedidos originados pelas Farmácias Satélites, separação física dos medicamentos no almoxarifado central respeitando a regra FEFO, embalagem segura, emissão de romaneio e expedição no sistema **ZORION SAÚDE**, em total consonância com o fluxo de aceite em lote na Satélite.

---

### 2. CAMPO DE APLICAÇÃO
Aplica-se à equipe de conferencistas, separadores e estoquistas da Farmácia Central e Almoxarifado.

---

### 3. DIRETRIZES DE SEGREGAÇÃO E EXPEDIÇÃO
1. **Baixa Imediata na Central:** Ao acionar o comando de expedição no sistema, a quantidade transferida é baixada imediatamente do saldo `estoque_atual` da Farmácia Central, garantindo que o almoxarifado não considere mais esses itens como disponíveis para novos pedidos.
2. **Status "Em Trânsito" e Bloqueio de Dispensação:** O medicamento expedido permanece sob status sistêmico `EM TRÂNSITO` com os números de lote devidamente vinculados. Ele fica indisponível para dispensação aos leitos na Satélite até que a equipe receptora realize a conferência e o aceite em lote no sistema.

---

### 4. PROCEDIMENTO NO SISTEMA ZORION SAÚDE

#### 4.1. Visualização e Triagem dos Pedidos da Satélite:
1. No Zorion Saúde, acesse o menu **"Movimentações"** ou **"Transferências de Estoque"**.
2. O sistema lista os pedidos pendentes emitidos pelas Satélites com indicação de:
   - Satélite Solicitante (ex: *Satélite UTI*, *Satélite Bloco Cirúrgico*, etc.);
   - Tipo de Pedido: *Rotina (Cálculo Automático)* ou *Urgência / Avulso*;
   - Quantidade total de itens solicitados.
3. Abra o pedido clicando em **"Visualizar Pedido"**.

#### 4.2. Separação Física e Conferência:
1. Emita o **Romaneio de Separação** gerado pelo sistema.
2. O romaneio indica detalhadamente:
   - Código, Descrição e Apresentação do Medicamento;
   - Lote prioritário a ser retirado (indicado automaticamente pelo Zorion Saúde com base no vencimento mais próximo da Central — FEFO);
   - Quantidade requerida.
3. Colete os itens nas prateleiras da Central.
4. Faça a conferência de código de barras ou dupla checagem visual:
   - Certifique-se de que o lote físico retirado confere com o lote indicado no romaneio;
   - Caso seja necessário alterar o lote por motivo de avaria física, atualize a seleção do lote na tela antes de expedir.

#### 4.3. Efetivação da Expedição:
1. No Zorion Saúde, clique em **"Expedir Transferência"**:
   - O sistema abate imediatamente a quantidade do `estoque_atual` da Central;
   - O status do pedido passa para `EM TRÂNSITO`;
   - O lote transferido fica registrado para o fluxo de **Aceite em Lote** na Satélite receptora.

#### 4.4. Acondicionamento e Transporte Interno:
1. Acondicione os medicamentos em caixas plásticas de transporte limpas e identificadas com a Satélite de destino.
2. Medicamentos termolábeis devem ser colocados em caixa térmica com gelo reciclável e termômetro digital com alarme.
3. Lacre a caixa física e anexe o Romaneio de Transferência assinado.
4. Encaminhe ao profissional responsável pelo transporte interno hospitalar.

---

### 5. HISTÓRICO DE REVISÕES
| Versão | Data | Descrição da Alteração | Responsável |
| :---: | :---: | :--- | :--- |
| **01** | 11/10/2026 | Emissão inicial do procedimento de expedição para satélites. | Farmácia Central |
| **02** | 11/10/2026 | **Atualização Geral (v3.2.10):** Alinhamento completo com o novo fluxo de aceite em lote da Satélite; reforço do isolamento de saldos durante o trânsito de cargas. | Farmácia Central / RT |
