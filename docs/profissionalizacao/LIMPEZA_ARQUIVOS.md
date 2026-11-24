# Limpeza de arquivos — 24/11/2026

## Critério

Arquivo só foi apagado se **nenhum outro arquivo o importava** (grafo de imports a partir de `main.jsx`, `App.jsx`, `Layout.jsx` e `pages.config.js`), e o build continuou passando.

> Importante: arquivo não importado **não entra no `.exe`**. Removê-lo limpa o projeto, mas não reduz o tamanho do executável. O que reduz o `.exe` são dependências não usadas (já removidas no `AUDITORIA_DEPENDENCIAS.md`).

## Resultado

| Item | Antes | Depois |
|---|---:|---:|
| Arquivos em `src/` | 140 | **115** |
| Arquivos sem referência | 33 | **8** |

## Removidos (25)

**Componentes/stubs sem uso**
`components/AuthDialog.jsx` (0 byte), `components/UserNotRegisteredError.jsx`,
`components/relatorios/RelatorioTable.jsx`, `lib/NavigationTracker.jsx`,
`hooks/use-mobile.jsx`,
`ui/collapsible`, `ui/context-menu`, `ui/form`, `ui/hover-card`, `ui/menubar`,
`ui/navigation-menu`, `ui/pagination`, `ui/radio-group`, `ui/resizable`,
`ui/sheet`, `ui/sidebar`, `ui/slider`, `ui/sonner`, `ui/switch`,
`ui/toggle-group`, `ui/toggle`.

**Código morto/duplicado**
- `api/localStore.js` — não importado
- `lib/AuthContext.jsx` — não importado (e continha admin fixo)
- `utils/logger.js` — duplicado; o usado é `lib/logger.js`
- `ui/AuthDialog.jsx` — substituído pelo login do `WelcomeScreen`

## Movidos (sem apagar)

| De | Para |
|---|---|
| `preview-welcome-saude.html` | `docs/modelos/` |
| `preview_guia_separacao.html` | `docs/modelos/` |
| `modelo_impressao_pedido_central.html` | `docs/modelos/` |
| `modelo_relatorio_mapa_dispensacao_diaria.html` | `docs/modelos/` |
| `rename_categoria.cjs` | `scripts/legado/` |
| `rename_categoria2.cjs` | `scripts/legado/` |
| `Duplicidade.sql` (1,3 MB, dado real) | `backups/` (fora do git) |
| `v3.2.49` (0 byte) | removido |

## Mantidos de propósito (8 sem referência)

| Arquivo | Motivo |
|---|---|
| `components/SyncStatusBadge.jsx` | status de sincronização — pode voltar |
| `components/dashboard/AlertCard.jsx` | card de alerta do dashboard — pode voltar |
| `components/forms/DevolucaoForm.jsx` | formulário de devolução — feature futura |
| `pages/Enfermeiros.jsx` | tela não roteada — feature futura |
| `ui/progress.jsx` | primitivo de UI real |
| `ui/scroll-area.jsx` | primitivo de UI real |
| `ui/separator.jsx` | primitivo de UI real |
| `ui/tooltip.jsx` | primitivo de UI real |

Se quiser, esses 8 também podem sair — mas aí é decisão de produto, não de build.

## Validação

| Verificação | Resultado |
|---|---|
| `npm run lint` | ✅ 0 erros |
| `npm run typecheck` | ✅ 0 erros |
| `npm run build` | ✅ compilou |

> Banco de dados não foi tocado.
