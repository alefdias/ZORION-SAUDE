# PROCEDIMENTO OPERACIONAL PADRÃO (POP)

| **HOSPITAL / SERVIÇO DE SAÚDE** | **FARMÁCIA SATÉLITE** | **ZORION SAÚDE** |
| :--- | :--- | :--- |
| **Código:** POP-SAT-004 | **Versão:** 01/2026 | **Data de Emissão:** 11/10/2026 |
| **Título:** Recebimento de Devoluções de Enfermagem e Estornos | **Próxima Revisão:** 11/10/2027 | **Página:** 1 de 3 |

---

### 1. OBJETIVO
Definir as diretrizes para inspeção física e reintegração sistêmica de medicamentos devolvidos pelas enfermarias/alas hospitalares no módulo **"Devoluções"** do sistema **ZORION SAÚDE**, evitando desperdícios e estornando cobranças indevidas.

---

### 2. CAMPO DE APLICAÇÃO
Aplica-se aos técnicos e farmacêuticos da Farmácia Satélite no guichê de atendimento às alas.

---

### 3. PROCEDIMENTO NO SISTEMA ZORION SAÚDE

#### 3.1. Inspeção Física dos Medicamentos Devolvidos:
1. Receber os medicamentos acompanhados do protocolo de devolução da enfermagem.
2. Conferir os critérios de aceite:
   - Embalagem primária (blíster, ampola, frasco) perfeitamente íntegra e sem perfurações;
   - Número do Lote e Data de Validade nítidos e legíveis;
   - Ausência de sinais de umidade ou calor.
3. Se o item estiver avariado, violado ou sem lote visível:
   - **Não reintegrar ao estoque;**
   - Registrar no sistema como *Perda / Descarte*.

#### 3.2. Registro Sistêmico no Zorion Saúde:
1. Acesse o menu **"Devoluções"** (`/Devolucoes`) ou a aba *Devoluções* na Farmácia Satélite.
2. Clique no botão **"Registrar Devolução"**.
3. Selecione o **Medicamento**, **Lote** e **Quantidade** física aceita.
4. Informe a **Ala de Origem** e o **Nome do Paciente**.
5. Selecione o **Motivo da Devolução:** (ex: *Suspensão da prescrição pelo médico*, *Alta hospitalar*, *Transferência de leito*, *Óbito*).
6. Confirme a operação:
   - O Zorion Saúde estorna imediatamente o item na conta do paciente;
   - O saldo do `estoque_satelite` é incrementado;
   - O lote reintegrado volta a participar da fila de validade FEFO.

---

### 4. HISTÓRICO DE REVISÕES
| Versão | Data | Descrição da Alteração | Responsável |
| :---: | :---: | :--- | :--- |
| **01** | 11/10/2026 | Emissão de procedimento de devoluções na Satélite. | Farmácia Satélite |
