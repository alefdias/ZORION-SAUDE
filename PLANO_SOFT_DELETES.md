# Resolução do Problema de Registros Fantasmas (Registros Apagados Voltando)

O problema atual é um clássico em sistemas distribuídos (sincronização de vários computadores offline/online). 

**O que está acontecendo hoje:**
1. O Computador A deleta um medicamento. O sistema apaga do banco local (SQLite) e envia um comando de `DELETE` para o banco online (Supabase).
2. O Supabase apaga a linha completamente.
3. O Computador B liga. Ele pede ao Supabase: "Me dê os dados alterados desde ontem". Como a linha foi **apagada fisicamente**, o Supabase não avisa o Computador B que ela foi removida.
4. O Computador B continua com o medicamento no banco dele. 
5. Quando o Computador B altera qualquer coisa, ele envia esse medicamento de volta pro Supabase, fazendo o registro "reviver" no Computador A também!

## A Solução: Exclusão Lógica (Soft Deletes)

Em vez de deletar fisicamente a linha, nós marcamos a linha como `deleted_at = data_da_exclusao` (Data de exclusão).
Assim, quando o Computador B ligar, o Supabase vai avisar: "Olha, esse registro foi alterado, e a alteração foi que ele foi apagado!". O Computador B então apaga do banco local dele.

## Alterações a serem feitas no Futuro

### 1. Banco de Dados Local (SQLite)
Precisamos adicionar a coluna `deleted_at DATETIME` em todas as tabelas do `migrations.sql` e no método `init` de `src-tauri/src/db.rs` para que o banco local de todos os computadores recebam essa coluna automaticamente.

#### `src-tauri/migrations.sql`
- Adicionar `deleted_at DATETIME` em todas as tabelas (`Medicamento`, `Lote`, `Entrada`, `Saida`, `Emprestimo`, `Fornecedor`, `Ala`, `Categoria`, `Inventario`, `InventarioItem`).
- Atualizar views/consultas para ignorar itens deletados.

#### `src-tauri/src/db.rs`
- No método `init`, adicionar a coluna dinamicamente caso o banco já exista (evitar perda de dados dos clientes atuais).
- No método `delete_entity` e deleções em cascata, mudar de `DELETE FROM tabela WHERE id = ?` para `UPDATE tabela SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`.
- No método `list_entities`, garantir que a consulta seja `SELECT * FROM tabela WHERE deleted_at IS NULL`.

### 2. Sincronizador Backend e Frontend
#### `src-tauri/src/sync.rs`
- O `upsert_from_firebase` agora vai salvar as linhas e, se vier com `deleted_at` preenchido, vai marcar como deletado no SQLite.

#### `src/api/syncManager.js`
- Mudar o push do Firebase/Supabase: Operações `delete` não farão mais `.delete()` no Supabase. Elas farão `.upsert()` enviando `deleted_at: new Date().toISOString()`.

### 3. Alteração no Supabase (Painel Online)
- Será necessário rodar um script SQL no painel do Supabase para adicionar a coluna `deleted_at` em todas as tabelas lá, caso contrário o Postgres rejeitará os updates.
