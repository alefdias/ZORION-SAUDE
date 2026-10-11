# PROCEDIMENTO OPERACIONAL PADRÃO (POP)

| **HOSPITAL / SERVIÇO DE SAÚDE** | **FARMÁCIA CENTRAL** | **ZORION SAÚDE** |
| :--- | :--- | :--- |
| **Código:** POP-CENT-004 | **Versão:** 01/2026 | **Data de Emissão:** 11/10/2026 |
| **Título:** Gestão de Empréstimos entre Hospitais (Concessão e Devolução) | **Próxima Revisão:** 11/10/2027 | **Página:** 1 de 3 |

---

### 1. OBJETIVO
Padronizar as rotinas de concessão (saída por empréstimo) e recebimento (entrada por empréstimo ou devolução) de medicamentos entre hospitais parceiros e redes de saúde no módulo **"Empréstimos"** do sistema **ZORION SAÚDE**, assegurando o controle contábil e a rastreabilidade dos lotes cedidos ou recebidos.

---

### 2. CAMPO DE APLICAÇÃO
Aplica-se à Farmácia Central em suas relações de cooperação inter-hospitalar.

---

### 3. RESPONSABILIDADES
* **Farmacêutico RT:** Avaliar e autorizar formalmente a cessão ou solicitação de empréstimo de medicamentos com hospitais externos.
* **Técnico da Central:** Cadastrar a transação no formulário de empréstimo no Zorion Saúde e colher assinatura no termo impresso.

---

### 4. PROCEDIMENTO NO SISTEMA ZORION SAÚDE

#### 4.1. Concessão de Empréstimo (Ceder Medicamento a Outro Hospital):
1. Acesse o menu lateral **"Empréstimos"** (`/Emprestimos`).
2. Clique no botão **"Novo Empréstimo"**.
3. Selecione o tipo: **"Emprestar (Saída)"**.
4. No campo **Hospital de Destino**, insira o nome completo da instituição solicitante.
5. Selecione o **Medicamento**, o **Lote** físico que será cedido e a **Quantidade**.
6. Informe a **Data do Empréstimo** e o motivo/observação (ex: *Falta emergencial de ampolas no hospital parceiro*).
7. Salve o empréstimo:
   - O sistema abate a quantidade do `estoque_atual` da Central;
   - Registra o saldo devedor na conta daquele hospital na aba de controle de pendências.
8. Imprima o **Termo de Empréstimo Inter-Hospitalar** em duas vias para colher assinatura do portador do outro hospital.

#### 4.2. Quitação / Devolução do Empréstimo:
1. Quando o hospital parceiro devolver os medicamentos:
   - Acesse o módulo **"Empréstimos"**;
   - Localize o registro pendente na lista;
   - Clique em **"Dar Baixa / Devolver"**;
   - Inspecione a carga devolvida: confira se o lote e a validade são compatíveis (ou superiores) aos que foram emprestados;
   - Confirme a devolução no Zorion Saúde: o estoque da Central é estornado e a pendência financeira/física é liquidada.

---

### 5. HISTÓRICO DE REVISÕES
| Versão | Data | Descrição da Alteração | Responsável |
| :---: | :---: | :--- | :--- |
| **01** | 11/10/2026 | Emissão de procedimento de empréstimos hospitalares no Zorion Saúde. | Farmácia Central |
