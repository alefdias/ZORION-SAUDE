# 💡 Ideias — Impressão Automática e Bipagem de Medicamentos

> Documento de brainstorming para implementação futura.  
> Data: 2026-11-04

---

## 🖨️ Funcionalidade 1 — Impressão Automática na Central

**Objetivo:** Quando o satélite envia um pedido, a central imprime automaticamente sem ninguém precisar clicar.

### Fluxo proposto

```
Satélite clica "Enviar Pedido"
       ↓
Salva no banco  →  banco dispara pg_notify("novo_pedido")
       ↓
Central que tá com o app aberto recebe o evento automaticamente
       ↓
App da central abre/imprime o PDF automaticamente (sem ninguém clicar)
```

### Como implementar (tecnicamente)

- Já existe `start_db_listener` no Rust (`src-tauri/src/sync.rs`) usando `pg_notify`
- Quando evento chega → frontend dispara `window.print()` ou envia pro `lp` (Linux) via `tauri-plugin-shell`
- Configuração de impressora fixa por unidade (salva no banco ou config local)

### ⚠️ Ponto de atenção
- Precisa definir em qual impressora imprimir (configuração por computador/unidade)

---

## 📦 Funcionalidade 2 — Bipagem para Confirmar Entrega

**Objetivo:** Validar que o medicamento certo foi entregue ao satélite certo, usando leitor de código de barras.

**Problema central:** *"Como saber que nessa caixa/sacola tá o medicamento X?"*

---

### 🟢 Opção A — QR Code na Sacola *(mais simples)*

```
Central separa o pedido
       ↓
Imprime etiqueta com QR Code do pedido_id
       ↓
Cola na sacola/caixa
       ↓
Satélite aponta o leitor no QR
       ↓
Sistema abre o pedido e marca como "Recebido"
```

| | |
|---|---|
| ✅ Vantagens | Fácil de implementar, rápido |
| ❌ Desvantagens | Não valida item por item — alguém pode ter posto medicamento errado na caixa |

---

### 🟡 Opção B — Scan do Código de Barras do Próprio Medicamento (EAN/ANVISA)

Todo medicamento no Brasil tem código de barras EAN/ANVISA na caixa. Usar esse código para validar.

```
Satélite recebe a sacola
       ↓
Bipa cada caixa de medicamento
       ↓
Sistema compara com o pedido esperado
       ↓
Se bate → ✅ confirma item
Se não bate → ❌ alerta "medicamento não esperado"
```

**Requisito:** tabela `codigo_barras → medicamento` cadastrada no sistema (pode ser preenchida na Entrada).

| | |
|---|---|
| ✅ Vantagens | Valida item por item, usa barcode existente da indústria |
| ❌ Desvantagens | Precisa cadastrar os códigos dos medicamentos |

---

### 🔵 Opção C — Híbrido (mais robusto) ⭐ *Recomendada*

```
CENTRAL — na separação:
  Bipa cada medicamento que coloca na caixa
  → Sistema "monta" a caixa virtualmente (sabe exatamente o que tem dentro)
  → Imprime QR com ID da separação na caixa

SATÉLITE — no recebimento:
  Bipa o QR da caixa
  → Sistema já sabe o que tem dentro
  → Mostra lista: "confirmar recebimento de X, Y, Z?"
  → Farmacêutico confirma com 1 clique
```

| | |
|---|---|
| ✅ Vantagens | Rastreabilidade total, detecta erro na separação, recebimento rápido |
| ❌ Desvantagens | Mais complexo de implementar, exige etapa de separação com scanner |

---

## ❓ Perguntas em aberto (definir antes de implementar)

1. **Leitor físico:** Tem ou planeja ter leitor de código de barras (USB/Bluetooth)?
2. **Tipo de medicamento separado:** São caixas fechadas da indústria, ou doses individuais montadas pela farmácia?
3. **Entrega:** A central entrega pra vários satélites numa viagem, ou uma sacola por vez?
4. **Impressora:** Qual impressora usar na central? Configuração fixa ou por usuário?

---

## 📌 Próximos passos sugeridos

- [ ] Responder as perguntas em aberto acima
- [ ] Escolher entre Opção A, B ou C para a bipagem
- [ ] Definir fluxo da impressão automática (qual impressora, formato do documento)
- [ ] Implementar

