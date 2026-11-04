# 🏥 ESPECIFICAÇÃO COMPLETA DE RECONSTRUÇÃO DO SISTEMA
## ZORION SAÚDE / AXION ERP HOSPITALAR (v3.2.x)
### *Documento Mestre de Arquitetura, Regras de Negócio, Telas, Banco de Dados e Reconstrução do Zero*

---

## 📑 ÍNDICE GERAL

1. [Visão Geral e Propósito do Sistema](#1-visão-geral-e-propósito-do-sistema)
2. [Stack Tecnológico e Arquitetura de Software](#2-stack-tecnológico-e-arquitetura-de-software)
3. [Perfis de Acesso, Permissões e Autenticação](#3-perfis-de-acesso-permissões-e-autenticação)
4. [Estrutura Completa do Banco de Dados (Schema PostgreSQL)](#4-estrutura-completa-do-banco-de-dados-schema-postgresql)
5. [Módulo 1: Farmácia Central & Almoxarifado](#5-módulo-1-farmácia-central--almoxarifado)
6. [Módulo 2: Farmácia Satélite & Postos de Enfermagem](#6-módulo-2-farmácia-satélite--postos-de-enfermagem)
7. [Módulo 3: Prontuário Eletrônico & Gestão Clínica do Paciente](#7-módulo-3-prontuário-eletrônico--gestão-clínica-do-paciente)
8. [Módulo 4: Carrinho de Parada Cardiorrespiratória (PCR)](#8-módulo-4-carrinho-de-parada-cardiorrespiratória-pcr)
9. [Módulo 5: Controle Especial & Portaria 344/98 (Anvisa)](#9-módulo-5-controle-especial--portaria-34498-anvisa)
10. [Módulo 6: Responsável Técnico (RT), Equipes e Auditoria](#10-módulo-6-responsável-técnico-rt-equipes-e-auditoria)
11. [Módulo 7: Módulo de Enfermagem e Checagem Beira-Leito](#11-módulo-7-módulo-de-enfermagem-e-checagem-beira-leito)
12. [Recursos Transversais: Chat Interno, Alertas e Notificações](#12-recursos-transversais-chat-interno-alertas-e-notificações)
13. [Regras de Negócio e Fórmulas Matemáticas Críticas](#13-regras-de-negócio-e-fórmulas-matemáticas-críticas)
14. [Roteiro Passo a Passo para Remontar o Sistema do Zero](#14-roteiro-passo-a-passo-para-remontar-o-sistema-do-zero)

---

## 1. VISÃO GERAL E PROPÓSITO DO SISTEMA

O **ZORION SAÚDE** (também denominado comercialmente **AXION ERP Hospitalar**) é um sistema hospitalar integrado de alta complexidade, projetado prioritariamente para atender às demandas rigorosas de:
- **Hospitais Psiquiátricos e Unidades de Saúde Mental**;
- **Hospitais Gerais, Clínicas de Transição e Unidades de Cuidados Prolongados (UCP)**;
- **Farmácia Hospitalar Central (Almoxarifado Geral)**;
- **Farmácias Satélites (Dispensação em Postos de Enfermagem / Alas)**;
- **Corpo Clínico (Médicos Prescritores com Assinatura Digital)**;
- **Corpo de Enfermagem (Checagem Beira-Leito, Sinais Vitais, SAE)**;
- **Recepção e Portaria (Controle de Visitas com Foto e Admissões)**.

### Conformidade Regulatória Oficial Atendida:
- **ANVISA RDC nº 430/2020** (Boas Práticas de Distribuição, Armazenagem e Transporte de Medicamentos);
- **ANVISA RDC nº 44/2009** (Boas Práticas Farmacêuticas para o Controle Sanitário do Funcionamento e Dispensação);
- **Portaria SVS/MS nº 344/1998** (Regulamento Técnico sobre substâncias e medicamentos sujeitos a controle especial: Listas A1, A2, A3, B1, B2, C1, C2, C3, C4, C5);
- **Resoluções do CRF (Conselho Regional de Farmácia)** para Responsabilidade Técnica e Livros de Registro Específico;
- **Normas COREN/COFEN e CFM** para checagem eletrônica, anotações de enfermagem e prescrição médica.

---

## 2. STACK TECNOLÓGICO E ARQUITETURA DE SOFTWARE

### 2.1 Frontend
- **Linguagem / Framework:** React 18.2 + Vite 6.
- **Roteamento:** `react-router-dom` v7 (HashRouter para garantir portabilidade offline em aplicações desktop Tauri).
- **Estilização:** Tailwind CSS v3 com plugins `tailwindcss-animate`, CSS Variables e suporte a 6 temas dinâmicos (Oceano, Esmeralda, Pôr do Sol, Ametista, Rosa Elegance, Meia-noite).
- **Design System:** Baseado em Radix UI + shadcn/ui (Diálogos, Popovers, Dropdowns, Tabelas, Selects, Accordions, Tabs, Tooltips, Toasts).
- **Gerenciamento de Estado de Dados:** `@tanstack/react-query` v5 com invalidação reativa em tempo real de queries.
- **Relatórios e Impressões:** Geração de PDF no cliente via `jspdf` e `html2canvas`, além de folhas de impressão HTML padronizadas para papel A4 em modo retrato e paisagem.
- **Ícones:** `lucide-react`.
- **Efeitos de Áudio:** Sintetizador sonoro via Web Audio API nativa do navegador (chimes de alerta de admissão e cliques de mensagens de chat, sem necessidade de carregar arquivos MP3 externos).

### 2.2 Desktop Wrapper (Backend Tauri v2)
- **Tecnologia:** Tauri v2 (Rust).
- **Comandos IPC Expostos (em `src-tauri/src/sync.rs`):**
  1. `test_postgres_connection`: Testa a conectividade com o PostgreSQL local ou de rede e executa a migração automática do schema (`001_initial_schema.sql`).
  2. `query_postgres`: Executa consultas SQL assíncronas retornando JSON tipado para o frontend React.
  3. `execute_postgres`: Executa instruções SQL de alteração (`INSERT`, `UPDATE`, `DELETE`, `ALTER TABLE`, `BEGIN...COMMIT`).
  4. `start_db_listener`: Abre uma thread Rust dedicada escutando comandos `LISTEN table_change` e `LISTEN app_update` no PostgreSQL, emitindo eventos Tauri (`db_update`, `nova_admissao`) instantaneamente para a janela React.

### 2.3 Banco de Dados
- **Motor:** PostgreSQL (versão 12 ou superior).
- **Conectividade:** Driver nativo `postgres` em Rust com suporte a conexão direta via IP, porta 5432, banco `postgres` ou específico, e autenticação por senha.
- **Mecanismo de Polling e Sincronização Dupla:**
  - Além dos eventos Tauri LISTEN/NOTIFY, há um polling secundário silencioso a cada 2.500 ms em `pg_stat_user_tables` para detectar alterações físicas no banco caso algum cliente perca um evento de socket.
  - Alerta sonoro imediato no topo de todas as telas ao detectar uma nova admissão na Recepção, permitindo que a farmácia abra o prontuário com 1 clique.

---

## 3. PERFIS DE ACESSO, PERMISSÕES E AUTENTICAÇÃO

O sistema possui uma tela de boas-vindas (`WelcomeScreen.jsx`) que atua como hub inicial, exibindo os 4 módulos principais do hospital em ordem e exigindo autenticação contextual:

| Perfil de Usuário | Módulos Autorizados | Restrições Específicas |
| :--- | :--- | :--- |
| **Administrador** | Todos os módulos | Acesso irrestrito a configurações, banco, trilha de auditoria e exclusões. |
| **Farmacêutico (CRF)** | Farmácia Central, Farmácia Satélite, Portaria 344, Carrinho Parada, RT | Responsável pela emissão de relatórios oficiais, balanço BMPO/BSPO e aceite de cargas. |
| **Auxiliar de Farmácia** | Farmácia Central e Farmácia Satélite | Bloqueado de alterar configurações do banco, cadastros regulatórios e emitir livros do RT. |
| **Médico (CRM)** | Módulo Médico (ZORION-MEDICO) | Se tentar logar na Farmácia pelo Zorion Saúde, o sistema bloqueia e orienta o redirecionamento. |
| **Enfermeiro (COREN)** | Carrinho de Parada (Enfermagem), Pacientes, Checagem Beira-Leito | Permissão para checagem diária do lacre, conferência mensal, anotações e sinais vitais. |
| **Técnico de Enfermagem** | Carrinho de Parada (Enfermagem), Checagem de Medicamentos | Registra administração de dose e conferência do lacre do carrinho. |
| **Recepcionista** | Recepção, Admissão de Pacientes, Controle de Visitas | Cadastra pacientes, leitos e emite crachás de visitantes com foto. |

### Regras de Autenticação:
- Login por **Nome de Usuário** ou número de **COREN/CRF**.
- Suporte a senha mestre de suporte/emergência (`admin123`) para recuperação rápida pela administração hospitalar.
- Forçamento de troca de senha no primeiro acesso (`primeiro_acesso = true`).
- Sessão gravada em `sessionStorage` (`axion_active_user`) e fallback em `localStorage` (`pharma_user`).

---

## 4. ESTRUTURA COMPLETA DO BANCO DE DADOS (SCHEMA POSTGRESQL)

O banco de dados é inicializado automaticamente pelo script `database/001_initial_schema.sql`. Abaixo está a especificação completa de cada tabela:

### 4.1 Tabela `Medicamento`
Catálogo mestre de fármacos e insumos do hospital.
- `id` (TEXT, PK): UUID do medicamento.
- `nome` (TEXT): Denominação genérica ou comercial.
- `codigo` (TEXT): Código interno do produto (ex: `MED-0042`).
- `concentracao` (TEXT): Ex: `500 mg`, `10 mg/mL`, `5 mg`.
- `apresentacao` (TEXT): Normalizada como `COMPRIMIDO`, `AMPOLA 1 ML`, `FRASCO 100 ML`, etc.
- `categoria_id` (TEXT): FK para tabela Categoria.
- `estoque_atual` (INTEGER): Saldo físico disponível na **Farmácia Central**.
- `estoque_minimo` (INTEGER): Ponto de segurança/reposição.
- `estoque_satelite` (INTEGER): Saldo físico total disponível na **Farmácia Satélite**.
- `is_adiantamento` (BOOLEAN): Sinaliza se aceita adiantamento/empréstimo de paciente.
- `is_liquido` (BOOLEAN): Formulações líquidas multidose (gotas, xaropes, suspensões).
- `volume_frasco_ml` (NUMERIC): Volume do frasco (ex: 20 mL para gotas, 100 mL para xaropes).
- `fator_fracionamento` (INTEGER): Divisão de dose unitária.
- `nota_fiscal`, `valor_compra`, `fornecedor_nome` (TEXT).
- `created_at`, `deleted_at` (TIMESTAMPTZ/TEXT): Controle de soft delete.

### 4.2 Tabela `Lote`
Armazena a rastreabilidade individual de cada lote recebido.
- `id` (TEXT, PK): UUID do lote.
- `medicamento_id` (TEXT): FK para Medicamento.
- `numero_lote` (TEXT): Código do lote impresso na caixa/ampola.
- `data_validade` (TEXT, `YYYY-MM-DD`): Data de expiração (essencial para o FEFO).
- `quantidade_inicial` (INTEGER): Quantidade recebida na nota fiscal.
- `quantidade_atual` (INTEGER): Saldo restante na **Farmácia Central**.
- `quantidade_satelite` (INTEGER): Saldo alocado e presente fisicamente na **Farmácia Satélite**.
- `volume_frasco_ml` (NUMERIC): Volume em mL.
- `status` (TEXT): `Ativo`, `Quarentena`, `Vencido`, `Inativo`.
- `created_at`, `deleted_at` (TEXT).

### 4.3 Tabela `Entrada`
Registro de notas fiscais e recebimento físico no almoxarifado.
- `id` (TEXT, PK).
- `medicamento_id`, `medicamento_nome` (TEXT).
- `lote_id`, `numero_lote`, `data_validade` (TEXT).
- `quantidade` (INTEGER).
- `fornecedor_id`, `fornecedor_nome` (TEXT).
- `nota_fiscal`, `numero_nota_fiscal` (TEXT).
- `tipo` (TEXT): `NF Fornecedor`, `Doação`, `Devolução`, `Empréstimo Recebido`.
- `data_entrada`, `created_at`, `deleted_at` (TEXT).

### 4.4 Tabela `Saida`
Histórico de todas as saídas de estoque (dispensações a pacientes, transferências e perdas).
- `id` (TEXT, PK).
- `medicamento_id`, `medicamento_nome` (TEXT).
- `lote_id`, `numero_lote` (TEXT).
- `quantidade` (INTEGER ou NUMERIC).
- `origem` (TEXT): `Farmácia Central`, `Farmácia Satélite`, `Carrinho de Parada`.
- `destino` (TEXT): Nome da Ala, Posto ou Setor.
- `motivo` (TEXT): `Dispensação Paciente`, `Transferência de Estoque`, `Perda/Quebra`, `Avaria`, `Validade`.
- `paciente_id`, `paciente_nome` (TEXT): Vínculo assistencial direto.
- `ala_id`, `ala_nome` (TEXT): Ala hospitalar.
- `prescricao_id` (TEXT): Vínculo com a prescrição do paciente.
- `dias_cobertura` (INTEGER): Quantidade de dias cobertos pela dispensação.
- `data_inicio_cobertura`, `data_fim_cobertura` (TEXT, `YYYY-MM-DD`).
- `dose_diaria` (NUMERIC): Dose diária somada do paciente.
- `is_baixa_lote_paciente` (BOOLEAN): Sinaliza se foi gerada pelo fluxo assistencial de ciclo.
- `responsavel`, `responsavel_crf`, `usuario_nome`, `usuario_id` (TEXT).
- `data_saida`, `created_at`, `deleted_at` (TEXT).

### 4.5 Tabela `Paciente`
Ficha cadastral do internado no hospital.
- `id` (TEXT, PK).
- `nome` (TEXT, NOT NULL).
- `prontuario` (TEXT): Número de prontuário hospitalar.
- `idade` (INTEGER), `data_nascimento` (TEXT).
- `alaId`, `alaNome` (TEXT): Ala onde está internado.
- `leito` (TEXT): Número do leito (ex: `Leito 04`).
- `status` (TEXT): `Ativo`, `Alta`, `Transferido`, `Óbito`.
- `dataAlta` (TEXT): Data/hora da alta.
- `foto` (TEXT, Base64): Foto do paciente capturada por webcam ou arquivo.
- `alergias` (TEXT): Lista textual ou JSON de substâncias alérgenas (ex: `Dipirona, Penicilina`).
- `diagnostico` (TEXT): CID-10 ou descrição clínica.
- `ciclo_coberto_ate` (TEXT, `YYYY-MM-DD`): Data limite até a qual o paciente já tem remédios dispensados.
- `ultimo_ciclo_dias` (INTEGER): Quantos dias foram dispensados na última entrega.
- `observacoes`, `created_at`, `deleted_at` (TEXT).

### 4.6 Tabela `PrescricaoPaciente`
Prescrição médica eletrônica detalhada, contendo aprazamento e regras de dosagem.
- `id` (TEXT, PK).
- `pacienteId`, `pacienteNome`, `prontuario`, `alaNome`, `leito` (TEXT).
- `medicamentoId`, `medicamentoNome`, `medicamentoCodigo`, `apresentacao`, `concentracao` (TEXT).
- `dose08` (TEXT): Quantidade no horário das 08h00 (ex: `1`, `0.5`, `20 gotas`).
- `dose14` (TEXT): Quantidade no horário das 14h00.
- `dose22` (TEXT): Quantidade no horário das 22h00.
- `dose06` (TEXT): Quantidade no horário das 06h00.
- `isMetade08`, `isMetade14`, `isMetade22`, `isMetade06` (BOOLEAN): Indica meio comprimido naquele horário.
- `totalDiario` (NUMERIC): Soma exata de comprimidos ou mL no dia.
- `esquemaPosologico` (TEXT): Resumo descritivo (ex: `1 cp VO 8h - 14h - 22h`).
- `horarios` (TEXT, JSON): Array estruturado de horários adicionais `[{"hora": "08:00", "dose": 1}, ...]`.
- `tipoFrequencia` (TEXT): `diaria` ou `intervalo_dias`.
- `intervaloDias` (INTEGER): Intervalo para doses não diárias (ex: `2` = dia sim/dia não; `7` = semanal; `10` = a cada 10 dias).
- `diasSemana` (TEXT, JSON): Dias específicos `[1, 2, 3, 4, 5]` (Seg a Sex).
- `viaAdministracao` (TEXT): `VO`, `IM`, `EV`, `SL`, `SC`, `Inalatória`, `Tópica`, etc.
- `is_liquido` (BOOLEAN): Verdadeiro se for frasco/gotas.
- `volume_frasco_ml` (NUMERIC): Volume do frasco.
- `duracao_frasco_dias` (INTEGER): Dias estimados de consumo de 1 frasco.
- `data_ultimo_frasco`, `data_proximo_frasco` (TEXT).
- `dataInicio`, `dataFim` (TEXT, `YYYY-MM-DD`).
- `status` (TEXT): `Ativa`, `Suspensa`, `Finalizada`.
- `medico_nome`, `medico_crm` (TEXT): Identificação do médico prescritor.
- `tipo_assinatura` (TEXT): `login_crm` ou `digital_icp`.
- `assinatura_digital_hash`, `assinatura_digital_data` (TEXT): Hash criptográfico da assinatura.
- `historico_alteracoes` (TEXT): Log de modificações na prescrição.
- `created_at`, `deleted_at` (TEXT).

### 4.7 Tabela `Ala`
Enfermarias e setores com trava de capacidade máxima de leitos.
- `id` (TEXT, PK).
- `nome` (TEXT): Nome da Ala (ex: `N1`, `N2`, `R1 M`, `R1 F`, `UCP`, `CL1`, `CL2`, `Casa Meninos`).
- `descricao` (TEXT).
- `responsavel` (TEXT): Enfermeiro ou médico chefe do setor.
- `leitos` (INTEGER): Capacidade máxima oficial de leitos (ex: `N1` = 39, `N2` = 39, `R1 M` = 10, `R1 F` = 15, `UCP` = 10, `CL1` = 10, `CL2` = 10, `Casa Meninos` = 3).
- `created_at`, `deleted_at` (TIMESTAMPTZ).

### 4.8 Tabela `PedidoSatelite`
Pedidos formais enviados pela Farmácia Satélite à Farmácia Central.
- `id` (TEXT, PK).
- `codigo` (TEXT): Identificador visual (ex: `PED-2026-0042`).
- `ala_id`, `ala_nome` (TEXT).
- `dias_calculados` (INTEGER): Número de dias projetados para a cobertura dos pacientes.
- `margem_seguranca` (INTEGER): Percentual de segurança (0%, 10%, 20%, 30%).
- `descontar_estoque` (INTEGER/BOOLEAN): Se abateu ou não o saldo atual da satélite no cálculo.
- `prioridade` (TEXT): `Normal`, `Urgente`, `Emergência`.
- `solicitante` (TEXT): Operador da Satélite.
- `status` (TEXT): `Pendente`, `Em Separação`, `Separado`, `Em Trânsito`, `Recebido`, `Cancelado`.
- `itens_json` (TEXT, JSON): Lista de itens, dosagens, quantidades sugeridas e quantidades enviadas.
- `data_solicitacao`, `data_separacao`, `data_entrega`, `data_recebimento` (TEXT).
- `observacao`, `motivo_cancelamento` (TEXT).

### 4.9 Tabela `TransferenciaPendente`
Mecanismo de trânsito físico entre estoques para garantir isolamento e aceite formal.
- `id` (TEXT, PK).
- `medicamento_id`, `medicamento_nome` (TEXT).
- `lote_id`, `numero_lote` (TEXT).
- `quantidade` (INTEGER).
- `direcao` (TEXT): `para_satelite`, `para_estoque`, `para_carrinho_parada`.
- `status` (TEXT): `Pendente`, `Aceito`, `Recusado`.
- `origem` (TEXT): `avulsa`, `pedido_satelite`.
- `data_solicitacao`, `data_aceite`, `deleted_at` (TEXT).

### 4.10 Tabela `Usuario`
Controle de operadores, corpo clínico e permissões.
- `id` (TEXT, PK).
- `nome`, `login`, `senha` (TEXT).
- `perfil`, `cargo` (TEXT): `Administrador`, `Farmaceutico`, `Auxiliar`, `Medico`, `Enfermeiro`, `Tecnico`.
- `crf`, `crm`, `coren` (TEXT): Registros profissionais de classe.
- `especialidade`, `email`, `telefone` (TEXT).
- `modulos` (TEXT, JSON): Array de chaves de módulos acessíveis.
- `primeiro_acesso` (BOOLEAN DEFAULT true).
- `status_online`, `ultimo_acesso`, `modulo_ativo` (TEXT).
- `certificado_digital_nome`, `certificado_digital_dados` (TEXT).

### 4.11 Tabela `Auditoria`
Trilha de auditoria forense e imutável.
- `id` (TEXT, PK).
- `acao` (TEXT): `Criar`, `Atualizar`, `Excluir`, `Baixa`, `Estorno`, `Login`.
- `entidade` (TEXT): Nome da tabela afetada.
- `entidade_id` (TEXT): ID do registro modificado.
- `detalhes` (TEXT): Payload antes/depois ou justificativa da operação.
- `usuario` (TEXT): Nome do operador que realizou a ação.
- `data_hora`, `created_at` (TEXT).

### 4.12 Tabelas de Apoio Adicionais
- `Fornecedor`: Cadastro com Razão Social, CNPJ, CNAE (`4644-3/01`), Município, UF, Telefone, Contato.
- `Categoria`: Categorias farmacológicas (Analgésicos, Antipsicóticos, Antibióticos, Injetáveis, etc.).
- `Inventario` & `InventarioItem`: Cabeçalho e itens de balanços físicos de estoque com colunas `quantidade_sistema`, `quantidade_fisica`, `divergencia`.
- `Emprestimo`: Empréstimos inter-hospitalares concedidos e recebidos.
- `CarrinhoPadronizacao`, `CarrinhoEstoqueCentral`, `CarrinhoEstoqueFisico`, `CarrinhoMovimentacao`: Gestão de gavetas, lotes e reposições de PCR.
- `Visita`: Controle de visitantes por paciente e leito, tipo de documento (RG/CPF), horários de entrada/saída e foto capturada por webcam.
- `ChatMessage`: Mensagens do chat interno por canais (`farmacia_recepcao`, `geral`, `farmacia_corpo_clinico`) ou privativo 1x1.
- `ProntuarioEvolucao`, `ProntuarioExame`, `ProntuarioAlergia`, `ProntuarioDocumento`: Registros clínicos multidisciplinares do paciente.
- `EnfermagemChecagem`, `EnfermagemSinalVital`, `EnfermagemBalancoHidrico`, `EnfermagemPrescricaoCuidado`: Checagens e cuidados de enfermagem beira-leito.

---

## 5. MÓDULO 1: FARMÁCIA CENTRAL & ALMOXARIFADO

A Farmácia Central gerencia o abastecimento macro do hospital.

### 5.1 Dashboard Central (`Dashboard.jsx`)
- **Cards com Métricas em Tempo Real:** Total de Medicamentos Ativos, Saldo Físico Total de Unidades, Itens com Estoque Baixo (abaixo do mínimo), Lotes Vencendo em 30 dias e Transferências Pendentes de Aceite.
- **Gráficos Dinâmicos:**
  - Curva de consumo dos últimos 30 dias por ala;
  - Comparativo de saídas clínicas vs psicotrópicos;
  - Itens de maior giro (Curva ABC).

### 5.2 Catálogo de Medicamentos (`Medicamentos.jsx`)
- Listagem pesquisável com busca normalizada (desconsidera acentos e pontuações).
- Filtros por Categoria Farmacológica, Grupo Terapêutico e Medicamentos de Alta Vigilância (MAV).
- Formulário de cadastro (`MedicamentoForm.jsx`):
  - Definição da apresentação farmacêutica normalizada (Comprimido, Ampola 1 mL, Frasco 100 mL, etc.);
  - Marcação de Medicamento Líquido com extração automática do volume do frasco;
  - Flag de Portaria 344/98 e Antimicrobiano.

### 5.3 Entrada de Notas Fiscais (`Entradas.jsx`)
- Registro de recebimento físico de mercadoria:
  - Seleção de Fornecedor ativo;
  - Número e série da Nota Fiscal;
  - Cadastro obrigatório de Lote e Data de Validade para cada medicamento recebido;
  - Atualização instantânea do saldo em `Lote.quantidade_atual` e `Medicamento.estoque_atual`.

### 5.4 Gestão de Validades e Regra FEFO (`Vencimentos.jsx`)
- Painel por faixas visuais de cores:
  - 🔴 **Vencidos:** Lotes com validade expirada;
  - 🟠 **Crítico (< 30 dias):** Exige consumo imediato ou segregação;
  - 🟡 **Alerta (31 a 90 dias):** Notificação para planejamento de giro;
  - 🟢 **Seguro (> 90 dias):** Estoque regular.
- **Ações Rápidas:**
  - *Retirar de Estoque por Perda / Quarentena:* Baixa formal do lote para descarte, gerando termo oficial para a vigilância sanitária.
  - *Troca de Lote:* Registro de envio para troca com o fornecedor antes da expiração.

### 5.5 Sugestão de Compras e Ponto de Reposição (`Compras.jsx`)
- **Cálculo Automático do Consumo Médio Diário (CMD):**
  - Analisa o histórico de `Saida` dos últimos 30, 60, 90 ou 180 dias.
  - Projeta a necessidade de compra para horizontes de 1 mês, 3 meses, 6 meses ou 1 ano (12 meses).
  - Fórmula aplicada:
    $$\text{Compra Necessária} = (\text{Consumo Médio Diário} \times \text{Dias de Projeção}) + \text{Estoque Mínimo} - \text{Estoque Total Atual}$$
- Emissão de Lista de Cotação e Ordem de Compra pronta para impressão ou exportação Excel/CSV.

### 5.6 Balanço e Inventário Central (`Inventario.jsx`)
- Abertura de sessão de inventário patrimonial com bloqueio de concorrência.
- Suporte a Contagem Cega (sem exibir a quantidade do sistema para o conferente) ou Contagem Aberta.
- Digitação da quantidade física encontrada na prateleira.
- Cálculo automático da divergência (`Físico - Sistema`).
- Homologação do inventário: atualiza automaticamente o saldo do lote e emite laudo de fechamento com assinaturas do responsável técnico e equipe de contagem.

---

## 6. MÓDULO 2: FARMÁCIA SATÉLITE & POSTOS DE ENFERMAGEM

A Farmácia Satélite atua na ponta assistencial, conectada diretamente aos leitos dos pacientes.

### 6.1 Isolamento Rígido de Estoque Satélite vs Central
- **Regra de Ouro:** A Satélite só pode dispensar medicamentos cujos lotes estejam fisicamente alocados a ela (`Lote.quantidade_satelite > 0`).
- Lotes com saldo na Central mas com saldo zerado na Satélite são **automaticamente ocultados** das listas de seleção de dispensação da Satélite.
- Não é permitido debitar estoque da Central para um paciente internado na Ala sem que antes tenha havido a transferência formal.

### 6.2 Aceite em Lote de Transferências (`TransferenciaAcceptModal.jsx`)
- Ao abrir o sistema na Satélite, o modal detecta transferências enviadas pela Central com status `Pendente`.
- Exibe o medicamento, lote, validade e quantidade enviada.
- O operador confere a caixa física e pode:
  - **Aceitar em Lote (ou individual):** Debita da Central, credita em `estoque_satelite` e `quantidade_satelite`, registrando histórico com proteção contra duplo clique atômico.
  - **Recusar Carga:** Devolve o saldo à Central e registra justificativa da recusa.

### 6.3 Gestão de Pacientes e Prescrições (`PacientesMedicao.jsx`)
Esta é a tela central do fluxo assistencial:
- **Painel Superior de Busca e Filtros:** Pesquisa por nome, prontuário, leito ou ala; filtro por alas (`N1`, `N2`, `R1 M`, `R1 F`, `UCP`, `CL1`, `CL2`, etc.).
- **Visualização em Cards ou Tabela:** Exibe foto do paciente, ala, leito, status do ciclo de entrega (`ciclo_coberto_ate`), dias restantes de medicação e badges de alergias em vermelho vibrante.
- **Prescrição Eletrônica Hospitalar:**
  - Seleção do medicamento por combobox com indicador de estoque na satélite;
  - Campos dedicados de aprazamento: **08h00**, **14h00**, **22h00**, **06h00**;
  - Checkboxes para **Metades de Comprimido** (`isMetade08`, `isMetade14`, `isMetade22`, `isMetade06`), permitindo prescrever `0.5`, `1.5`, `2.5` com cálculo exato;
  - Total diário calculado dinamicamente em tempo real;
  - Via de administração (VO, IM, EV, SL, etc.);
  - Frequência diária ou por intervalo de dias (ex: haloperidol decanoato a cada 10 ou 14 dias).
- **Inteligência para Medicamentos Líquidos (`liquidUtils.js`):**
  - Identifica automaticamente gotas e frascos;
  - Aplica o fator oficial de 20 gotas = 1 mL;
  - Calcula quantos dias um frasco (ex: 20 mL ou 100 mL) durará para o paciente;
  - Alerta a data em que o frasco atual vai acabar e agenda a entrega do próximo frasco.
- **Trava de Antibióticos e Antimicrobianos:**
  - Identifica classes de antibióticos por expressão regular e grupo terapêutico;
  - Bloqueia a extensão inadvertida de antibióticos além da `dataFim` prescrita pelo médico para evitar resistência bacteriana.

### 6.4 Separação de Medicamentos por Ciclo de Dias (`SeparacaoLoteModal.jsx`)
- Permite selecionar o paciente e a quantidade de dias para a entrega (ex: 1, 3, 7, 14 ou 30 dias).
- O sistema calcula a necessidade exata de comprimidos de cada prescrição ativa para o período solicitado.
- Seleciona automaticamente os lotes da Satélite pela regra **FEFO**.
- Se um lote não tiver quantidade suficiente para cobrir todo o ciclo do paciente, o sistema faz o desdobramento (*split*) consumindo o restante do lote mais antigo e completando com o próximo lote a vencer.
- Ao salvar a separação:
  - Debita o lote na Satélite;
  - Grava registros em `Saida` com flag `is_baixa_lote_paciente = true`;
  - Atualiza o campo `ciclo_coberto_ate` do paciente.
  - Gera Guia de Separação / Checklist para colagem na gaveta do paciente.

### 6.5 Ajuste de Dias de Entrega no Meio do Ciclo (`AjusteDiasEntregaModal.jsx`)
- **Problema resolvido:** Um paciente já recebeu medicação para um ciclo de 7 dias (até domingo). Na quinta-feira, o médico altera a dose ou introduz um novo medicamento.
- **Ação:** O `AjusteDiasEntregaModal` detecta a data final do ciclo já coberto (`dataFimCiclo`) e calcula quantos dias faltam exclusivamente para aquele novo item se sincronizar com os demais (ex: faltam 3 dias até domingo).
- **Filtro Estrito por Data do Dia Corrente:** Exibe apenas receitas alteradas ou inseridas na data de hoje, impedindo que receitas antigas consolidadas sejam alteradas por engano.
- **Trava de Duração Máxima:** Se a receita médica prevê apenas 5 dias de uso e o ciclo da ala tem 7 dias, o sistema trava a entrega no 5º dia.

### 6.6 Cancelamento e Estorno de Baixas (`CancelarBaixaModal.jsx`)
- Permite estornar dispensações incorretas ou feitas para o leito errado.
- Agrupa as saídas geradas na mesma operação de ciclo.
- Exige digitação da senha do operador para segurança e autenticação.
- Restaura integralmente o saldo em `Lote.quantidade_satelite` e `Medicamento.estoque_satelite`, atualizando a data de cobertura do paciente.

### 6.7 Pedidos da Satélite à Central (`PedidosSateliteManager.jsx`)
- A Satélite gera solicitações de reposição para a Farmácia Central:
  - Pode selecionar **Todas as Alas** ou uma Ala específica;
  - Define o período de dias projetado (ex: 7 dias);
  - Aplica margem percentual de segurança (ex: +10%, +20%);
  - Opção de descontar ou não o estoque residual existente na satélite;
  - Classificação por prioridade: `Normal`, `Urgente`, `Emergência`.
- O pedido fica visível na Farmácia Central para separação, conferência e expedição.

### 6.8 Devoluções de Medicamentos (`Devolucoes.jsx`)
- Quando um paciente recebe alta hospitalar, tem a medicação suspensa ou é transferido de ala, as sobras que estavam na enfermaria retornam para a Farmácia Satélite.
- O formulário vincula o paciente, ala, lote e quantidade devolvida.
- Recalcula o saldo da Satélite e emite o **Comprovante de Devolução** assinado por Farmácia e Enfermagem.

### 6.9 Mapa Mensal de Dispensação Diária (`MapaDispensacao.jsx` / `MapaMensalDispensacao.jsx`)
- Relatório em grade oficial que lista todos os pacientes da ala nas linhas e os dias do mês (1 a 31) nas colunas.
- Exibe a dose diária programada e a soma total de comprimidos consumidos no mês.
- Destaca visualmente a forma farmacêutica de cada item: **COMP** (Comprimido), **AMP** (Ampola), **FR** (Frasco/Gotas), **BLIST** (Blister).
- Exportação em formato CSV/Excel e impressão otimizada em folha A4 formato paisagem (Landscape).

### 6.10 Passagem de Plantão da Satélite (`PassagemPlantao.jsx`)
- Registro formal de troca de turno entre plantonistas:
  - Turno Diurno (07h00 às 18h59);
  - Turno Noturno (19h00 às 06h59 do dia seguinte).
- Checklist de conferência física do armário trancado de psicotrópicos e número do lacre.
- Registro de pendências para o próximo plantão, intercorrências e faltas.
- Geração da Ata de Passagem de Plantão em PDF assinada digitalmente.

---

## 7. MÓDULO 3: PRONTUÁRIO ELETRÔNICO & GESTÃO CLÍNICA DO PACIENTE

O Prontuário do Paciente é acessado com um clique no card do paciente (`ProntuarioPacienteModal.jsx`) e é dividido em 7 abas clínicas:

1. **Aba Resumo:** Dados demográficos, idade, prontuário, ala/leito, foto, alergias em destaque vermelho com ícone de alerta sonoro, status do ciclo de entrega de remédios.
2. **Aba Histórico Clínico & Evoluções:** Registro de evoluções médicas e multidisciplinares, conduta, anotações de sinais vitais (PA, FC, Temp, SatO2, Glicemia).
3. **Aba Medicações:** Lista completa de prescrições ativas e suspensas, aprazamento horário, doses diárias, botão para suspensão médica fundamentada e histórico de alterações posológicas.
4. **Aba Visitas (Portaria/Recepção):** Histórico de visitantes que entraram para ver o paciente, dados do documento (RG/CPF), grau de parentesco, data/hora de entrada e saída, e foto do visitante capturada pela webcam da portaria.
5. **Aba Exames:** Registro e visualização de laudos laboratoriais, hemogramas, eletrocardiogramas e exames toxicológicos.
6. **Aba Alergias:** Cadastro estruturado de agentes alérgenos com nível de gravidade (Leve, Moderada, Grave/Anafilaxia). Bloqueia a prescrição de fármacos da mesma classe.
7. **Aba Documentos:** Emissão de declarações de internação, relatórios de alta psiquiátrica, atestados e laudos com cabeçalho oficial do hospital.

---

## 8. MÓDULO 4: CARRINHO DE PARADA CARDIORRESPIRATÓRIA (PCR)

O módulo `CarrinhoParada.jsx` atende com rigor às exigências de emergência hospitalar, suportando múltiplos carrinhos físicos (ex: Carrinho R2, Carrinho R3, Carrinho UCP):

### 8.1 Modo Farmácia Hospitalar
- **Padronização das Gavetas:** Configuração da lista padrão de medicamentos, materiais e ampolas que devem obrigatoriamente compor cada gaveta do carrinho (Gaveta 1: Drogas de Acesso Rápido; Gaveta 2: Materiais de Intubação; Gaveta 3: Soluções e Expansores; Gaveta 4: Desfibrilador e Cuidados Finais).
- **Estoque Central do Carrinho:** Alocação de lotes com validade controlada para reposição imediata.
- **Conferência de Validades de Emergência:** Alerta antes que qualquer ampola do carrinho atinja 30 dias do vencimento.

### 8.2 Modo Enfermagem Assistencial
- **Checagem Diária do Lacre:** Verificação externa sem rompimento. O profissional confirma o número do lacre plástico numerado e o estado do desfibrilador/oxigênio.
- **Checagem Mensal Completa:** Rompimento formal do lacre, conferência física de todos os itens e validades, registro no sistema e aplicação de um novo lacre numerado.
- **Atendimento de Emergência / PCR:** Formulário ágil acionado durante a ocorrência para registrar quais ampolas de Adrenalina, Amiodarona, Atropina e bicarbonato foram administradas, gerando a baixa e a ordem imediata de reposição para a farmácia.

---

## 9. MÓDULO 5: CONTROLE ESPECIAL & PORTARIA 344/98 (ANVISA)

Gerenciado pela tela `LivroRegistro.jsx`, atende integralmente à legislação sanitária para medicamentos controlados (antipsicóticos, ansiolíticos, benzodiazepínicos, opioides):

### 9.1 Livro de Registro Específico Diário
- Livro eletrônico por substância ativa com padrão farmacopéico:
  - Saldo Inicial;
  - Entradas por Nota Fiscal e fornecedor;
  - Saídas assistenciais com identificação do paciente, prontuário, leito e número de receita/notificação;
  - Perdas ou quebras autorizadas;
  - Saldo Final do dia.
- Termos de Abertura e Encerramento prontos para assinatura e encadernação do Livro do CRF.

### 9.2 Balanços Regulatórios Oficiais (BMPO / BSPO)
- Geração com 1 clique do **BMPO** (Balanço Mensal de Substâncias Psicotrópicas e Outras) e do **BSPO** (Balanço Semestral/Anual).
- Agrupamento pelas listas da Portaria 344:
  - Lista A (Entorpecentes - Morfina, Tramadol, Metadona, Fentanil);
  - Lista B (Psicotrópicos - Diazepam, Clonazepam, Alprazolam, Midazolam, Fenobarbital);
  - Lista C1 (Outras Substâncias Sujeitas a Controle Especial - Haloperidol, Olanzapina, Risperidona, Quetiapina, Clozapina, Lítio, Antidepressivos);
  - Lista C2 (Retinoides) e C3 (Imunossupressores).

### 9.3 Rastreabilidade Reversa de Lotes
- Digita-se o número de qualquer lote para obter a árvore completa de eventos:
  1. Fornecedor de origem e número da NF de compra;
  2. Data de entrada e armazenamento no almoxarifado central;
  3. Transferência física para a farmácia satélite;
  4. Lista de todos os pacientes e leitos que receberam doses daquele lote;
  5. Sobras devolvidas ou descartadas.

---

## 10. MÓDULO 6: RESPONSÁVEL TÉCNICO (RT), EQUIPES E AUDITORIA

A tela `ResponsavelTecnico.jsx` é a central de governança clínica e regulatória do Farmacêutico Responsável Técnico:

### 10.1 Gestão de Usuários da Farmácia
- Cadastro de operadores, definição de login, perfil de acesso e permissões individuais por módulo.

### 10.2 Gestão da Equipe de Enfermagem
- Cadastro de Enfermeiros e Técnicos de Enfermagem, registro de COREN, turnos de atuação e alas designadas.

### 10.3 Gestão do Corpo Clínico (Médicos)
- Cadastro de médicos com número de CRM, especialidade médica e controle de certificados digitais para assinatura eletrônica de prescrições.

### 10.4 Gestão de Empréstimos Inter-hospitalares (`Emprestimos.jsx`)
- Controle de medicamentos emprestados para outros hospitais da rede ou recebidos por empréstimo, com controle de devolução de lotes equivalentes.

### 10.5 Trilha de Auditoria Forense (`Auditoria`)
- Registro transparente de qualquer alteração sensível:
  - Quem editou ou cancelou uma prescrição;
  - Quem realizou estorno de baixa;
  - Quem alterou um número de lote ou data de validade;
  - Exclusões lógicas no banco de dados com histórico preservado.
- Exportação completa da trilha de auditoria em arquivo CSV/Excel para fiscalizações da Anvisa ou do Ministério Público.

---

## 11. MÓDULO 7: MÓDULO DE ENFERMAGEM E CHECAGEM BEIRA-LEITO

O schema do banco já contempla as tabelas completas para o ciclo assistencial de enfermagem beira-leito:

1. **Checagem Beira-Leito (`EnfermagemChecagem`):** O profissional de enfermagem confere o medicamento no horário aprazado (08h, 14h, 22h, 06h), registrando o status: `administrado`, `nao_administrado` (com justificativa de recusa do paciente, jejum, vômito) ou `adiado`.
2. **Sinais Vitais Beira-Leito (`EnfermagemSinalVital`):** Aferição de Pressão Arterial, FC, FR, Temperatura, Saturação de O2, Glicemia Capilar e Escala Visual Analógica de Dor (EVA de 0 a 10).
3. **Balanço Hídrico Hospitalar (`EnfermagemBalancoHidrico`):** Controle milimétrico de entradas líquidas (soros, dietas orais/enterais, medicações) e saídas (diurese, drenos, vômitos).
4. **Sistematização da Assistência de Enfermagem - SAE (`EnfermagemPrescricaoCuidado`):** Cuidados prescritos pelo enfermeiro chefe (mudança de decúbito de 2 em 2 horas, curativos, aspiração de vias aéreas).

---

## 12. RECURSOS TRANSVERSAIS: CHAT INTERNO, ALERTAS E NOTIFICAÇÕES

### 12.1 Zorion Chat Widget (`ZorionChatWidget.jsx`)
- Widget flutuante no canto inferior direito de todas as telas.
- Comunicação em tempo real entre postos sem necessidade de telefone fixo:
  - Canal Farmácia ↔ Recepção;
  - Canal Farmácia Central ↔ Farmácia Satélite;
  - Canal Farmácia ↔ Postos de Enfermagem;
  - Mensagens privadas ponto a ponto entre usuários logados.
- Notificações sonoras suaves de mensagem enviada e recebida geradas via Web Audio API.

### 12.2 Alerta Hospitalar Sonoro de Novas Admissões
- Quando a recepção conclui a admissão de um novo paciente em qualquer computador do hospital, o Tauri/PostgreSQL propaga o sinal de rede.
- Todos os terminais da farmácia e enfermagem reproduzem a sequência de notas hospitalares suaves (Sol4 → Dó5 → Mi5 → Sol5 → Dó6) e exibem um card toast superior com o nome do paciente, ala e leito, permitindo abrir o prontuário imediatamente.

### 12.3 Relógio Hospitalar Flutuante e Temas Dinâmicos
- Relógio de alta precisão no rodapé com data civil e horário sincronizado ao servidor.
- Suporte a 6 esquemas visuais com contraste acessível para ambientes diurnos e noturnos.

---

## 13. REGRAS DE NEGÓCIO E FÓRMULAS MATEMÁTICAS CRÍTICAS

Para recriar o sistema fielmente, as seguintes funções matemáticas e algoritmos de domínio devem ser implementados exatamente como no código original:

### 13.1 Cálculo de Doses e Metades de Comprimidos
No arquivo `src/utils/prescricaoUtils.js`:
- Se o campo `horarios` estiver preenchido com array JSON, as doses de cada horário são somadas numericamente.
- Caso contrário, a soma é obtida de `dose08 + dose14 + dose22 + dose06`.
- O valor `totalDiario` pode ser fracionário (ex: `0.5`, `1.5`, `2.5`).
- Na dispensação para $N$ dias:
  $$\text{Total Doses} = \sum_{d=0}^{N-1} \text{dose}(d)$$
  Onde $\text{dose}(d) = 0$ caso o dia avaliado seja anterior à data em que a prescrição iniciou (`dataInicio`), ou caso o dia da semana não faça parte do esquema prescrito (`diasSemana`), ou caso ultrapasse a data limite de um antibiótico (`dataFim`).
- A quantidade final a dispensar é sempre arredondada para cima usando teto inteiro:
  $$\text{QtdDispensar} = \lceil \text{Total Doses} \rceil$$

### 13.2 Regra FEFO e Segregação da Satélite
No arquivo `src/utils/sateliteLoteUtils.js`:
- Ao listar lotes candidatos para saída na Satélite, o sistema filtra:
  $$\text{Lotes Elegíveis} = \{ L \in \text{Lotes do Medicamento} \mid L.\text{quantidade\_satelite} > 0 \}$$
- Os lotes são ordenados em ordem crescente de expiração:
  $$\text{Ordenação}: L_1 \le L_2 \iff \text{data\_validade}(L_1) \le \text{data\_validade}(L_2)$$
- O consumo consome o saldo de $L_1$; se a necessidade for maior que $L_1.\text{quantidade\_satelite}$, debita integralmente $L_1$ e abre débito em $L_2$ até satisfazer a demanda.

### 13.3 Medicamentos Líquidos (Gotas vs mL)
No arquivo `src/utils/liquidUtils.js`:
- Fator padrão: $20\text{ gotas} = 1\text{ mL}$.
- Cálculo do consumo diário em mL:
  $$\text{Consumo Diário (mL)} = \frac{\text{Total de Gotas Diárias}}{20}$$
- Cálculo de duração do frasco em dias:
  $$\text{Dias de Duração} = \left\lfloor \frac{\text{Volume do Frasco (mL)}}{\text{Consumo Diário (mL)}} \right\rfloor$$
- Se um frasco de 20 mL dura 13 dias para o paciente, a dispensação entrega 1 frasco fechado e agenda a entrega do próximo frasco exatamente para daqui a 13 dias.

### 13.4 Sincronização de Ciclo Mid-Cycle (`AjusteDiasEntregaModal`)
- Se o paciente já possui `ciclo_coberto_ate` igual a $D_{\text{fim}}$, e uma nova prescrição é inserida na data $D_{\text{hoje}}$:
  $$\Delta_{\text{dias}} = \text{differenceInCalendarDays}(D_{\text{fim}}, D_{\text{hoje}}) + 1$$
- O novo item é dispensado exatamente para $\Delta_{\text{dias}}$, fazendo com que todas as caixas de medicamentos do paciente terminem no mesmo dia para a próxima entrega unificada.

---

## 14. ROTEIRO PASSO A PASSO PARA REMONTAR O SISTEMA DO ZERO

Caso você queira recriar este projeto do zero em uma nova base de código limpa, siga estas etapas sequenciais:

### Passo 1: Inicialização do Projeto
1. Crie a estrutura com Vite + React:
   ```bash
   npm create vite@latest zorion-saude -- --template react
   cd zorion-saude
   ```
2. Instale o Tauri v2 para desktop:
   ```bash
   npm install -D @tauri-apps/cli
   npm install @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-fs @tauri-apps/plugin-log @tauri-apps/plugin-shell
   npx tauri init
   ```
3. Instale as dependências essenciais de UI, estado e utilitários:
   ```bash
   npm install @tanstack/react-query react-router-dom lucide-react sonner clsx tailwind-merge date-fns jspdf html2canvas
   npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-dropdown-menu @radix-ui/react-popover @radix-ui/react-table
   ```

### Passo 2: Configuração do Backend Tauri em Rust
1. No arquivo `src-tauri/Cargo.toml`, adicione as crates:
   ```toml
   [dependencies]
   tauri = { version = "2", features = [] }
   serde = { version = "1", features = ["derive"] }
   serde_json = "1"
   postgres = "0.19"
   chrono = { version = "0.4", features = ["serde"] }
   fallible-iterator = "0.3"
   log = "0.4"
   ```
2. Recrie o módulo `src-tauri/src/sync.rs` com os comandos:
   - `test_postgres_connection`: conecta e roda o script SQL inicial.
   - `query_postgres`: converte registros de colunas em JSON serde.
   - `execute_postgres`: executa DDL e DML com suporte a transações `BEGIN...COMMIT`.
   - `start_db_listener`: listener assíncrono para notificações LISTEN/NOTIFY.
3. Registre os comandos em `src-tauri/src/lib.rs`.

### Passo 3: Banco de Dados e Migração Automática
1. Crie a pasta `database/` e o arquivo `001_initial_schema.sql` com todas as 30+ tabelas descritas na Seção 4 deste documento.
2. Certifique-se de incluir os comandos `UPDATE "Ala"` com as capacidades oficiais das alas hospitalares (`N1: 39`, `N2: 39`, `R1 M: 10`, `R1 F: 15`, `UCP: 10`, etc.).
3. Adicione o usuário padrão administrador:
   `INSERT INTO "Usuario" ("id", "nome", "login", "senha", "perfil", "primeiro_acesso") VALUES ('user-admin-uuid', 'Administrador', 'admin', 'admin123', 'admin', false);`

### Passo 4: Camada de Serviços e Utilitários Frontend
1. Crie `src/api/db.js` contendo o proxy genérico `createEntityProxy(entityName)` com métodos `list()`, `get(id)`, `create(data)`, `update(id, data)`, `delete(id)` e `batchExecute()`.
2. Crie `src/utils/prescricaoUtils.js` contendo as funções de aprazamento, metades de comprimidos e cálculo de doses por dias.
3. Crie `src/utils/sateliteLoteUtils.js` com o isolamento estrito de lotes por saldo da satélite e ordenação FEFO.
4. Crie `src/utils/liquidUtils.js` com as regras de gotas para mL e duração do frasco.
5. Crie `src/utils/mavUtils.js` com as listas de medicamentos de alta vigilância e substâncias da Portaria 344/98.

### Passo 5: Construção das Telas Principais
1. **WelcomeScreen (`src/lib/WelcomeScreen.jsx`):** Hub de entrada com os 4 cartões de módulos (Farmácia Central, Farmácia Satélite, Carrinho de Parada, Responsável Técnico).
2. **Layout Geral (`src/Layout.jsx`):** Cabeçalho hospitalar, menus dinâmicos por módulo, atalhos rápidos com popover, seletor de temas, relógio em tempo real e o Zorion Chat Widget.
3. **Módulo Satélite:**
   - `PacientesMedicao.jsx` com mapa de leitos, admissões com foto e prescrição horária;
   - `SeparacaoLoteModal.jsx` para dispensação por ciclo;
   - `AjusteDiasEntregaModal.jsx` para complemento de tratamento;
   - `CancelarBaixaModal.jsx` para estornos seguros;
   - `ProntuarioPacienteModal.jsx` com as 7 abas do prontuário;
   - `MapaMensalDispensacao.jsx` para impressão A4 do mapa mensal.
4. **Módulo Central:**
   - `Dashboard.jsx`, `Medicamentos.jsx`, `Entradas.jsx`, `Estoque.jsx`, `Vencimentos.jsx`, `Compras.jsx`, `Inventario.jsx`, `Relatorios.jsx`.
5. **Módulos Regulatórios e Suporte:**
   - `LivroRegistro.jsx` (Portaria 344/98 e BMPO/BSPO);
   - `CarrinhoParada.jsx` (Modos Farmácia e Enfermagem para PCR);
   - `ResponsavelTecnico.jsx` (Usuários, Equipe de Enfermagem, Médicos e Trilha de Auditoria);
   - `PassagemPlantao.jsx` (Turnos Diurno e Noturno);
   - `Devolucoes.jsx` (Estornos e sobras de enfermaria).

---

## 15. CONCLUSÃO E CHECKLIST DE VALIDAÇÃO

Ao finalizar a reconstrução, execute a lista de verificação para garantir que o sistema está 100% operacional:
- [ ] Conexão com o PostgreSQL autenticada com sucesso na inicialização;
- [ ] Login com usuário `admin` e senha `admin123`;
- [ ] Alternância entre os módulos **Farmácia Central**, **Farmácia Satélite**, **Carrinho de Parada** e **RT** pelo menu superior;
- [ ] Cadastro de medicamento com apresentação normalizada e lote com validade;
- [ ] Envio de transferência da Central e recepção no modal automático da Satélite;
- [ ] Admissão de paciente com foto vinculada a um leito vago da Ala N1;
- [ ] Prescrição com horários (08h, 14h, 22h, 06h) e metades de comprimidos;
- [ ] Separação de lote FEFO com débito exclusivo na Satélite e sem tocar no estoque da Central;
- [ ] Emissão e impressão A4 do Mapa Mensal de Dispensação Diária;
- [ ] Registro de checagem do Carrinho de Parada e geração de termo do Livro da Portaria 344/98.

---
*Documento compilado e homologado para a reconstrução integral do ecossistema Zorion Saúde / AXION ERP Hospitalar.*
