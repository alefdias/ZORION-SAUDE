# PROCEDIMENTO OPERACIONAL PADRÃO (POP)

| **HOSPITAL / SERVIÇO DE SAÚDE** | **FARMÁCIA SATÉLITE** | **ZORION SAÚDE** |
| :--- | :--- | :--- |
| **Código:** POP-SAT-004 | **Versão:** 02/2026 | **Data de Emissão:** 11/10/2026 |
| **Título:** Devoluções de Alas, Estornos e Recálculo Imediato de Consumo | **Próxima Revisão:** 11/10/2027 | **Página:** 1 de 3 |

---

### 1. OBJETIVO
Definir as diretrizes para inspeção física, reintegração ao estoque local, cancelamento/estorno de dispensações indevidas e recálculo imediato de consumo e mapas no sistema **ZORION SAÚDE**, assegurando a acurácia dos registros de consumo de pacientes e a rastreabilidade sanitária.

---

### 2. CAMPO DE APLICAÇÃO
Aplica-se à equipe técnica e farmacêutica da Farmácia Satélite no guichê de atendimento às enfermarias, postos de enfermagem e centros cirúrgicos.

---

### 3. DIRETRIZES DE ESTORNO E RECÁLCULO EM TEMPO REAL
1. **Recálculo Instantâneo de Mapas e Indicadores:** Sempre que uma dispensação for excluída, cancelada ou estornada (por duplicidade de lançamento, erro de dosagem ou devolução integral), o Zorion Saúde recalcula imediatamente o Mapa Mensal de Dispensação Diária e os índices de consumo médio/sazonal, expurgando valores incorretos e mantendo os saldos fidedignos em tempo real.
2. **Reintegração Restrita ao Estoque Satélite:** Medicamentos devolvidos pela enfermagem à Satélite são creditados exclusivamente no `estoque_satelite` do lote correspondente, não interferindo no estoque da Farmácia Central.

---

### 4. PROCEDIMENTO NO SISTEMA ZORION SAÚDE

#### 4.1. Inspeção Física dos Medicamentos Devolvidos:
1. Receba os medicamentos acompanhados do protocolo de devolução da enfermagem ou solicitação de estorno.
2. Realize a inspeção técnica rigorosa dos critérios de integridade:
   - Embalagem primária (blíster, ampola com anel intacto, frasco-ampola com lacre *flip-off*) totalmente preservada;
   - Número de lote e data de validade perfeitamente legíveis na embalagem;
   - Medicamentos termolábeis devolvidos sem quebra da cadeia de frio (rejeitar itens que ultrapassaram o tempo seguro de bancada);
   - Ausência de sinais de contaminação, umidade ou partículas em suspensão.
3. Itens violados, fracionados inadequadamente ou avariados:
   - **Nunca reintegrar ao estoque;**
   - Segregar na quarentena e efetuar baixa por *Perda / Descarte*.

#### 4.2. Registro Sistêmico de Devolução no Zorion Saúde:
1. Acesse o menu **"Devoluções"** (`/Devolucoes`) ou a aba *Devoluções* na Farmácia Satélite.
2. Clique no botão **"Registrar Devolução"**.
3. Selecione o **Medicamento**, **Lote** e **Quantidade** física aceita.
4. Preencha a **Ala de Origem** e o **Nome do Paciente**.
5. Selecione o **Motivo da Devolução** (ex: *Suspensão da prescrição pelo médico*, *Alta hospitalar*, *Transferência de leito*, *Óbito*).
6. Confirme a operação:
   - O Zorion Saúde estorna imediatamente o item na conta do paciente;
   - O saldo do `estoque_satelite` é incrementado;
   - O lote reintegrado volta a participar da fila de validade FEFO da Satélite.

#### 4.3. Estorno ou Exclusão de Dispensações Registradas com Incorreção:
1. Em casos de erro de digitação de dispensação ou lançamento duplicado no plantão:
   - Acesse o histórico de movimentações da Satélite;
   - Localize o registro específico e clique na opção **"Estornar / Excluir Saída"**;
   - Confirme a operação de estorno com justificativa técnica registrada em sistema;
   - O Zorion Saúde devolve o saldo ao lote da Satélite e atualiza instantaneamente o Mapa Mensal de Dispensação Diária, impedindo a permanência de saldos residuais irreais.

---

### 5. HISTÓRICO DE REVISÕES
| Versão | Data | Descrição da Alteração | Responsável |
| :---: | :---: | :--- | :--- |
| **01** | 11/10/2026 | Emissão inicial do procedimento de devoluções. | Farmácia Satélite |
| **02** | 11/10/2026 | **Atualização Geral (v3.2.10):** Inclusão de regras para estorno de saídas com gatilho de recálculo imediato do Mapa Mensal e indicadores sazonais; reforço da segregação de crédito em estoque_satelite. | Farmácia Satélite / RT |
