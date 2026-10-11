# PROCEDIMENTO OPERACIONAL PADRÃO (POP)

| **HOSPITAL / SERVIÇO DE SAÚDE** | **FARMÁCIA SATÉLITE** | **ZORION SAÚDE** |
| :--- | :--- | :--- |
| **Código:** POP-SAT-002 | **Versão:** 02/2026 | **Data de Emissão:** 11/10/2026 |
| **Título:** Dispensação, Baixa a Leitos, Ajuste de Ciclo e Mapa Diário | **Próxima Revisão:** 11/10/2027 | **Página:** 1 de 4 |

---

### 1. OBJETIVO
Padronizar os processos de dispensação de medicamentos por leito/paciente, baixa de estoque exclusivamente a partir do saldo físico da Farmácia Satélite, ajuste de dias de entrega (complemento de ciclo) e emissão do Mapa Mensal de Dispensação Diária no sistema **ZORION SAÚDE**, assegurando a rastreabilidade por forma farmacêutica, prevenção de erros e cumprimento das Boas Práticas de Dispensação (RDC ANVISA nº 44/2009).

---

### 2. CAMPO DE APLICAÇÃO
Aplica-se à equipe de farmacêuticos e técnicos de farmácia atuantes no atendimento a prescrições médicas, dispensação individualizada/por dose unitária e controle de estoque nas Farmácias Satélites.

---

### 3. DIRETRIZES DE SEGURANÇA E ISOLAMENTO DE ESTOQUE
1. **Isolamento Rígido de Estoque Satélite x Central:** É terminantemente vedada a baixa na Satélite utilizando saldo pertencente à Farmácia Central. O sistema ZORION SAÚDE bloqueia automaticamente qualquer lote cujo saldo na Satélite seja zero (`saldo_satelite <= 0`), mesmo que haja estoque volumoso na Central.
2. **Exibição do Saldo do Lote em Tempo Real:** No momento da seleção do lote para dispensação, o sistema exibe de forma clara e visível o quantitativo disponível na Satélite (ex.: `LOTE-1234 (Disp: 15 un)`), impedindo que o dispensador lance quantitativos superiores ao saldo físico existente.
3. **Obrigatoriedade de Identificação do Paciente e Ala:** Toda dispensação de dose individualizada aos leitos exige a seleção obrigatória da **Ala Hospitalar** e do **Nome do Paciente**. Movimentações sem paciente identificado são classificadas como transferências ou perdas internas e não integram o Mapa Diário Assistencial.

---

### 4. PROCEDIMENTO NO SISTEMA ZORION SAÚDE

#### 4.1. Localização e Seleção de Medicamentos Disponíveis:
1. No Zorion Saúde, acesse **"Farmácia Satélite"** > aba **"Saídas"** (ou o módulo **"Saídas"**).
2. O sistema filtra automaticamente a listagem de medicamentos ativos com saldo positivo em `estoque_satelite`.
3. Clique em **"Dar Saída"** na linha do item ou acione o botão superior **"Nova Saída"**.

#### 4.2. Preenchimento da Saída e Regra FEFO:
1. **Medicamento:** Selecione o medicamento prescrito.
2. **Seleção de Lote:** O sistema ordena e prioriza os lotes pela regra **FEFO** (*First Expire, First Out*).
   - O seletor exibe apenas os lotes que possuem saldo real na Satélite;
   - Ao lado do lote, verifique o indicador visual de saldo: `Disp: [Qtd] un`. Lotes da Central com saldo zerado na Satélite são ocultados para prevenir erros operacionais.
3. **Quantidade:** Informe a dose unitária / quantidade solicitada. O sistema valida se a quantidade digitada excede o saldo do lote selecionado, emitindo bloqueio se ultrapassado.
4. **Ala / Setor:** Selecione a ala clínica de internação (ex: *UTI Geral*, *Clínica Médica*, *Centro Cirúrgico*, etc.).
5. **Paciente e Leito:** Digite ou selecione o nome do paciente cadastrado e seu leito correspondente.
6. Clique em **"Adicionar Item"** e finalize clicando em **"Salvar Saída"**:
   - O Zorion Saúde debita o lote específico em `estoque_satelite`;
   - O registro alimenta instantaneamente o histórico assistencial e o mapa de consumo diário.

