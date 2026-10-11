import { useState, useMemo, useRef } from "react";
import { db } from "@/api/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  Printer,
  Search,
  Package,
  Layers,
  Boxes,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  FileCheck2,
  User,
  HeartPulse,
  AlertTriangle,
  RotateCcw,
  Pill
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { normalizeSearch } from "@/utils/searchUtils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";
import logo from "../assets/logo-tr.png";

export default function SateliteInventario() {
  const queryClient = useQueryClient();
  const printRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("com_saldo"); // "com_saldo", "todos", "padronizados", "controlados", "zerados"
  const [sortBy, setSortBy] = useState("nome"); // "nome", "codigo", "saldo_desc", "localizacao"
  const [isBlindCount, setIsBlindCount] = useState(false);
  const hoje = new Date();

  // Estados para Modal de Ajuste Comum
  const [ajusteComumModal, setAjusteComumModal] = useState({
    isOpen: false,
    medicamento: null,
    novaQtd: "",
    motivo: "Ajuste de Balanço Físico Manual"
  });

  // Estados para Modal de Conciliação Portaria 344
  const [conciliacao344Modal, setConciliacao344Modal] = useState({
    isOpen: false,
    medicamento: null,
    qtdFisica: "",
    tipoResolucao: "paciente", // 'paciente' | 'perda' | 'sobra'
    pacienteId: "",
    medicoNome: "",
    medicoCrm: "",
    perdaMotivo: "Quebra acidental de ampola durante o plantão",
    observacao: ""
  });

  // Usuário Logado
  let currentUser = { nome: "Farmacêutico Responsável", crf: "CRF-SP" };
  try {
    const rawUser = localStorage.getItem("pharma_user");
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed) {
        currentUser = {
          nome: parsed.full_name || parsed.nome || parsed.login || "Farmacêutico",
          crf: parsed.crf || "CRF-SP"
        };
      }
    }
  } catch (e) {
    // ignore
  }

  // Buscar medicamentos
  const { data: medicamentos = [], isLoading } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  // Buscar pacientes para conciliação
  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes'],
    queryFn: () => db.entities.Paciente.list(),
  });

  const pacientesAtivos = useMemo(() => {
    return pacientes.filter(p => !p.deleted_at && p.status !== 'Inativo');
  }, [pacientes]);

  // Itens filtrados para o balanço satélite
  const processedItems = useMemo(() => {
    let list = medicamentos.filter(m => m.ativo !== false && !m.deleted_at);

    if (filterType === "com_saldo") {
      list = list.filter(m => (Number(m.estoque_satelite) || 0) > 0);
    } else if (filterType === "clinicos") {
      list = list.filter(m => !isPsicotropico(m.grupo_terapeutico) && !m.portaria_344);
    } else if (filterType === "controlados" || filterType === "psicotropicos") {
      list = list.filter(m => isPsicotropico(m.grupo_terapeutico) || m.portaria_344);
    } else if (filterType === "padronizados") {
      list = list.filter(m => m.padronizado !== false);
    } else if (filterType === "zerados") {
      list = list.filter(m => (Number(m.estoque_satelite) || 0) <= 0);
    }

    if (searchTerm.trim()) {
      const term = normalizeSearch(searchTerm);
      list = list.filter(m => {
        const nome = normalizeSearch(m.nome || "");
        const cod = normalizeSearch(m.codigo || "");
        const princ = normalizeSearch(m.principio_ativo || "");
        const loc = normalizeSearch(m.localizacao || "");
        return nome.includes(term) || cod.includes(term) || princ.includes(term) || loc.includes(term);
      });
    }

    return [...list].sort((a, b) => {
      if (sortBy === "nome") return (a.nome || "").localeCompare(b.nome || "");
      if (sortBy === "codigo") return (a.codigo || "").localeCompare(b.codigo || "");
      if (sortBy === "localizacao") return (a.localizacao || "ZZZ").localeCompare(b.localizacao || "ZZZ");
      if (sortBy === "saldo_desc") return (Number(b.estoque_satelite) || 0) - (Number(a.estoque_satelite) || 0);
      return 0;
    });
  }, [medicamentos, filterType, searchTerm, sortBy]);

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    const totalItens = medicamentos.filter(m => m.ativo !== false && !m.deleted_at);
    const comSaldo = totalItens.filter(m => (Number(m.estoque_satelite) || 0) > 0);
    const clinicos = totalItens.filter(m => !isPsicotropico(m.grupo_terapeutico) && !m.portaria_344);
    const psicotropicos = totalItens.filter(m => isPsicotropico(m.grupo_terapeutico) || m.portaria_344);
    const totalUnidades = comSaldo.reduce((acc, m) => acc + (Number(m.estoque_satelite) || 0), 0);
    const zerados = totalItens.filter(m => (Number(m.estoque_satelite) || 0) <= 0);

    return {
      totalItens: totalItens.length,
      comSaldo: comSaldo.length,
      clinicos: clinicos.length,
      psicotropicos: psicotropicos.length,
      totalUnidades,
      zerados: zerados.length,
    };
  }, [medicamentos]);

  const handlePrint = (blind = false) => {
    setIsBlindCount(blind);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Abrir modal adequado conforme o tipo de medicamento
  const handleOpenAjuste = (med) => {
    const isControlado = isPsicotropico(med.grupo_terapeutico) || med.portaria_344;
    const saldoAtual = Number(med.estoque_satelite) || 0;

    if (isControlado) {
      setConciliacao344Modal({
        isOpen: true,
        medicamento: med,
        qtdFisica: saldoAtual.toString(),
        tipoResolucao: "paciente",
        pacienteId: pacientesAtivos[0]?.id || "",
        medicoNome: "",
        medicoCrm: "",
        perdaMotivo: "Quebra acidental de ampola durante o plantão",
        observacao: ""
      });
    } else {
      setAjusteComumModal({
        isOpen: true,
        medicamento: med,
        novaQtd: saldoAtual.toString(),
        motivo: "Ajuste de Balanço Físico Manual"
      });
    }
  };

  // Salvar Ajuste de Medicamento Comum
  const handleSalvarAjusteComum = async (e) => {
    e.preventDefault();
    const med = ajusteComumModal.medicamento;
    if (!med) return;

    const novaQtdInt = parseInt(ajusteComumModal.novaQtd, 10);
    if (isNaN(novaQtdInt) || novaQtdInt < 0) {
      toast.error("Informe uma quantidade física válida.");
      return;
    }

    try {
      toast.loading("Atualizando estoque satélite...");
      await db.entities.Medicamento.update(med.id, {
        estoque_satelite: novaQtdInt
      });

      await queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      toast.dismiss();
      toast.success(`Estoque de ${med.nome} atualizado para ${novaQtdInt} unidades!`);
      setAjusteComumModal({ isOpen: false, medicamento: null, novaQtd: "", motivo: "" });
    } catch (err) {
      toast.dismiss();
      toast.error("Erro ao atualizar estoque: " + (err.message || err));
    }
  };

  // Salvar Conciliação da Portaria 344
  const handleSalvarConciliacao344 = async (e) => {
    e.preventDefault();
    const med = conciliacao344Modal.medicamento;
    if (!med) return;

    const qtdFisicaInt = parseInt(conciliacao344Modal.qtdFisica, 10);
    const saldoSistema = Number(med.estoque_satelite) || 0;

    if (isNaN(qtdFisicaInt) || qtdFisicaInt < 0) {
      toast.error("Informe a contagem física real válida.");
      return;
    }

    const diferenca = saldoSistema - qtdFisicaInt;

    try {
      toast.loading("Processando conciliação da Portaria 344...");

      // Se faltam medicamentos (saldo sistema > físico)
      if (diferenca > 0) {
        if (conciliacao344Modal.tipoResolucao === "paciente") {
          const pac = pacientes.find(p => String(p.id) === String(conciliacao344Modal.pacienteId));
          if (!pac) {
            toast.dismiss();
            toast.error("Selecione o paciente que recebeu o medicamento.");
            return;
          }

          // Lança a saída no sistema vinculada ao paciente para o Livro 344
          await db.entities.Saida.create({
            medicamento_id: med.id,
            medicamento_nome: med.nome,
            quantidade: diferenca,
            destino: "Paciente",
            motivo: "Dispensação Hospitalar - Balanço Satélite",
            observacao: `Conciliação de dose não baixada no plantão: ${conciliacao344Modal.observacao || "Uso regular no leito"}`,
            tipo: "SAIDA",
            paciente_id: pac.id,
            paciente_nome: pac.nome,
            ala_nome: pac.alaNome || "Enfermaria",
            responsavel: currentUser.nome,
            responsavel_crf: currentUser.crf,
            data_saida: new Date().toISOString()
          });
        } else {
          // Lança a perda oficial para o Livro 344
          await db.entities.Saida.create({
            medicamento_id: med.id,
            medicamento_nome: med.nome,
            quantidade: diferenca,
            destino: "Perda",
            motivo: "Perda",
            observacao: `Perda registrada no Balanço Satélite: ${conciliacao344Modal.perdaMotivo}. ${conciliacao344Modal.observacao || ""}`.trim(),
            tipo: "SAIDA",
            responsavel: currentUser.nome,
            responsavel_crf: currentUser.crf,
            data_saida: new Date().toISOString()
          });
        }
      }

      // Atualiza o saldo físico exato na farmácia satélite
      await db.entities.Medicamento.update(med.id, {
        estoque_satelite: qtdFisicaInt
      });

      await queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      await queryClient.invalidateQueries({ queryKey: ['saidas'] });

      toast.dismiss();
      toast.success("Estoque conciliado e Livro da Portaria 344 protegido com sucesso!");
      setConciliacao344Modal({
        isOpen: false,
        medicamento: null,
        qtdFisica: "",
        tipoResolucao: "paciente",
        pacienteId: "",
        medicoNome: "",
        medicoCrm: "",
        perdaMotivo: "",
        observacao: ""
      });
    } catch (err) {
      toast.dismiss();
      toast.error("Erro na conciliação: " + (err.message || err));
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Estilos específicos de impressão */}
      <style>{`
        @media print {
          body, html, #root {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
          }
          th {
            background-color: #0f172a !important;
            color: white !important;
            font-weight: bold !important;
            padding: 6px 8px !important;
            text-align: left !important;
            border: 1px solid #334155 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          td {
            padding: 8px 6px !important;
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
          }
          tr:nth-child(even) {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .manual-box {
            border: 1.5px solid #64748b !important;
            height: 28px !important;
            width: 100% !important;
            background: #ffffff !important;
            display: block !important;
          }
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* ÁREA DE TELA (NÃO IMPRESSA) */}
      <div className="no-print space-y-6">
        {/* Header Superior */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Balanço Manual - Farmácia Satélite
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Emissão de folha de contagem e conciliação protegida para o Livro Portaria 344
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação de Impressão */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => handlePrint(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-bold shadow-sm rounded-xl h-10 px-4 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Folha de Contagem
            </Button>
            <Button
              onClick={() => handlePrint(true)}
              variant="outline"
              className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2 font-semibold rounded-xl h-10 px-4 cursor-pointer text-slate-700 dark:text-slate-300"
              title="Gera a folha sem mostrar os saldos do sistema para auditoria sem viés"
            >
              <EyeOff className="w-4 h-4 text-amber-600" />
              Folha Cega (Sem Saldo)
            </Button>
          </div>
        </div>

        {/* Cards de Métricas Rápidas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total com Saldo</p>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {stats.comSaldo}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Itens presentes no posto</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unidades Físicas</p>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                {stats.totalUnidades.toLocaleString("pt-BR")}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Soma total de unidades</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Itens sem Saldo</p>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                {stats.zerados}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Itens zerados na satélite</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Catálogo</p>
              <div className="text-2xl font-black text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                {stats.totalItens}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Medicamentos cadastrados</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </Card>
        </div>

        {/* Filtros e Barra de Busca */}
        <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Input de Busca */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nome, código, princípio ativo ou armário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-sm"
              />
            </div>

            {/* Filtros de Tipo */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex flex-wrap p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold gap-1">
                <button
                  type="button"
                  onClick={() => setFilterType("todos")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                    filterType === "todos"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  Todos ({stats.totalItens})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("clinicos")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                    filterType === "clinicos"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                  title="Medicamentos clínicos gerais (não controlados pela Portaria 344)"
                >
                  <Pill className="w-3.5 h-3.5 text-blue-500" />
                  <span>Clínicos</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                    filterType === "clinicos"
                      ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}>
                    {stats.clinicos}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("psicotropicos")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                    filterType === "psicotropicos" || filterType === "controlados"
                      ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                  title="Medicamentos sob controle especial da Portaria SVS/MS 344/98"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  <span>Psicotrópicos (Portaria 344)</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                    filterType === "psicotropicos" || filterType === "controlados"
                      ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}>
                    {stats.psicotropicos}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("com_saldo")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    filterType === "com_saldo"
                      ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  Com Saldo ({stats.comSaldo})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("padronizados")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    filterType === "padronizados"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  Padronizados
                </button>
              </div>

              {/* Ordenação */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 text-slate-700 dark:text-slate-300"
              >
                <option value="nome">Ordem: Nome (A-Z)</option>
                <option value="codigo">Ordem: Código</option>
                <option value="saldo_desc">Ordem: Maior Saldo</option>
                <option value="localizacao">Ordem: Localização/Armário</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Tabela de Visualização em Tela */}
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {filterType === "clinicos" && `${processedItems.length} Medicamentos Clínicos (Gerais) selecionados`}
                {(filterType === "controlados" || filterType === "psicotropicos") && `${processedItems.length} Psicotrópicos (Portaria 344) selecionados`}
                {filterType === "com_saldo" && `${processedItems.length} Medicamentos com saldo ativo no posto`}
                {filterType === "padronizados" && `${processedItems.length} Medicamentos padronizados selecionados`}
                {filterType === "todos" && `${processedItems.length} Medicamentos (Catálogo completo) selecionados`}
              </span>
              {filterType === "clinicos" && (
                <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200">
                  Uso Geral / Sem Livro Especial
                </Badge>
              )}
              {(filterType === "controlados" || filterType === "psicotropicos") && (
                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200">
                  Controle Especial / Livro 344
                </Badge>
              )}
            </div>
            <span className="text-xs text-slate-400">
              Clique em "Ajustar Saldo" ou "Conciliar 344" para registrar a contagem física
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/60">
                  <TableHead className="w-24 text-xs font-bold">CÓDIGO</TableHead>
                  <TableHead className="text-xs font-bold">MEDICAMENTO / APRESENTAÇÃO</TableHead>
                  <TableHead className="text-xs font-bold">LOCALIZAÇÃO</TableHead>
                  <TableHead className="text-xs font-bold text-center w-28">SALDO SISTEMA</TableHead>
                  <TableHead className="text-xs font-bold text-center w-36">CONTAGEM MANUAL</TableHead>
                  <TableHead className="text-xs font-bold text-center w-40">AÇÕES / CONCILIAÇÃO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : processedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                      Nenhum medicamento encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  processedItems.map((med) => {
                    const saldo = Number(med.estoque_satelite) || 0;
                    const isControlado = isPsicotropico(med.grupo_terapeutico) || med.portaria_344;

                    return (
                      <TableRow key={med.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <TableCell className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {med.codigo || "S/C"}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                            {med.nome}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{med.apresentacao || med.concentracao || "-"}</span>
                            {isControlado && (
                              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-red-600" />
                                Portaria 344
                              </Badge>
                            )}
                            {isMav(med) && (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                MAV
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                          {med.localizacao || "Geral"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "font-mono font-bold text-sm px-2.5 py-1 rounded-lg",
                            saldo > 0
                              ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          )}>
                            {saldo}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-block w-24 h-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950/50 text-slate-400 text-xs flex items-center justify-center font-mono">
                            [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {isControlado ? (
                            <Button
                              size="sm"
                              onClick={() => handleOpenAjuste(med)}
                              className="h-8 px-2.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg gap-1.5 shadow-xs cursor-pointer"
                              title="Ajuste auditado com proteção do Livro da Portaria 344"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
                              Conciliar 344
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenAjuste(med)}
                              className="h-8 px-2.5 text-xs font-semibold rounded-lg gap-1.5 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                              Ajustar Saldo
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: AJUSTE DE MEDICAMENTO COMUM (NÃO CONTROLADO) */}
      {/* ========================================================================= */}
      <Dialog
        open={ajusteComumModal.isOpen}
        onOpenChange={(open) => !open && setAjusteComumModal({ isOpen: false, medicamento: null, novaQtd: "", motivo: "" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Sliders className="w-5 h-5 text-indigo-600" />
              Ajustar Estoque Satélite
            </DialogTitle>
            <DialogDescription>
              Atualize a quantidade física contada no armário para medicamentos comuns.
            </DialogDescription>
          </DialogHeader>

          {ajusteComumModal.medicamento && (
            <form onSubmit={handleSalvarAjusteComum} className="space-y-4 pt-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-sm">
                <div className="font-bold text-slate-800">{ajusteComumModal.medicamento.nome}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Código: {ajusteComumModal.medicamento.codigo || "S/C"} • Saldo Atual no Sistema:{" "}
                  <strong className="text-indigo-600">{Number(ajusteComumModal.medicamento.estoque_satelite) || 0}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="novaQtd" className="text-xs font-bold text-slate-700">
                  Nova Quantidade Física (Contada no Posto):
                </Label>
                <Input
                  id="novaQtd"
                  type="number"
                  min="0"
                  required
                  value={ajusteComumModal.novaQtd}
                  onChange={(e) => setAjusteComumModal(prev => ({ ...prev, novaQtd: e.target.value }))}
                  className="font-mono text-base font-bold"
                  placeholder="Ex: 15"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="motivo" className="text-xs font-bold text-slate-700">
                  Motivo do Ajuste:
                </Label>
                <Input
                  id="motivo"
                  value={ajusteComumModal.motivo}
                  onChange={(e) => setAjusteComumModal(prev => ({ ...prev, motivo: e.target.value }))}
                  className="text-xs"
                  placeholder="Ex: Balanço manual semanal"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAjusteComumModal({ isOpen: false, medicamento: null, novaQtd: "", motivo: "" })}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                  Confirmar Ajuste
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: CONCILIAÇÃO INTELIGENTE PORTARIA 344 (LIVRO PROTEGIDO) */}
      {/* ========================================================================= */}
      <Dialog
        open={conciliacao344Modal.isOpen}
        onOpenChange={(open) => !open && setConciliacao344Modal(prev => ({ ...prev, isOpen: false }))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Conciliação de Estoque • Portaria 344
            </DialogTitle>
            <DialogDescription className="text-xs">
              Para cumprir as exigências da Vigilância Sanitária, toda baixa esquecida de psicotrópico deve ser conciliada com lastro legal no Livro.
            </DialogDescription>
          </DialogHeader>

          {conciliacao344Modal.medicamento && (() => {
            const saldoSistema = Number(conciliacao344Modal.medicamento.estoque_satelite) || 0;
            const qtdFisicaNum = parseInt(conciliacao344Modal.qtdFisica, 10);
            const diferenca = !isNaN(qtdFisicaNum) ? saldoSistema - qtdFisicaNum : 0;

            return (
              <form onSubmit={handleSalvarConciliacao344} className="space-y-4 pt-1">
                {/* Cartão de Detalhes do Medicamento */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs">
                  <div className="font-bold text-amber-950 text-sm">{conciliacao344Modal.medicamento.nome}</div>
                  <div className="text-amber-800 mt-1 flex justify-between">
                    <span>Saldo Sistema: <strong>{saldoSistema}</strong></span>
                    <span>Contagem Física: <strong>{!isNaN(qtdFisicaNum) ? qtdFisicaNum : "-"}</strong></span>
                    <span>
                      Divergência:{" "}
                      <strong className={cn(diferenca > 0 ? "text-red-600" : diferenca < 0 ? "text-emerald-700" : "text-slate-600")}>
                        {diferenca > 0 ? `Faltam ${diferenca}` : diferenca < 0 ? `Sobram ${Math.abs(diferenca)}` : "Sem divergência"}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Input de Contagem Física */}
                <div className="space-y-1.5">
                  <Label htmlFor="qtdFisica344" className="text-xs font-bold text-slate-700">
                    Quantas unidades tem realmente na gaveta/posto agora?
                  </Label>
                  <Input
                    id="qtdFisica344"
                    type="number"
                    min="0"
                    required
                    value={conciliacao344Modal.qtdFisica}
                    onChange={(e) => setConciliacao344Modal(prev => ({ ...prev, qtdFisica: e.target.value }))}
                    className="font-mono text-base font-bold"
                    placeholder="Digite o saldo físico real..."
                  />
                </div>

                {/* Se faltam unidades, oferecer as duas soluções legais */}
                {diferenca > 0 && (
                  <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <Label className="text-xs font-bold text-slate-800 block">
                      Como deseja justificar a saída de {diferenca} unidade(s) no Livro da Portaria 344?
                    </Label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setConciliacao344Modal(prev => ({ ...prev, tipoResolucao: "paciente" }))}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          conciliacao344Modal.tipoResolucao === "paciente"
                            ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold shadow-xs"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <HeartPulse className="w-4 h-4 text-indigo-600" />
                          Uso em Paciente
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 font-normal leading-tight">
                          Dose administrada no plantão (baixa esquecida)
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConciliacao344Modal(prev => ({ ...prev, tipoResolucao: "perda" }))}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          conciliacao344Modal.tipoResolucao === "perda"
                            ? "border-amber-600 bg-amber-50/80 text-amber-900 font-bold shadow-xs"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          Perda / Quebra
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 font-normal leading-tight">
                          Ampola quebrou, contaminou ou extraviou
                        </p>
                      </button>
                    </div>

                    {/* Formulário de Paciente */}
                    {conciliacao344Modal.tipoResolucao === "paciente" && (
                      <div className="space-y-2 pt-1">
                        <Label htmlFor="pacienteSelect" className="text-xs font-semibold text-slate-700">
                          Selecione o Paciente do Plantão:
                        </Label>
                        <Select
                          value={conciliacao344Modal.pacienteId}
                          onValueChange={(val) => setConciliacao344Modal(prev => ({ ...prev, pacienteId: val }))}
                        >
                          <SelectTrigger id="pacienteSelect" className="h-9 text-xs">
                            <SelectValue placeholder="Selecione o paciente..." />
                          </SelectTrigger>
                          <SelectContent>
                            {pacientesAtivos.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome} {p.prontuario ? `(Pront: ${p.prontuario})` : ""} - {p.alaNome || "Geral"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Formulário de Perda / Quebra */}
                    {conciliacao344Modal.tipoResolucao === "perda" && (
                      <div className="space-y-2 pt-1">
                        <Label htmlFor="perdaMotivoSelect" className="text-xs font-semibold text-slate-700">
                          Motivo Formal da Perda:
                        </Label>
                        <Select
                          value={conciliacao344Modal.perdaMotivo}
                          onValueChange={(val) => setConciliacao344Modal(prev => ({ ...prev, perdaMotivo: val }))}
                        >
                          <SelectTrigger id="perdaMotivoSelect" className="h-9 text-xs">
                            <SelectValue placeholder="Selecione o motivo..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Quebra acidental de ampola durante o plantão">Quebra acidental de ampola no posto</SelectItem>
                            <SelectItem value="Contaminação acidental durante aspiração">Contaminação acidental de frasco</SelectItem>
                            <SelectItem value="Avaria ou dano físico no manuseio da gaveta">Avaria no manuseio da gaveta</SelectItem>
                            <SelectItem value="Extravio sob apuração pelo responsável do plantão">Extravio em apuração pelo RT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label htmlFor="obsConciliacao" className="text-xs text-slate-600">
                        Observação Adicional / Prescrição:
                      </Label>
                      <Input
                        id="obsConciliacao"
                        value={conciliacao344Modal.observacao}
                        onChange={(e) => setConciliacao344Modal(prev => ({ ...prev, observacao: e.target.value }))}
                        placeholder="Ex: Dose prescrita no plantão noturno"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Se sobram unidades (físico > sistema) */}
                {diferenca < 0 && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                    <p className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Sobra Física Identificada (+{Math.abs(diferenca)} unidades)
                    </p>
                    <p className="text-emerald-700 mt-1">
                      O sistema registrará o acerto no saldo satélite como dose devolvida/não administrada sem alterar as notas fiscais de entrada.
                    </p>
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConciliacao344Modal(prev => ({ ...prev, isOpen: false }))}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5">
                    <FileCheck2 className="w-4 h-4" />
                    Salvar e Blindar Livro 344
                  </Button>
                </DialogFooter>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* ÁREA DE IMPRESSÃO EXCLUSIVA (PRINT-ONLY) */}
      {/* ========================================================================= */}
      <div className="print-only" ref={printRef}>
        {/* Cabeçalho Hospitalar */}
        <div className="flex justify-between items-center pb-3 border-b-2 border-slate-800 mb-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Zorion Saúde" className="h-14 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                ZORION SAÚDE
              </h1>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mt-1">
                FARMÁCIA SATÉLITE • CONTROLE DE ESTOQUE
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block bg-slate-900 text-white font-bold text-[10px] uppercase px-2.5 py-1 rounded mb-1">
              {isBlindCount ? "CONTAGEM CEGA" : "FOLHA DE CONTAGEM"}
              {filterType === "controlados" || filterType === "psicotropicos"
                ? " • PSICOTRÓPICOS (PORTARIA 344)"
                : filterType === "clinicos"
                ? " • MEDICAMENTOS CLÍNICOS"
                : filterType === "com_saldo"
                ? " • ITENS COM SALDO ATIVO"
                : " • GERAL"}
            </span>
            <p className="text-[11px] font-bold text-slate-900">
              Data: {format(hoje, "dd/MM/yyyy 'às' HH:mm")}
            </p>
            <p className="text-[10px] text-slate-500">
              Total de Itens: {processedItems.length}
            </p>
          </div>
        </div>

        {/* Informações da Sessão de Contagem */}
        <div className="border border-slate-300 rounded p-2.5 mb-3 bg-slate-50 text-[11px] flex justify-between items-center">
          <div>
            <span className="font-bold text-slate-700">Setor / Posto:</span> Farmácia Satélite
          </div>
          <div>
            <span className="font-bold text-slate-700">Conferente:</span> __________________________________
          </div>
          <div>
            <span className="font-bold text-slate-700">Turno:</span> (&nbsp;&nbsp;) Manhã &nbsp;&nbsp; (&nbsp;&nbsp;) Tarde &nbsp;&nbsp; (&nbsp;&nbsp;) Noite
          </div>
        </div>

        {/* Tabela de Contagem para Impressão */}
        <table className="w-full">
          <thead>
            <tr>
              <th style={{ width: "70px" }}>CÓD.</th>
              <th>MEDICAMENTO / APRESENTAÇÃO</th>
              <th style={{ width: "90px" }}>LOCALIZ.</th>
              {!isBlindCount && <th style={{ width: "75px", textAlign: "center" }}>SISTEMA</th>}
              <th style={{ width: "100px", textAlign: "center" }}>FÍSICO (CANETA)</th>
              <th style={{ width: "60px", textAlign: "center" }}>DIVERG.</th>
              <th style={{ width: "50px", textAlign: "center" }}>VISTO</th>
            </tr>
          </thead>
          <tbody>
            {processedItems.map((med) => {
              const saldo = Number(med.estoque_satelite) || 0;
              return (
                <tr key={med.id} className="page-break-avoid">
                  <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                    {med.codigo || "S/C"}
                  </td>
                  <td>
                    <div style={{ fontWeight: "bold", textTransform: "uppercase" }}>
                      {med.nome}
                    </div>
                    <div style={{ fontSize: "9px", color: "#64748b" }}>
                      {med.apresentacao || med.concentracao || ""}
                      {med.portaria_344 ? " [PORTARIA 344]" : ""}
                      {isMav(med) ? " [MAV]" : ""}
                    </div>
                  </td>
                  <td style={{ fontSize: "10px" }}>
                    {med.localizacao || "Geral"}
                  </td>
                  {!isBlindCount && (
                    <td style={{ textAlign: "center", fontWeight: "bold", fontSize: "12px" }}>
                      {saldo}
                    </td>
                  )}
                  <td style={{ textAlign: "center", padding: "4px" }}>
                    <div className="manual-box"></div>
                  </td>
                  <td style={{ textAlign: "center", color: "#94a3b8" }}>
                    ____
                  </td>
                  <td style={{ textAlign: "center", color: "#94a3b8" }}>
                    [ &nbsp; ]
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Rodapé com Assinaturas */}
        <div className="page-break-avoid mt-6 pt-4 border-t border-slate-300">
          <div className="mb-4 text-[10px] text-slate-500">
            <strong>Observações de Campo / Avarias / Quebras:</strong>
            <div className="border-b border-slate-300 h-6 mt-1"></div>
            <div className="border-b border-slate-300 h-6"></div>
          </div>

          <div className="grid grid-cols-2 gap-12 mt-8 text-center text-xs">
            <div>
              <div className="border-t border-slate-800 pt-1 font-bold uppercase">
                Assinatura do Conferente (Enfermagem / Farmácia)
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Nome legível e Matrícula / Registro
              </div>
            </div>
            <div>
              <div className="border-t border-slate-800 pt-1 font-bold uppercase">
                Farmacêutico(a) Responsável Técnico
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Visto e Homologação do Balanço
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
