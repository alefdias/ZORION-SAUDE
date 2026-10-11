# PROCEDIMENTO OPERACIONAL PADRÃO (POP)

| **HOSPITAL / SERVIÇO DE SAÚDE** | **FARMÁCIA SATÉLITE** | **ZORION SAÚDE** |
| :--- | :--- | :--- |
| **Código:** POP-SAT-001 | **Versão:** 02/2026 | **Data de Emissão:** 11/10/2026 |
| **Título:** Pedidos de Reabastecimento e Aceite em Lote de Transferências da Central | **Próxima Revisão:** 11/10/2027 | **Página:** 1 de 3 |

---

### 1. OBJETIVO
Padronizar a rotina de solicitação de reabastecimento à Farmácia Central, conferência física na recepção e efetivação do **aceite de transferência em lote (seleção múltipla)** no sistema **ZORION SAÚDE**, assegurando a segregação estrita entre os estoques da Central e da Satélite com creditação atômica e imediata no saldo local (`estoque_satelite`).

---

### 2. CAMPO DE APLICAÇÃO
Aplica-se a todos os farmacêuticos, técnicos de farmácia e assistentes que atuam na recepção de mercadorias das Farmácias Satélites hospitalares.

---

### 3. DIRETRIZES TÉCNICAS E ISOLAMENTO DE ESTOQUE
1. **Princípio do Isolamento Rígido:** A Farmácia Satélite opera com estoque próprio segregado. Medicamentos armazenados na Farmácia Central não podem ser movimentados ou dispensados na Satélite sem prévia transferência e aceite sistêmico formal.
2. **Transferência em Trânsito:** Enquanto a carga estiver em deslocamento físico, seu status sistêmico é `EM TRÂNSITO`. Neste intervalo, o saldo já foi debitado da Central, mas ainda **não** integra o saldo da Satélite até a confirmação do aceite.

---

### 4. PROCEDIMENTO NO SISTEMA ZORION SAÚDE

#### 4.1. Emissão do Pedido de Reabastecimento:
1. No menu do sistema, acesse **"Farmácia Satélite"** > **"Movimentações"** (ou **"Transferências"**).
2. Para pedidos diários regulares:
   - Acesse a aba **"Pedidos à Central (Cálculo Automático)"**;
   - O algoritmo do Zorion Saúde calcula a média de consumo recente (24h a 48h) por leito e gera a sugestão de ressuprimento;
   - Avalie os quantitativos e clique em **"Enviar Pedido à Central"**.
3. Para pedidos de urgência ou avulsos:
   - Acesse a aba **"Pedidos Avulsos / Urgência"**;
   - Selecione o medicamento, lote preferencial (se aplicável), quantidade e justificativa clínica;
   - Envie à Central.

#### 4.2. Recepção Física da Carga:
1. Receba a caixa de transporte identificada e lacrada vinda do almoxarifado central.
2. Verifique a integridade do lacre, ausência de avarias e violações.
3. Para itens termolábeis (2°C a 8°C): faça a leitura imediata do termômetro de máxima e mínima da caixa isotérmica antes de descarregar.
4. Descarregue os itens na bancada de conferência acompanhados do Romaneio de Transferência.

#### 4.3. Conferência e Aceite em Lote (Individual ou Coletivo):
1. No Zorion Saúde, abra o modal **"Aceitar Transferência"** (`TransferenciaAcceptModal`).
2. O sistema lista todas as remessas e itens pendentes com status `EM TRÂNSITO`.
3. **Conferência Física x Tela:** Confira item por item:
   - Descrição e apresentação do medicamento (ampola, comprimido, frasco, etc.);
   - Número do Lote e Data de Validade;
   - Quantidade física recebida versus quantidade transferida.
4. **Operação de Aceite em Lote:**
   - **Opção A (Aceite Integral Rápido):** Clique na caixa de seleção mestre **"Selecionar Todos"** no topo da listagem de itens pendentes;
   - **Opção B (Aceite Parcial / Selecionado):** Marque individualmente a caixa de seleção de cada item físico conferido e aprovado;
   - O sistema atualiza o botão de ação indicando a quantidade de itens marcados: **"Aceitar Selecionados (N itens)"**.
5. Clique no botão de confirmação de aceite. O Zorion Saúde executa a liquidação atômica e sequencial de cada item:
   - O status da transferência é atualizado para `RECEBIDO`;
   - O saldo do lote é creditado **exclusivamente** no saldo local da Satélite (`estoque_satelite`);
   - Os itens tornam-se imediatamente disponíveis no formulário de Saídas e Dispensação para os leitos.

---

### 5. TRATATIVAS DE DIVERGÊNCIAS E AVARIAS
* **Quantidade Física Inferior à Sistêmica:** Desmarque o item divergente do aceite em lote. Comunique imediatamente a Central para emissão de complemento ou cancelamento/estorno do item faltante.
* **Medicamento Quebrado / Avariado no Transporte:** Não realizar o aceite. Fotografar a embalagem avariada, registrar a recusa do item no sistema e notificar o Responsável Técnico da Central para baixa contábil por avaria de transporte.
* **Lote Físico Diferente do Registrado:** Não aceitar o item com divergência de lote. Solicitar ajuste cadastral à Central antes de incorporar ao estoque da Satélite para manter a rastreabilidade FEFO.

---

### 6. HISTÓRICO DE REVISÕES
| Versão | Data | Descrição da Alteração | Responsável |
| :---: | :---: | :--- | :--- |
| **01** | 11/10/2026 | Emissão inicial do procedimento de transferência e pedidos. | Farmácia Satélite |
| **02** | 11/10/2026 | **Atualização Geral (v3.2.10):** Implementação do fluxo de aceite em lote com funcionalidade "Selecionar Todos" e "Aceitar Selecionados"; formalização do isolamento estrito entre estoque Central e Satélite. | Farmácia Satélite / RT |
