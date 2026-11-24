# Auditoria de dependências — 24/11/2026

## Resultado

| Momento | Total | High | Moderate | Low |
|---|---:|---:|---:|---:|
| Antes | **43** | 37 | 5 | 1 |
| Depois | **0** | 0 | 0 | 0 |

## O que foi feito

### 1. Dependências não usadas removidas

Confirmado por busca no código (`src/`), zero imports:

| Pacote | Motivo |
|---|---|
| `jimp` | processamento de imagem não usado (puxava ~28 alertas `@jimp/*`) |
| `puppeteer` (dev) | não há teste E2E usando |
| `three` | 3D não usado |
| `@stripe/stripe-js`, `@stripe/react-stripe-js` | pagamentos não usados |
| `react-leaflet` | mapas não usados |
| `embla-carousel-react` | carrossel não usado |
| `input-otp` | OTP não usado |
| `vaul` | drawer não usado |
| `moment` | datas usam `date-fns`; `moment` não importado |
| `zod` | validação não usada |
| `@hookform/resolvers` | não usado |

Também foram removidos os stubs órfãos `src/components/ui/drawer.jsx` e `src/components/ui/input-otp.jsx` (um deles tinha até sintaxe inválida, mas não era importado).

### 2. `npm audit fix` (sem `--force`)

Atualizou 15 pacotes dentro do semver, incluindo `vite`, `brace-expansion`, `js-yaml`, `source-map-js`, `browserslist`, `postcss-selector-parser`, `fflate`, `dompurify`, `@humanfs/node` e `baseline-browser-mapping`.

Nenhuma atualização major foi forçada.

## Validação após a limpeza

| Verificação | Resultado |
|---|---|
| `npm ls --depth=0` | ✅ sem dependências faltando/inválidas |
| `npm run lint` | ✅ 0 erros |
| `npm run typecheck` | ✅ 0 erros |
| `npm run build` | ✅ compilou |
| `cargo check` | ✅ compilou |
| `npm audit` | ✅ 0 vulnerabilidades |

> Banco de dados não foi tocado.
