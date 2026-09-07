# 💡 Planejamento de Ideias e Melhorias Estratégicas - Zorion Saúde

Este documento reúne propostas de novas funcionalidades, automações e melhorias de alto impacto para o ecossistema **Zorion Saúde** em ambiente hospitalar e clínico.

---

## 1. 🏥 Farmácia Clínica & Segurança do Paciente

### 1.1 Checagem de Alergias & Alertas Visuais Críticos
- **Cadastro de Alergias:** Campo estruturado no prontuário do paciente (ex: *Dipirona, Penicilinas, Sulfas, AINEs*).
- **Trava de Segurança:** Alerta visual vermelho e bloqueio com confirmação explicita caso o profissional tente adicionar uma prescrição com substância alérgena.

### 1.2 Interações Medicamentosas & Duplicidade Terapêutica
- **Duplicidade:** Aviso automático ao prescrever dois medicamentos de mesma classe no mesmo aprazamento (ex: dois AINEs ou dois analgésicos opioides simultâneos).
- **Interações Graves:** Tabela de incompatibilidades e interações farmacológicas com aviso de risco alto/moderado.

### 1.3 Guia de Diluição e Aprazamento Incompatível
- **Ficha Rápida de Infusão:** Destaque de diluentes aceitos (Soro Fisiológico 0,9%, SG 5%, Água para Injeção).
- **Cuidados Especiais:** Indicadores automáticos para medicamentos *fotossensíveis*, que exigem *filtro de linha* ou equipo específico.

### 1.4 Ajuste de Dose por Função Renal / Hepática
- Campo opcional de *Clearance de Creatinina* ou *Filtração Glomerular Estimada*.
- Sinalização visual em medicamentos com excreção renal crítica (ex: vancomicina, gentamicina, anticoagulantes orais).

---

## 2. ⚡ Automação Operacional & Código de Barras

### 2.1 Separação e Conferência com Bipador (Código de Barras / DataMatrix)
- **Separação de Pedidos Satélite:** O separador bipa o código de barras ou DataMatrix da ampola/caixa; o sistema valida instantaneamente se o medicamento, lote e dosagem correspondem ao pedido.
- **Prevenção de Erro:** Emite sinal sonoro de sucesso (verde) ou erro (vermelho), impedindo trocas inadvertidas de medicamentos com grafia/som parecidos (LASA).

### 2.2 Impressão de Etiquetas de Dose Unitária / Gaveta
- Suporte para impressoras térmicas (ex: Zebra, Argox).
- **Conteúdo da Etiqueta:**
  - Nome do Paciente e Prontuário
  - Ala e Leito
  - Medicamento, Concentração e Forma
  - Lote e Validade
  - Horário Previsto da Administração (08h, 14h, 22h, 06h)
  - QR Code para conferência na beira do leito

### 2.3 Recebimento Ágil de Notas Fiscais
- Bipagem de caixas no momento da Entrada de Estoque para conferência física contra a nota do fornecedor.

---

## 3. 📦 Gestão Inteligente de Estoque & Suprimentos

### 3.1 Ponto de Reposição & Consumo Médio Diário (CMD)
- **Cálculo Automático do CMD:** Baseado no consumo real das últimas semanas/mês.
- **Sugestão Automática de Compras:** Botão *"Gerar Sugestão de Reposição"* na aba de Compras que calcula a quantidade ideal considerando:
  $$\text{Necessidade} = (\text{CMD} \times \text{Dias de Cobertura}) + \text{Estoque de Segurança} - \text{Estoque Atual}$$

### 3.2 Mapa de Calor e Validade Inteligente (FEFO / FIFO)
- Priorização obrigatória de lotes que vencem primeiro (*First Expire, First Out*).
- Destaque em cores vibrantes:
  - 🔴 **Crítico:** Vencimento em até 30 dias.
  - 🟠 **Alerta:** Vencimento entre 31 e 90 dias.
  - 🟢 **Regular:** Vencimento superior a 90 dias.

### 3.3 Curva ABC Dinâmica com Indicador de Giro
- **Classe A:** 20% dos itens que representam ~80% do valor financeiro do estoque.
- **Classe B:** Itens intermediários em custo e volume.
- **Classe C:** 50% dos itens que representam ~5% do valor financeiro (alto giro, baixo custo unitário).
- Gráficos visuais de giro de estoque e dias de cobertura.

---

## 4. 📜 Rastreabilidade & Portaria 344 (Conformidade Anvisa / SNGPC)

### 4.1 Fechamento Mensal / Trimestral do Livro 344
- Geração em 1 clique dos relatórios regulatórios:
  - **BMPO** (Balanço Mensal de Substâncias Psicotrópicas e Outras).
  - **BSPO** (Balanço Semestral/Anual).
  - Folha de Registro Específico com cabeçalho padrão pronto para assinatura do Responsável Técnico (CRF).

### 4.2 Rastreabilidade Reversa de Lote
- Tela de investigação por lote: digita o número do lote e exibe a linha do tempo completa:
  - Fornecedor e NF de origem.
  - Transferência Central → Satélite.
  - Pacientes que receberam doses desse lote.
  - Sobras devolvidas ou descartes efetuados.

---

## 5. 🚨 Carrinho de Parada & Emergência 2.0

### 5.1 Monitor de Lacres e Vencimentos Preventivos
- Painel com status visual de cada carrinho do hospital (UTI, Centro Cirúrgico, Pronto Atendimento).
- Alerta automático quando o lacre estiver rompido ou quando a checagem mensal preventiva estiver pendente há mais de 30 dias.

### 5.2 Kits de Reabastecimento Rápido (Código Azul / Intubação)
- Botão de reposição rápida de emergência: após uma intercorrência ou parada cardiorrespiratória (PCR), gera com um toque a saída completa do kit padrão de reabastecimento.

---

## 6. 🔔 Central de Notificações em Tempo Real & Trilha de Auditoria

### 6.1 Notificações Ativas na Interface
- Alerta sonoro/visual discreto na Central quando a Satélite envia um pedido de medicação marcado como **Urgente**.
- Notificação na Satélite quando a Central concluir a separação e o pedido estiver pronto para transporte.

### 6.2 Trilha de Auditoria (Audit Log)
- Registro transparente de ações sensíveis:
  - Quem editou lote ou data de validade.
  - Quem alterou prescrição ou deu baixa avulsa.
  - Quem concedeu alta ou excluiu registros com motivo fundamentado.

---

*Arquivo gerado em 07/09/2026 pelo Zorion Saúde.*
