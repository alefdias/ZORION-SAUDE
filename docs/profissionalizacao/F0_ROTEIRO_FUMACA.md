# F0 — Roteiro de fumaça (9 fluxos críticos)

> **Objetivo:** provar que o backup restaura e que o sistema funciona igual no banco clonado.
> **Regra:** na F0 não se altera nada. Este roteiro é a linha de base (baseline) para comparar todas as fases seguintes.

## Antes de começar

```bash
# 1. Ambiente pronto?
./scripts/f0/check_ambiente.sh

# 2. Backup da produção (valida estrutura e gera checksum)
PGPASSWORD='***' DBNAME=zorion ./scripts/f0/backup.sh

# 3. Clonar produção -> zorion_test (recria o destino e confere contagens)
PGPASSWORD='***' ./scripts/f0/clone_prod_para_test.sh zorion zorion_test
```

O passo 3 termina com **“Paridade confirmada”**. Só continue se aparecer isso.

## Como preencher

Para cada fluxo: execute **primeiro no banco `zorion_test`**, depois na produção (somente leitura, sem criar dados de teste na produção).
Marque `OK`, `FALHOU` ou `N/A` e guarde a evidência (print ou nº do documento gerado).

---

## 1. Login, perfis e sessão

| Passo | Esperado |
|---|---|
| Abrir o app | Tela de login (AuthDialog) |
| Entrar com usuário administrador | Entra e mostra o nome no cabeçalho |
| Abrir o menu | Todos os módulos visíveis para admin |
| Sair e entrar com perfil auxiliar/médico | Menu restrito ao perfil |
| Fechar e reabrir o app | Sessão se comporta como antes |

- [ ] OK  [ ] FALHOU  [ ] N/A
- Evidência: ______________________

## 2. Entrada + nota fiscal + lote/validade

Caminho: **Farmácia Central → Movimentações → Entradas → Nova entrada**

| Passo | Esperado |
|---|---|
| Escolher medicamento e informar lote/validade futura | Campos aceitos |
| Informar quantidade, fornecedor e nº da NF | Salva sem erro |
| Salvar | Entrada listada com nº e responsável |
| Ir em **Estoque** | Saldo subiu exatamente a quantidade |
| Abrir o lote | Quantidade, validade e nº do lote corretos |

- [ ] OK  [ ] FALHOU  [ ] N/A
- Evidência (nº entrada + saldo antes/depois): ______________________

## 3. Saída / dispensação / baixa

Caminho: **Farmácia Central → Movimentações → Saídas**

| Passo | Esperado |
|---|---|
| Nova saída com motivo e setor | Salva |
| Conferir **Estoque** | Saldo caiu na quantidade exata |
| Conferir o lote debitado | Lote correto (por validade) |
| Estornar (se o fluxo permitir) | Saldo volta ao valor anterior |

- [ ] OK  [ ] FALHOU  [ ] N/A
- Evidência: ______________________

## 4. Satélite — ciclo completo

Caminho: **Farmácia Satélite → Movimentações → Pedidos à Central** → **Central → Movimentações → Pedidos Satélite** → retorno ao satélite

| Passo | Esperado |
|---|---|
| Satélite cria pedido para uma ala | Pedido aparece como pendente na Central |
| Central separa o pedido | Status muda para separado |
| Central entrega | Status entregue |
| Satélite recebe | Estoque do satélite sobe; central baixa |
| Conferir os dois estoques | Central + satélite fecham com o mesmo total |

- [ ] OK  [ ] FALHOU  [ ] N/A
- Evidência (nº pedido): ______________________

## 5. Inventário / balanço

Caminho: **Central → Balanço** e **Satélite → Balanço**

| Passo | Esperado |
|---|---|
| Abrir contagem de um item | Quantidade do sistema exibida |
| Informar quantidade contada diferente | Divergência calculada |
| Fechar/confirmar | Ajuste aplicado e registrado |
| Reabrir | Item com saldo ajustado |

- [ ] OK  [ ] FALHOU  [ ] N/A
- Evidência: ______________________

## 6. Livro de registro / Portaria 344

Caminho: **Farmácia Satélite (ou RT) → Portaria 344** (`LivroRegistro`)

| Passo | Esperado |
|---|---|
| Abrir o livro | Lançamentos anteriores preservados |
| Registrar/consultar movimentação de controlado | Entrada/saída refletida |
| Imprimir o livro | A4 legível, sem corte de coluna |
| Comparar saldo do livro x estoque | Coerentes |

- [ ] OK  [ ] FALHOU  [ ] N/A
- Evidência: ______________________

## 7. Carrinho de parada

Caminho: **Carrinho de Parada**

| Passo | Esperado |
|---|---|
| Abrir o carrinho | Itens e validades carregados |
| Movimentar/consumir um item | Estoque e histórico atualizados |
| Conferir lacre/padronização | Registro coerente |

- [ ] OK  [ ] FALHOU  [ ] N/A
- Evidência: ______________________

## 8. Relatórios e impressão

Caminho: **Central → Relatórios**, **Satélite → Mapa de Dispensação**, **Relatórios → Mapa Mensal**

| Passo | Esperado |
|---|---|
| Gerar relatório de estoque | Totais batem com a tela de Estoque |
| Imprimir mapa de dispensação | A4 em paisagem, nomes oficiais das alas |
| Gerar PDF | Abre e mantém colunas |
| Relatório de vencimentos | Lista coerente com **Vencimentos** |

- [ ] OK  [ ] FALHOU  [ ] N/A
- Evidência: ______________________

## 9. Backup e restore (o portão da F0)

| Passo | Esperado |
|---|---|
| `backup.sh` | `.dump` + `.sha256`, mensagem de validação |
| `pg_restore --list` no dump | Lista o conteúdo sem erro |
| `clone_prod_para_test.sh` | Recria `zorion_test` e mostra **paridade** |
| Apontar o app para `zorion_test` (Configurações → Servidor) | Conecta |
| Repetir os fluxos 1 a 8 no clone | Todos passam |
| Voltar o app para produção | Conecta no banco original |
| Cronometrar o restore | Tempo registrado: ______ min |

- [ ] OK  [ ] FALHOU  [ ] N/A
- Evidência: ______________________

---

## Critério de aprovação da F0

A F0 só fecha quando **todos** forem verdadeiros:

1. Backup gerado, validado e com checksum.
2. Restore completo em `zorion_test` sem erro.
3. `conferir_clone.sh` mostra paridade em todas as tabelas comparadas.
4. Os 9 fluxos passam no clone.
5. Produção continua intacta e o app volta a apontar para ela.
6. Tempo de restore documentado.

**Assinatura:** ______________________  **Data:** ____/____/______
