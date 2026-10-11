# PROCEDIMENTO OPERACIONAL PADRÃO (POP)

| **HOSPITAL / SERVIÇO DE SAÚDE** | **FARMÁCIA SATÉLITE** | **ZORION SAÚDE** |
| :--- | :--- | :--- |
| **Código:** POP-SAT-001 | **Versão:** 01/2026 | **Data de Emissão:** 11/10/2026 |
| **Título:** Pedidos de Reabastecimento e Aceite de Carga da Central | **Próxima Revisão:** 11/10/2027 | **Página:** 1 de 3 |

---

### 1. OBJETIVO
Padronizar a solicitação periódica de medicamentos à Farmácia Central, a conferência física no recebimento e o aceite sistêmico no sistema **ZORION SAÚDE**, assegurando que os itens sejam incorporados ao estoque da Satélite com rapidez e sem divergências.

---

### 2. CAMPO DE APLICAÇÃO
Aplica-se aos técnicos e farmacêuticos que atuam nas Farmácias Satélites hospitalares.

---

### 3. PROCEDIMENTO NO SISTEMA ZORION SAÚDE

#### 3.1. Emissão de Pedido de Reabastecimento:
1. No menu lateral, acesse **"Farmácia Satélite"** > **"Movimentações"**.
2. Para pedidos diários de rotina:
   - Selecione a aba **"Pedidos à Central (Cálculo)"**;
   - O Zorion Saúde calcula automaticamente o consumo recente de 24h a 48h e sugere as quantidades ideais;
   - Revise os quantitativos e clique em **"Enviar Pedido à Central"**.
3. Para pedidos emergenciais:
   - Acesse a aba **"Pedidos Avulsos / Urgência"**;
   - Selecione o medicamento específico e digite a quantidade requerida com justificativa clínica;
   - Envie o pedido.

#### 3.2. Chegada da Carga e Conferência Física:
1. Ao receber a caixa de transporte lacrada enviada pela Farmácia Central:
   - Verifique a integridade do lacre físico e da caixa;
   - Medicamentos termolábeis devem vir acompanhados de monitoramento térmico;
   - Rompa o lacre e descarregue os itens na bancada de conferência.

#### 3.3. Aceite Sistêmico no Zorion Saúde:
1. Acesse o modal de **"Aceitar Transferência"** (`TransferenciaAcceptModal`).
2. Localize a remessa com status `EM TRÂNSITO`.
3. Confira cada item entregue:
   - Medicamento e Concentração;
   - Número do Lote e Data de Validade;
   - Quantidade física entregue.
4. Estando tudo correto, clique no botão **"Confirmar Recebimento / Aceitar"**:
   - O Zorion Saúde credita automaticamente o item no saldo `estoque_satelite`;
   - O item passa a ficar disponível imediatamente no seletor de Saídas para atendimento aos leitos.

---

### 4. TRATATIVAS DE DIVERGÊNCIAS
* **Itens Faltantes:** Se a Central enviou menos do que o faturado, anote a divergência no campo observação do aceite antes de confirmar, ou contate a Central para emissão de complemento.
* **Medicamento Avariado no Transporte:** Segregar imediatamente, fotografar e recusar o item avariado no sistema.

---

### 5. HISTÓRICO DE REVISÕES
| Versão | Data | Descrição da Alteração | Responsável |
| :---: | :---: | :--- | :--- |
| **01** | 11/10/2026 | Emissão de procedimento de pedidos e aceite na Satélite. | Farmácia Satélite |