#### 4.3. Ajuste de Dias de Entrega (Complemento de Ciclo de Tratamento):
1. Quando houver alteração de prescrição médica ou necessidade de complemento de dias no ciclo de entrega aos leitos, acesse a funcionalidade **"Ajustar Dias de Entrega"** (`AjusteDiasEntregaModal`).
2. **Filtro Estrito por Data do Dia Corrente:**
   - O sistema filtra exclusivamente as prescrições médicas que tiveram entrada ou alteração **na data do dia corrente** (exemplo: receitas registradas no dia do plantão);
   - Se o medicamento não teve alteração ou prescrição lançada na data de hoje, ele não é listado no ajuste, prevenindo alterações indevidas em prescrições passadas consolidadas.
3. **Seleção Fluida de Itens:**
   - Utilize as caixas de seleção (checkboxes) para marcar um ou mais medicamentos que requerem complementação ou ajuste de dias de entrega.
4. **Trava Inteligente de Duração do Tratamento:**
   - O sistema respeita a duração máxima prescrita pelo médico. Exemplo: se um medicamento foi prescrito para tratamento com duração de **5 dias**, o sistema trava a entrega no 5º dia, não permitindo entrega superior a 5 dias, ainda que o ciclo restante do leito seja superior.
5. Confirme o ajuste para gerar a programação precisa de dispensação complementar.

#### 4.4. Emissão e Conferência do Mapa Mensal de Dispensação Diária:
1. No menu principal ou no módulo de relatórios da Satélite, acesse o **"Mapa Mensal de Dispensação Diária"** (`MapaMensalDispensacao`).
2. **Filtro de Período e Ala:** Selecione o mês/ano de apuração e a Ala de internação desejada.
3. **Contabilização Exclusivamente Assistencial:**
   - O mapa compila unicamente as dispensações efetivadas com vínculo de paciente e ala;
   - Movimentações operacionais internas da farmácia são devidamente segregadas, garantindo que o mapa reflita com exatidão o consumo farmacoterapêutico por leito.
4. **Identificação da Forma Farmacêutica / Apresentação:**
   - O mapa categoriza e exibe visualmente a forma farmacêutica de cada item dispensado: **Ampola (AMP)**, **Comprimido (COMP)**, **Frasco (FR)**, **Blister (BLIST)**, **Frasco-Ampola (FA)**, **Gotas**, etc.;
   - Esta identificação visual previne confusões entre apresentações de mesma dosagem (ex: injetável versus oral).
5. **Impressão e Exportação ABNT:**
   - **Exportar CSV:** Gera arquivo estruturado com paciente, medicamento, apresentação, ala e quantitativos diários de 1 a 31;
   - **Impressão A4:** Layout otimizado em paisagem (Landscape) para visualização clara de todos os dias do mês, sem blocos desnecessários de assinaturas manuais em rodapé, assegurando conformidade com prontuários eletrônicos auditáveis.

---

### 5. SEPARAÇÃO FÍSICA E DUPLA CHECAGEM
1. Na bancada de dispensação, separe os medicamentos conforme a prescrição médica eletrônica.
2. Realize a dupla checagem dos **5 Certos**:
   - **Paciente Certo:** Conferência da pulseira de identificação e leito;
   - **Medicamento Certo:** Conferência da denominação genérica e apresentação visual;
   - **Dose Certa:** Cálculo de dose e concentração;
   - **Via de Administração Certa:** Oral, endovenosa, intramuscular, etc.;
   - **Horário Certo:** Aprazamento prescrito pela enfermagem.
3. Embale os itens em saco individual selado com etiqueta de identificação do paciente e entregue ao profissional de enfermagem mediante conferência mútua.

---

### 6. HISTÓRICO DE REVISÕES
| Versão | Data | Descrição da Alteração | Responsável |
| :---: | :---: | :--- | :--- |
| **01** | 11/10/2026 | Emissão de procedimento de dispensação e saída na Satélite. | Farmácia Satélite |
| **02** | 11/10/2026 | **Atualização Geral (v3.2.10):** Isolamento total contra estoque da Central (ocultação de lotes zerados na Satélite e exibição de saldo por lote); obrigatoriedade de paciente/ala para o Mapa Diário; especificação obrigatória da forma farmacêutica (ampola, comprimido, frasco); atualização do Ajuste de Dias de Entrega com filtro na data do dia corrente e trava de duração máxima do tratamento; otimização da impressão A4 do Mapa. | Farmácia Satélite / RT |
