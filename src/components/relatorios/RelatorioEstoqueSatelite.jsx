import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { safeFormatDate } from "@/utils/dateUtils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";

const ROTULOS_FILTRO = {
  todos: "Todos os itens",
  com_saldo: "Somente com saldo",
  alerta_minimo: "Estoque baixo",
  sem_saldo: "Sem saldo",
  mav: "Medicamentos MAV",
  psico: "Portaria 344",
  vencendo: "Vencimentos próximos",
};

const ROTULOS_ORDENACAO = {
  nome_asc: "Nome (A - Z)",
  saldo_desc: "Maior saldo satélite",
  saldo_asc: "Menor saldo satélite",
  central_desc: "Maior saldo central",
  validade_asc: "Validade mais próxima",
};

const TONS = {
  ok: { fundo: "#e8f5e9", borda: "#a5d6a7", texto: "#1b5e20" },
  warning: { fundo: "#fff8e1", borda: "#ffe082", texto: "#7c4d00" },
  danger: { fundo: "#ffebee", borda: "#ef9a9a", texto: "#b71c1c" },
  muted: { fundo: "#eceff1", borda: "#cfd8dc", texto: "#455a64" },
};

function statusDoItem(item) {
  if (item.temVencido) return { rotulo: "Lote vencido", tom: "danger" };
  if (item.temVencendo) return { rotulo: "Vencendo (≤30d)", tom: "warning" };
  if (item.temAlerta) return { rotulo: "Estoque baixo", tom: "warning" };
  if ((Number(item.saldoSat) || 0) <= 0) return { rotulo: "Zerado", tom: "muted" };
  return { rotulo: "OK", tom: "ok" };
}

function BadgeStatus({ rotulo, tom }) {
  const cores = TONS[tom] || TONS.muted;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 5px",
        borderRadius: "3px",
        border: `1px solid ${cores.borda}`,
        backgroundColor: cores.fundo,
        color: cores.texto,
        fontSize: "7pt",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {rotulo}
    </span>
  );
}

function resumir(itens) {
  return itens.reduce(
    (acc, item) => {
      const saldo = Number(item.saldoSat) || 0;
      const central = Number(item.estoque_atual) || 0;
      acc.itens += 1;
      acc.satelite += saldo;
      acc.central += central;
      if (saldo > 0) acc.comSaldo += 1;
      if (item.temAlerta) acc.baixo += 1;
      if (item.temVencido) acc.vencidos += 1;
      else if (item.temVencendo) acc.vencendo += 1;
      if (item.temVencido || item.temVencendo) acc.criticos += 1;
      return acc;
    },
    { itens: 0, satelite: 0, central: 0, comSaldo: 0, baixo: 0, vencidos: 0, vencendo: 0, criticos: 0 }
  );
}

function lotesComSaldo(item) {
  return (item.lotes || [])
    .filter((lote) => (Number(lote.saldoSatelite) || 0) > 0)
    .sort((a, b) => {
      const da = a.data_validade || "9999-99-99";
      const db = b.data_validade || "9999-99-99";
      return String(da).localeCompare(String(db));
    });
}

function montarAlertas(itens) {
  const alertas = [];

  itens.forEach((item) => {
    if (item.temAlerta) {
      alertas.push({
        ordem: 3,
        tipo: "Estoque baixo",
        tom: "warning",
        medicamento: item.nome,
        codigo: item.codigo || "S/C",
        lote: "-",
        validade: "-",
        dias: null,
        quantidade: Number(item.saldoSat) || 0,
        detalhe: `Mínimo: ${Number(item.estoqueMin) || 0} un`,
      });
    }

    lotesComSaldo(item).forEach((lote) => {
      if (lote.vencido) {
        alertas.push({
          ordem: 1,
          tipo: "Lote vencido",
          tom: "danger",
          medicamento: item.nome,
          codigo: item.codigo || "S/C",
          lote: lote.numero_lote || "S/L",
          validade: lote.data_validade,
          dias: lote.diasParaVencer,
          quantidade: Number(lote.saldoSatelite) || 0,
          detalhe: lote.diasParaVencer != null ? `Vencido há ${Math.abs(lote.diasParaVencer)} dia(s)` : "Vencido",
        });
      } else if (lote.vencendo) {
        alertas.push({
          ordem: 2,
          tipo: "Vencendo",
          tom: "warning",
          medicamento: item.nome,
          codigo: item.codigo || "S/C",
          lote: lote.numero_lote || "S/L",
          validade: lote.data_validade,
          dias: lote.diasParaVencer,
          quantidade: Number(lote.saldoSatelite) || 0,
          detalhe: lote.diasParaVencer != null ? `Vence em ${lote.diasParaVencer} dia(s)` : "Vencendo",
        });
      }
    });
  });

  return alertas.sort(
    (a, b) =>
      a.ordem - b.ordem ||
      String(a.medicamento || "").localeCompare(String(b.medicamento || ""))
  );
}

