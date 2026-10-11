# PROCEDIMENTO OPERACIONAL PADRÃO (POP)

| **HOSPITAL / SERVIÇO DE SAÚDE** | **FARMÁCIA CENTRAL** | **ZORION SAÚDE** |
| :--- | :--- | :--- |
| **Código:** POP-CENT-002 | **Versão:** 01/2026 | **Data de Emissão:** 11/10/2026 |
| **Título:** Cadastro de Lotes, Controle de Validades e Regra FEFO | **Próxima Revisão:** 11/10/2027 | **Página:** 1 de 3 |

---

### 1. OBJETIVO
Padronizar a inclusão sistêmica de notas fiscais, o cadastro fidedigno de lotes e datas de validade no módulo **"Entradas"** do sistema **ZORION SAÚDE**, estabelecendo a gestão rigorosa da regra **FEFO** (*First Expire, First Out*).

---

### 2. CAMPO DE APLICAÇÃO
Aplica-se aos técnicos e estoquistas da Farmácia Central responsáveis pela entrada de dados no sistema e guarda física nas prateleiras.

---

### 3. PROCEDIMENTO NO SISTEMA ZORION SAÚDE

#### 3.1. Acesso ao Módulo de Entradas:
1. No Zorion Saúde, clique no menu lateral **"Entradas"** (`/Entradas`).
2. Clique no botão azul superior **"Nova Entrada"**.
3. Preencha os dados do cabeçalho da Nota:
   - **Número da NF-e**;
   - **Fornecedor / Distribuidor**;
   - **Data de Recebimento**.

#### 3.2. Adição dos Medicamentos e Cadastro de Lotes:
1. No campo **Medicamento**, digite o nome comercial, genérico ou código interno.
2. No campo **Número do Lote**, digite o lote exatamente como impresso na embalagem secundária e blíster (respeitando maiúsculas e números).
3. No campo **Data de Validade**, insira a data oficial de vencimento (dia/mês/ano).
4. No campo **Quantidade**, digite a quantidade total fracionada (unidades/ampolas/comprimidos).
5. No campo **Valor Unitário**, insira o custo para formação de preço médio contábil.
6. Clique em **"Adicionar Item"** e repita para todos os produtos da nota fiscal.

#### 3.3. Validação e Conclusão:
1. Confira a somatória final de quantidade e valor exibida no rodapé do Zorion Saúde com o total da Nota Fiscal física.
2. Clique em **"Salvar e Efetivar Entrada"**.
3. O sistema atualiza automaticamente:
   - O saldo global do `estoque_atual` da Farmácia Central;
   - A tabela de lotes vinculados àquele item;
   - O radar de vencimentos nos módulos **"Vencimentos"** e **"Estoque"**.

#### 3.4. Regra FEFO na Prateleira Física:
1. Na hora de guardar os itens nas prateleiras da Farmácia Central:
   - Os novos medicamentos recebidos (geralmente com validade mais longa) devem ser colocados **no fundo / atrás** dos itens que já estavam na prateleira;
   - Os medicamentos com vencimento mais próximo devem permanecer **na frente**;
   - Isso garante que qualquer separador retire fisicamente o lote que vence primeiro.

---

### 4. MONITORAMENTO DE VALIDADES NO SISTEMA
1. Semanalmente, o farmacêutico deve acessar o módulo **"Vencimentos"** (`/Vencimentos`) no Zorion Saúde.
2. O sistema categoriza em abas:
   - **Vencimento Crítico (até 30 dias):** Solicitar troca urgente com fornecedor ou remanejar imediatamente para setores de alto giro;
   - **Alerta Médio (31 a 60 dias):** Monitorar consumo e bloquear novas compras;
   - **Atenção (61 a 90 dias):** Avaliar curva de consumo.

---

### 5. HISTÓRICO DE REVISÕES
| Versão | Data | Descrição da Alteração | Responsável |
| :---: | :---: | :--- | :--- |
| **01** | 11/10/2026 | Emissão de procedimento de lotes e FEFO na Farmácia Central. | Farmácia Central |
