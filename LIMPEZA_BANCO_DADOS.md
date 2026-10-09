# 🧹 Script de Limpeza e Reset do Banco de Dados (PostgreSQL)

Este documento contém o script automático e seguro para realizar o **reset e limpeza de movimentações de testes** do sistema Zorion Saúde, preservando os cadastros essenciais, pacientes e prescrições.

---

## 🛡️ O que o script FAZ e NÃO FAZ

### ✅ O que é MANTIDO (8 Tabelas Preservadas):
1. **`Paciente`**: Todos os cadastros e dados dos pacientes internados.
2. **`PrescricaoPaciente`**: Todas as prescrições médicas e medicações que os pacientes tomam.
3. **`Medicamento`**: Todo o catálogo de medicamentos cadastrados *(o cadastro permanece intacto; apenas as colunas de saldo físico e satélite são zeradas)*.
4. **`Usuario`**: Todos os logins, senhas, perfis e usuários do sistema.
5. **`Fornecedor`**: Todos os fornecedores cadastrados.
6. **`Ala`**: Todas as alas, setores e enfermarias cadastradas.
7. **`Categoria`**: Todas as categorias de produtos e insumos.
8. **`Config`**: Todas as configurações do sistema.

### ❌ O que é LIMPO/ZERADO (27 Tabelas):
- **Estoque & Lotes**: `Lote`, `Entrada`, `Saida`, `Emprestimo`, `Inventario`, `InventarioItem`, `CarrinhoPadronizacao`, `CarrinhoEstoqueCentral`, `CarrinhoEstoqueFisico`, `CarrinhoMovimentacao`, `GavetaPaciente`, `TransferenciaPendente`, `PedidoSatelite`.
- **Prontuário & Atendimento**: `Visita`, `ProntuarioEvolucao`, `ProntuarioExame`, `ProntuarioAlergia`, `ProntuarioDocumento`.
- **Enfermagem & Logs**: `EnfermagemChecagem`, `EnfermagemSinalVital`, `EnfermagemBalancoHidrico`, `EnfermagemPrescricaoCuidado`, `EnfermagemChecagemCuidado`, `EnfermagemAnotacao`, `EnfermagemPassagemPlantao`, `ChatMessage`, `Auditoria`.

---

## 🚀 Script SQL Automático (Executar no pgAdmin)

> **Vantagem deste script**: Ele descobre dinamicamente as tabelas que realmente existem no seu banco. Se alguma tabela ainda não foi criada, ele simplesmente pula sem gerar erros como `relation "..." does not exist`.

```sql
ROLLBACK; -- 1. Cancela qualquer transação anterior que tenha ficado presa/abortada

DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Percorre todas as tabelas do schema public que REALMENTE existem
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename NOT IN (
              'Paciente',            -- MANTÉM PACIENTES
              'PrescricaoPaciente',  -- MANTÉM PRESCRIÇÕES/MEDICAÇÕES DOS PACIENTES
              'Medicamento',         -- MANTÉM CADASTRO DOS MEDICAMENTOS
              'Usuario',             -- MANTÉM USUÁRIOS E SENHAS
              'Fornecedor',          -- MANTÉM FORNECEDORES
              'Ala',                 -- MANTÉM ALAS/SETORES
              'Categoria',           -- MANTÉM CATEGORIAS
              'Config'               -- MANTÉM CONFIGURAÇÕES
          )
    ) LOOP
        EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" RESTART IDENTITY CASCADE';
    END LOOP;
END $$;

-- 2. Zera o saldo de estoque físico e satélite mantendo os medicamentos cadastrados
UPDATE "Medicamento" 
SET "estoque_atual" = 0, 
    "estoque_satelite" = 0;
```

---

## 📋 Como Executar no pgAdmin

1. Abra o **pgAdmin 4**.
2. Conecte-se ao seu servidor e selecione o banco de dados da aplicação (`zorion` ou o banco correspondente).
3. Abra a ferramenta de consulta (**Tools > Query Tool** ou botão direito no banco > **Query Tool**).
4. Copie todo o código SQL acima e cole no editor.
5. Pressione **F5** (ou clique no botão de Play/Execute).
6. A mensagem `DO` e `UPDATE` indicará que o banco foi limpo com sucesso!

---

## 🔔 Limpeza Específica: Limpar Apenas Notificações e Pedidos da Central/Satélite

> **Atenção:** Estes comandos **NÃO** apagam pacientes, medicamentos, lotes nem o estoque. Eles limpam apenas a fila de pedidos e as notificações geradas.

### Opção 1: Zerar TODOS os pedidos e notificações (Recomendado para zerar tudo)
```sql
-- 1. Cancela qualquer transação pendente
ROLLBACK;

-- 2. Limpa todos os pedidos da Central e Satélite (zera a notificação do sininho)
TRUNCATE TABLE "PedidoSatelite" RESTART IDENTITY CASCADE;

-- 3. Limpa as transferências pendentes geradas pelos pedidos
TRUNCATE TABLE "TransferenciaPendente" RESTART IDENTITY CASCADE;

-- 4. Limpa notificações de prescrições médicas na farmácia (se houver)
TRUNCATE TABLE "NotificacaoFarmacia" RESTART IDENTITY CASCADE;
```

### Opção 2: Apagar APENAS UM pedido específico feito errado (pelo código)
```sql
-- 1. Veja o código do pedido errado:
SELECT id, codigo, ala_nome, status, created_at 
FROM "PedidoSatelite" 
ORDER BY created_at DESC;

-- 2. Apague apenas o pedido errado (substitua 'PED-XXXX' pelo código real do seu pedido):
DELETE FROM "TransferenciaPendente" 
WHERE pedido_codigo = 'PED-XXXX' 
   OR pedido_id IN (SELECT id FROM "PedidoSatelite" WHERE codigo = 'PED-XXXX');

DELETE FROM "PedidoSatelite" 
WHERE codigo = 'PED-XXXX';
```