function TabelaItens({ titulo, itens }) {
  if (!itens.length) return null;

  const subtotal = resumir(itens);

  return (
    <div style={{ marginBottom: "10px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#e2e8f0",
          border: "1px solid #94a3b8",
          borderBottom: "none",
          padding: "3px 6px",
          fontSize: "8pt",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        <span>{titulo}</span>
        <span>
          {subtotal.itens} item(ns) • {subtotal.satelite.toLocaleString("pt-BR")} un na satélite
        </span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7.6pt" }}>
        <thead style={{ display: "table-header-group" }}>
          <tr style={{ backgroundColor: "#f1f5f9" }}>
            <th style={thStyle("10%", "left")}>Cód.</th>
            <th style={thStyle("35%", "left")}>Medicamento / Apresentação</th>
            <th style={thStyle("15%", "left")}>Lote FEFO / Validade</th>
            <th style={thStyle("10%", "center")}>Satélite</th>
            <th style={thStyle("10%", "center")}>Central</th>
            <th style={thStyle("8%", "center")}>Mín.</th>
            <th style={thStyle("12%", "center")}>Status</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => {
            const lotes = lotesComSaldo(item);
            const fefo = lotes[0];
            const outros = lotes.length - 1;
            const status = statusDoItem(item);
            const unidade = item.unidade_medida || "un";
            const detalhe = [item.concentracao, item.apresentacao].filter(Boolean).join(" • ");

            return (
              <tr key={item.id} style={{ pageBreakInside: "avoid" }}>
                <td style={tdStyle("left")}>{item.codigo || "S/C"}</td>
                <td style={tdStyle("left")}>
                  <div style={{ fontWeight: 700 }}>{item.nome}</div>
                  {detalhe && (
                    <div style={{ fontSize: "6.8pt", color: "#475569", marginTop: "1px" }}>{detalhe}</div>
                  )}
                  <div style={{ marginTop: "1px" }}>
                    {isMav(item) && <span style={tagStyle("#ffebee", "#ef9a9a", "#b71c1c")}>MAV</span>}
                    {isPsicotropico(item.grupo_terapeutico) && (
                      <span style={tagStyle("#ede7f6", "#b39ddb", "#4527a0")}>P344</span>
                    )}
                  </div>
                </td>
                <td style={tdStyle("left")}>
                  {fefo ? (
                    <>
                      <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{fefo.numero_lote || "S/L"}</div>
                      <div style={{ fontSize: "6.8pt", color: fefo.vencido ? "#b71c1c" : "#475569" }}>
                        {safeFormatDate(fefo.data_validade)}
                        {outros > 0 ? ` • +${outros} lote(s)` : ""}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: "#64748b" }}>Sem lote</span>
                  )}
                </td>
                <td style={{ ...tdStyle("center"), fontWeight: 800, color: "#3730a3" }}>
                  {Number(item.saldoSat) || 0} {unidade}
                </td>
                <td style={{ ...tdStyle("center"), color: "#475569" }}>
                  {Number(item.estoque_atual) || 0} {unidade}
                </td>
                <td style={{ ...tdStyle("center"), color: "#64748b" }}>
                  {Number(item.estoqueMin) > 0 ? `${item.estoqueMin} ${unidade}` : "-"}
                </td>
                <td style={tdStyle("center")}>
                  <BadgeStatus rotulo={status.rotulo} tom={status.tom} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function thStyle(width, align) {
  return {
    width,
    textAlign: align,
    padding: "3px 4px",
    border: "1px solid #94a3b8",
    fontSize: "7pt",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    color: "#0f172a",
    backgroundColor: "#f1f5f9",
  };
}

function tdStyle(align) {
  return {
    textAlign: align,
    padding: "2.5px 4px",
    border: "1px solid #cbd5e1",
    verticalAlign: "top",
    color: "#0f172a",
  };
}

function tagStyle(fundo, borda, texto) {
  return {
    display: "inline-block",
    padding: "0 3px",
    marginRight: "3px",
    borderRadius: "2px",
    border: `1px solid ${borda}`,
    backgroundColor: fundo,
    color: texto,
    fontSize: "6.2pt",
    fontWeight: 800,
    textTransform: "uppercase",
  };
}

export function RelatorioEstoqueSatelite({ itens = [], filtros = {} }) {
  const resumo = resumir(itens);
  const padronizados = itens.filter((item) => item.padronizado !== false);
  const naoPadronizados = itens.filter((item) => item.padronizado === false);
  const alertas = montarAlertas(itens);
  const emitidoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const filtroAtivo = ROTULOS_FILTRO[filtros.statusFilter] || ROTULOS_FILTRO.todos;
  const ordenacao = ROTULOS_ORDENACAO[filtros.sortBy] || ROTULOS_ORDENACAO.nome_asc;
  const busca = (filtros.busca || "").trim();
  const selecaoManual = Boolean(filtros.selecaoManual);

  return (
    <>
      <div id="relatorio-estoque-satelite" className="hidden print:block bg-white text-black">
        {/* Cabeçalho oficial */}
        <div style={{ borderBottom: "2px solid #1e293b", paddingBottom: "6px", marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "14pt", fontWeight: 900, letterSpacing: "0.04em" }}>ZORION SAÚDE</div>
              <div style={{ fontSize: "7.5pt", color: "#475569", fontWeight: 600 }}>
                Farmácia Hospitalar • Farmácia Satélite
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: "7.5pt", color: "#475569" }}>
              <div style={{ fontWeight: 700 }}>Emitido em</div>
              <div>{emitidoEm}</div>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: "7px" }}>
            <div style={{ fontSize: "12.5pt", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Relatório de Estoque — Farmácia Satélite
            </div>
            <div style={{ fontSize: "7.5pt", color: "#475569", marginTop: "2px" }}>
              Filtro: <strong>{filtroAtivo}</strong>
              {busca ? (
                <>
                  {" "}• Busca: <strong>“{busca}”</strong>
                </>
              ) : null}
              {" "}• Ordenação: <strong>{ordenacao}</strong>
              {selecaoManual ? (
                <>
                  {" "}• Seleção manual: <strong>{itens.length} item(ns)</strong>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "4px",
            marginBottom: "8px",
          }}
        >
          <ResumoBox rotulo="Itens listados" valor={resumo.itens} />
          <ResumoBox rotulo="Unidades na satélite" valor={resumo.satelite.toLocaleString("pt-BR")} />
          <ResumoBox rotulo="Unidades na central" valor={resumo.central.toLocaleString("pt-BR")} />
          <ResumoBox rotulo="Itens com saldo" valor={resumo.comSaldo} />
          <ResumoBox rotulo="Estoque baixo" valor={resumo.baixo} tom="warning" />
          <ResumoBox rotulo="Lotes vencidos" valor={resumo.vencidos} tom="danger" />
          <ResumoBox rotulo="Lotes vencendo (≤30d)" valor={resumo.vencendo} tom="warning" />
          <ResumoBox rotulo="Total de alertas" valor={resumo.criticos} tom="danger" />
        </div>

        {itens.length === 0 ? (
          <div
            style={{
              border: "1px dashed #94a3b8",
              padding: "18px",
              textAlign: "center",
              fontSize: "8.5pt",
              color: "#475569",
              marginTop: "10px",
            }}
          >
            Nenhum medicamento encontrado para os filtros selecionados.
          </div>
        ) : (
          <>
            <TabelaItens titulo="Medicamentos padronizados" itens={padronizados} />
            <TabelaItens titulo="Medicamentos não padronizados" itens={naoPadronizados} />

            {/* Totais gerais */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "18px",
                borderTop: "2px solid #1e293b",
                borderBottom: "2px solid #1e293b",
                padding: "4px 6px",
                fontSize: "8pt",
                fontWeight: 800,
                marginBottom: "10px",
              }}
            >
              <span>
                Total de itens: <strong>{resumo.itens}</strong>
              </span>
              <span>
                Total na satélite: <strong>{resumo.satelite.toLocaleString("pt-BR")} un</strong>
              </span>
              <span>
                Total na central: <strong>{resumo.central.toLocaleString("pt-BR")} un</strong>
              </span>
            </div>
          </>
        )}

        {/* Anexo de alertas */}
        {alertas.length > 0 && (
          <div style={{ marginTop: "8px", pageBreakInside: "auto" }}>
            <div
              style={{
                backgroundColor: "#fef2f2",
                border: "1px solid #ef9a9a",
                padding: "3px 6px",
                fontSize: "8pt",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                color: "#b71c1c",
                marginBottom: "4px",
              }}
            >
              Anexo — Itens em alerta ({alertas.length})
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7.2pt" }}>
              <thead style={{ display: "table-header-group" }}>
                <tr style={{ backgroundColor: "#fef2f2" }}>
                  <th style={thStyle("24%", "left")}>Medicamento</th>
                  <th style={thStyle("13%", "left")}>Lote</th>
                  <th style={thStyle("11%", "center")}>Validade</th>
                  <th style={thStyle("10%", "center")}>Qtd</th>
                  <th style={thStyle("13%", "center")}>Situação</th>
                  <th style={thStyle("29%", "left")}>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((alerta, index) => (
                  <tr key={`${alerta.codigo}-${alerta.lote}-${alerta.tipo}-${index}`} style={{ pageBreakInside: "avoid" }}>
                    <td style={tdStyle("left")}>
                      <strong>{alerta.medicamento}</strong>
                      <div style={{ fontSize: "6.4pt", color: "#64748b" }}>{alerta.codigo}</div>
                    </td>
                    <td style={{ ...tdStyle("left"), fontFamily: "monospace" }}>{alerta.lote}</td>
                    <td style={tdStyle("center")}>
                      {alerta.validade ? safeFormatDate(alerta.validade) : "-"}
                    </td>
                    <td style={{ ...tdStyle("center"), fontWeight: 700 }}>
                      {alerta.quantidade} un
                    </td>
                    <td style={tdStyle("center")}>
                      <BadgeStatus rotulo={alerta.tipo} tom={alerta.tom} />
                    </td>
                    <td style={{ ...tdStyle("left"), color: "#475569" }}>{alerta.detalhe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Assinaturas */}
        <div style={{ marginTop: "18px", paddingTop: "6px", borderTop: "1px solid #94a3b8" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
            <div>
              <div style={{ fontSize: "7.5pt", marginBottom: "22px" }}>Responsável pela Farmácia:</div>
              <div style={{ borderTop: "1px solid #64748b", paddingTop: "2px", fontSize: "6.8pt", color: "#475569" }}>
                Assinatura e Carimbo
              </div>
            </div>
            <div>
              <div style={{ fontSize: "7.5pt", marginBottom: "22px" }}>Farmacêutico(a) Responsável:</div>
              <div style={{ borderTop: "1px solid #64748b", paddingTop: "2px", fontSize: "6.8pt", color: "#475569" }}>
                Assinatura e CRF
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "10px", textAlign: "center", fontSize: "6.5pt", color: "#94a3b8" }}>
          ZORION SAÚDE • Relatório de Estoque — Farmácia Satélite • {emitidoEm}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 10mm 12mm; }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background-color: #ffffff !important;
          }
          body * { visibility: hidden; }
          #relatorio-estoque-satelite, #relatorio-estoque-satelite * { visibility: visible; }
          #relatorio-estoque-satelite {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #ffffff !important;
            color: #000000 !important;
          }
          #relatorio-estoque-satelite table { width: 100%; border-collapse: collapse; }
          #relatorio-estoque-satelite thead { display: table-header-group; }
          #relatorio-estoque-satelite tr { page-break-inside: avoid; }
          #relatorio-estoque-satelite th,
          #relatorio-estoque-satelite td { border-color: #94a3b8 !important; }
          .no-print, nav, aside, header, footer, button { display: none !important; }
        }
      `}</style>
    </>
  );
}

function ResumoBox({ rotulo, valor, tom = "neutral" }) {
  const cores =
    tom === "danger"
      ? { fundo: "#fef2f2", borda: "#ef9a9a", texto: "#b71c1c" }
      : tom === "warning"
        ? { fundo: "#fffbeb", borda: "#fcd34d", texto: "#92400e" }
        : { fundo: "#f8fafc", borda: "#cbd5e1", texto: "#0f172a" };

  return (
    <div
      style={{
        border: `1px solid ${cores.borda}`,
        backgroundColor: cores.fundo,
        padding: "3px 5px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "6.4pt", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
        {rotulo}
      </div>
      <div style={{ fontSize: "10pt", fontWeight: 900, color: cores.texto }}>{valor}</div>
    </div>
  );
}

export default RelatorioEstoqueSatelite;
