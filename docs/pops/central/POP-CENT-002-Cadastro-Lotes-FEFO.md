# PROCEDIMENTO OPERACIONAL PADRÃO (POP)

| **HOSPITAL / SERVIÇO DE SAÚDE** | **FARMÁCIA CENTRAL** | **ZORION SAÚDE** |
| :--- | :--- | :--- |
| **Código:** POP-CENT-002 | **Versão:** 02/2026 | **Data de Emissão:** 11/10/2026 |
| **Título:** Cadastro de Lotes, Formas Farmacêuticas e Regra FEFO | **Próxima Revisão:** 11/10/2027 | **Página:** 1 de 3 |

---

### 1. OBJETIVO
Padronizar a entrada fiscal de medicamentos, o cadastramento detalhado de lotes com validação de **Forma Farmacêutica / Apresentação (Ampola, Comprimido, Frasco, Blíster, Frasco-Ampola)** e datas de validade no módulo **"Entradas"** do sistema **ZORION SAÚDE**, estabelecendo a gestão rigorosa da regra **FEFO** (*First Expire, First Out*) e garantindo a correta alimentação do Mapa de Dispensação Diária.

---

### 2. CAMPO DE APLICAÇÃO
Aplica-se aos estoquistas, conferencistas e farmacêuticos da Farmácia Central e Almoxarifado responsáveis pela entrada de mercadorias no sistema e guarda física.

---

### 3. PROCEDIMENTO NO SISTEMA ZORION SAÚDE

#### 3.1. Acesso ao Módulo de Entradas:
1. No Zorion Saúde, clique no menu lateral **"Entradas"** (`/Entradas`).
2. Clique no botão azul superior **"Nova Entrada"**.
3. Preencha os dados do cabeçalho da Nota:
   - **Número da NF-e**;
   - **Fornecedor / Distribuidor**;
   - **Data de Recebimento**.

#### 3.2. Adição dos Medicamentos, Formas Farmacêuticas e Cadastro de Lotes:
1. No campo **Medicamento**, selecione ou digite o nome comercial, genérico ou princípio ativo.
2. **Forma Farmacêutica / Apresentação:** Certifique-se de que a apresentação farmacêutica esteja corretamente vinculada e preenchida:
   - **Ampola (AMP):** Injetáveis líquidos;
   - **Comprimido (COMP):** Formas orais sólidas;
   - **Frasco (FR):** Xaropes, suspensões ou soluções orais/tópicas;
   - **Blíster (BLIST):** Cartelas de comprimidos/cápsulas;
   - **Frasco-Ampola (FA):** Pós liofilizados ou soluções parenterais;
   - *(A correta especificação da apresentação é indispensável para a categorização visual no Mapa Mensal de Dispensação Diária da Satélite).*
3. No campo **Número do Lote**, digite o lote exatamente como impresso na embalagem primária e secundária.
4. No campo **Data de Validade**, insira a data oficial de vencimento (mês/ano ou dia/mês/ano).
5. No campo **Quantidade**, digite a quantidade total fracionada em unidades dispensáveis.
6. No campo **Valor Unitário**, insira o custo para formação de preço médio contábil.
7. Clique em **"Adicionar Item"** e repita para todos os produtos da nota fiscal.

#### 3.3. Validação e Conclusão:
1. Confira a somatória final de quantidade e valor exibida no rodapé com o espelho da Nota Fiscal física.
2. Clique em **"Salvar e Efetivar Entrada"**.
3. O sistema atualiza automaticamente:
   - O saldo global do `estoque_atual` da Farmácia Central;
   - A tabela de lotes vinculados àquele item com ordenação FEFO;
   - O radar de vencimentos nos módulos **"Vencimentos"** e **"Estoque"**.

#### 3.4. Aplicação da Regra FEFO no Almoxarifado Físico:
1. Na estocagem física nas prateleiras da Central:
   - Os novos medicamentos recebidos (validade mais longa) devem ser posicionados **no fundo / atrás** dos itens já existentes;
   - Os medicamentos com vencimento mais próximo devem permanecer sempre **na frente**;
   - Esta disposição assegura que qualquer separador colete fisicamente o lote apontado prioritariamente pelo sistema na expedição.

---

### 4. MONITORAMENTO PERIÓDICO DE VALIDADES
1. Semanalmente, o farmacêutico deve emitir o relatório no módulo **"Vencimentos"** (`/Vencimentos`):
   - **Vencimento Crítico (até 30 dias):** Avaliar recolhimento, solicitação de troca com o distribuidor ou remanejamento de urgência para setores de altíssimo giro;
   - **Alerta Médio (31 a 60 dias):** Bloqueio de novas compras do mesmo item;
   - **Atenção (61 a 90 dias):** Monitoramento contínuo de curva de consumo.

---

### 5. HISTÓRICO DE REVISÕES
| Versão | Data | Descrição da Alteração | Responsável |
| :---: | :---: | :--- | :--- |
| **01** | 11/10/2026 | Emissão inicial do procedimento de lotes e FEFO na Central. | Farmácia Central |
| **02** | 11/10/2026 | **Atualização Geral (v3.2.10):** Padronização e obrigatoriedade do registro de apresentações farmacêuticas (ampola, comprimido, frasco, etc.) para integração fidedigna ao Mapa Diário de Dispensação e segregação de lotes. | Farmácia Central / RT |
