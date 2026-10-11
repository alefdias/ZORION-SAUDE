# PROCEDIMENTO OPERACIONAL PADRÃO (POP)

| **HOSPITAL / SERVIÇO DE SAÚDE** | **FARMÁCIA SATÉLITE** | **ZORION SAÚDE** |
| :--- | :--- | :--- |
| **Código:** POP-SAT-005 | **Versão:** 02/2026 | **Data de Emissão:** 11/10/2026 |
| **Título:** Armário Trancado de Psicotrópicos na Satélite (Portaria 344) | **Próxima Revisão:** 11/10/2027 | **Página:** 1 de 3 |

---

### 1. OBJETIVO
Normatizar a guarda sob chave, manuseio seguro, retenção de prescrições, baixa sistêmica exclusiva no saldo local da Satélite e controle diário de medicamentos sujeitos a controle especial (Portaria SVS/MS nº 344/1998) dentro da Farmácia Satélite através do sistema **ZORION SAÚDE**.

---

### 2. CAMPO DE APLICAÇÃO
Aplica-se exclusivamente ao armário trancado e cofre de psicotrópicos da Farmácia Satélite.

---

### 3. CONDIÇÕES DE GUARDA E ACESSO
1. Os medicamentos da Portaria 344/98 (Morfina, Fentanil, Midazolam, Diazepam, Tramadol, etc.) devem permanecer guardados sob chave no **armário exclusivo de controlados** da Satélite.
2. A chave do armário permanece sob guarda contínua do Farmacêutico do plantão ou técnico formalmente designado.
3. É expressamente proibido deixar o armário aberto ou ampolas desacompanhadas sobre as bancadas.

---

### 4. PROCEDIMENTO DE DISPENSAÇÃO NO ZORION SAÚDE
1. A solicitação deve ser acompanhada da **Prescrição Médica Original** com identificação clara do paciente, leito, dosagem, via, forma farmacêutica (ampola, comprimido), assinatura e carimbo com CRM do médico.
2. No Zorion Saúde, acesse o módulo **"Livro de Registro"** ou **"SatelitePortaria"**.
3. Registre a saída do medicamento com:
   - Nome Completo do Paciente;
   - Número do Prontuário e Leito;
   - Nome e CRM do Médico Prescritor;
   - Lote e Validade com saldo positivo na Satélite (`estoque_satelite`).
4. Efetive a baixa:
   - O Zorion Saúde debita o item e gera a linha oficial no livro digital;
   - Realize a entrega imediata à enfermagem contra assinatura na ficha de controle de psicotrópicos.

#### 4.1. Quebra Acidental ou Ampolas Avariadas:
1. Caso ocorra quebra de ampola na Satélite:
   - Recolher os cacos e o gargalo com o número do lote visível;
   - No Zorion Saúde, registrar no módulo *Livro de Registro* como *Perda por Quebra*;
   - O Farmacêutico e o Enfermeiro supervisor assinam conjuntamente o termo de quebra gerado no sistema.

#### 4.2. Contagem Física em Cada Troca de Turno:
1. Em todas as trocas de plantão, é obrigatória a contagem física 1:1 de todas as ampolas do armário e confronto com o saldo do Zorion Saúde.

---

### 5. HISTÓRICO DE REVISÕES
| Versão | Data | Descrição da Alteração | Responsável |
| :---: | :---: | :--- | :--- |
| **01** | 11/10/2026 | Emissão de procedimento de psicotrópicos na Farmácia Satélite. | Farmácia Satélite |
| **02** | 11/10/2026 | **Atualização Geral (v3.2.10):** Reforço da exigência de baixa em estoque_satelite e especificação da forma farmacêutica na dispensação de controlados. | Farmácia Satélite / RT |
