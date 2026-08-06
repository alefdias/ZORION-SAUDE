# AXION ERP Hospitalar 🏥

Um sistema integrado e robusto para gestão hospitalar psiquiátrica, desde o controle centralizado de estoque e farmácias satélites, até admissão na recepção, fluxos de enfermagem e corpo clínico.

## Módulos do Sistema

### 🏢 Administração Geral e Estrutura
- **Gestão de Alas e Setores**: Criação de setores hospitalares divididos por gestão (Terceirizado ou Gestão Interna).
- **Mapa de Leitos**: Cadastro dinâmico de leitos para cada setor, gerando um mapa visual interativo.

### 👥 Recepção Psiquiátrica
- **Ficha de Admissão Nível Currículo**: Admissão completa com foto do paciente, dados demográficos, tipo de internação (Voluntária, Involuntária, Compulsória) e risco (Calmo, Agitado, Fuga).
- **Integração Ponta a Ponta**: Ao admitir o paciente para um setor específico, ele é notificado em tempo real para a fila da Enfermagem.
- **Visitantes**: Controle de acesso de visitantes por paciente e leito.

### 💉 Enfermagem
- **Painel por Setor**: O plantonista seleciona a Ala/Setor em que está atuando e visualiza apenas os pacientes daquele setor.
- **Pendências**: Exibe imediatamente os pacientes enviados pela Recepção que aguardam leito.
- **Alocação de Leitos**: Vincula um paciente aguardando a um leito livre com apenas dois cliques.
- **Gestão de Alta**: Liberação de leitos e altas de pacientes do setor diretamente pelo mapa visual.

### 📦 Controle de Estoque & Farmácia
- **Inventário Central**: Gestão de medicamentos, lotes, validades e movimentações completas.
- **Farmácia Satélite**: Pontos de dispensação distribuídos pelos setores, abastecidos pela farmácia central.
- **Módulo Médico**: Prescrição eletrônica conectada ao estoque (checa disponibilidade de medicamentos em tempo real).

## Tecnologias

- **React.js + Vite** (Frontend Web)
- **Tauri** (Desktop Wrapper p/ Windows, Mac, Linux)
- **Tailwind CSS + shadcn/ui** (Interface moderna, limpa e responsiva)
- **Lucide Icons** (Ícones padronizados)

## Como Executar (Desenvolvimento)

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Rode o ambiente Tauri (Frontend + Backend Rust):
   ```bash
   npm run tauri dev
   ```

## Compilação

Para compilar o aplicativo final:
```bash
npm run tauri build
```
