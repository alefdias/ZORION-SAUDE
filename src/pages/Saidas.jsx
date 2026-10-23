import { normalizeSearch } from "@/utils/searchUtils";
import { useState, useRef, useEffect, useMemo } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
    Plus, Search, PackageMinus, Trash2, FileText, Printer, Edit, 
    AlertTriangle, Settings2, Boxes,
    Calendar as CalendarIcon, User, Building2, ArrowDownRight, X, Sparkles, Clock, CheckCircle2, ShieldAlert
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { safeFormatDate } from "@/utils/dateUtils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";
import { calcularLotesSatelite } from "@/utils/sateliteLoteUtils";
import SaidaForm from "@/components/forms/SaidaForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useSearchParams } from "react-router-dom";

export default function Saidas({ isTab = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [preselectedMedId, setPreselectedMedId] = useState(null);
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [displayCount, setDisplayCount] = useState(50);
  const [activeCategory, setActiveCategory] = useState("disponiveis_satelite"); // "disponiveis_satelite", "todos", "pacientes", "geral", "perdas"

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(50);
  }, [search, dateRange, activeCategory]);

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setFormOpen(true);
      // Remove 'action' from URL so it doesn't re-open on refresh
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [visibleColumns, setVisibleColumns] = useState({
    codigo: true,
    medicamento: true,
    lote: true,
    dataSaida: true,
    qtd: true,
    ala: true,
    paciente: true,
    observacao: true,
    acoes: true
  });
  const printRef = useRef();

  const queryClient = useQueryClient();

  const { data: saidas = [], isLoading } = useQuery({
    queryKey: ['saidas'],
    queryFn: () => db.entities.Saida.list('-created_date'),
  });

  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: alas = [] } = useQuery({
    queryKey: ['alas'],
    queryFn: () => db.entities.Ala.list(),
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const { data: transferencias = [] } = useQuery({
    queryKey: ['transferencias_pendentes'],
    queryFn: () => db.entities.TransferenciaPendente.list(),
  });

  const { data: pedidosSatelite = [] } = useQuery({
    queryKey: ['pedidos_satelite'],
    queryFn: () => db.entities.PedidoSatelite.list(),
  });

  const createSaidaMutation = useMutation({
    mutationFn: async (data) => {
      const { itens, ...commonData } = data;
      const createdSaidas = [];

      // Validar obrigatoriedade de Ala e Paciente
      if (!commonData.ala_nome || !commonData.ala_nome.trim()) {
        throw new Error("A Ala / Setor de Destino é obrigatória para registrar a dispensação.");
      }
      if (!commonData.paciente_nome || !commonData.paciente_nome.trim()) {
        throw new Error("O Nome do Paciente é obrigatório. Não é permitido dispensar sem identificar o paciente.");
      }
      
      // Validar se há estoque suficiente na Farmácia Satélite para todos os itens primeiro
      for (const item of itens) {
        const medicamento = medicamentos.find(m => m.id === item.medicamento_id);
        const atualSatelite = medicamento ? (medicamento.estoque_satelite || 0) : 0;
        if (atualSatelite < item.quantidade) {
          throw new Error(`Estoque insuficiente na Farmácia Satélite para: ${item.medicamento_nome}. (Saldo disponível: ${atualSatelite})`);
        }
      }

      let responsavel = "Farmacêutico";
      let responsavelCrf = "";
      try {
        const rawU = localStorage.getItem("pharma_user");
        if (rawU) {
          const u = JSON.parse(rawU);
          responsavel = u.full_name || u.nome || u.login || "Farmacêutico";
          responsavelCrf = u.crf || "";
        }
      } catch (e) {}

      const pacNomeLimpo = commonData.paciente_nome.trim();
      const alaNomeLimpa = commonData.ala_nome.trim();

      for (const item of itens) {
        const saidaData = {
          ...commonData,
          medicamento_id: item.medicamento_id,
          medicamento_nome: item.medicamento_nome,
          lote_id: item.lote_id,
          numero_lote: item.numero_lote,
          quantidade: item.quantidade,
          paciente_id: commonData.paciente_id || null,
          paciente_nome: pacNomeLimpo,
          ala_id: commonData.ala_id || null,
          ala_nome: alaNomeLimpa,
          destino: commonData.destino || `Paciente: ${pacNomeLimpo} (${alaNomeLimpa})`,
          motivo: commonData.motivo || `Dispensação Paciente: ${pacNomeLimpo}`,
          responsavel: commonData.responsavel || responsavel,
          responsavel_crf: commonData.responsavel_crf || responsavelCrf,
          usuario_nome: responsavel
        };
        
        // 1. Criar a saída
        const saida = await db.entities.Saida.create(saidaData);
        createdSaidas.push(saida);

        // Registrar na trilha de auditoria
        await db.logAction(
          "BAIXA_MANUAL_ESTOQUE",
          "Saida",
          saida?.id || item.medicamento_id,
          `Baixa manual de ${item.quantidade} un do medicamento '${item.medicamento_nome}' (Lote: ${item.numero_lote || 'N/I'}). Destino: ${saidaData.destino || 'Não especificado'}, Motivo: ${saidaData.motivo || 'Manual'}`
        );

        // 3. Atualizar estoque do medicamento (Apenas Satélite)
        const medicamento = medicamentos.find(m => m.id === saidaData.medicamento_id);
        if (medicamento) {
          await db.entities.Medicamento.update(medicamento.id, {
            estoque_satelite: Math.max(0, (medicamento.estoque_satelite || 0) - saidaData.quantidade),
          });
        }

        // 4. Atualizar quantidade_satelite do lote correspondente se houver lote vinculado
        const loteId = saidaData.lote_id;
        if (loteId) {
          const loteObj = (lotes || []).find(l => String(l.id) === String(loteId));
          if (loteObj) {
            const novaQtdSat = Math.max(0, (Number(loteObj.quantidade_satelite) || 0) - saidaData.quantidade);
            await db.entities.Lote.update(loteId, { quantidade_satelite: novaQtdSat });
          }
        }
      }
      return createdSaidas;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      setFormOpen(false);
      toast.success("Saída(s) registrada(s) com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao registrar saída:", error);
      toast.error("Erro ao registrar saída: " + (error.message || error));
    }
  });

  const deleteSaidaMutation = useMutation({
    mutationFn: async (saida) => {
      // 1. Reverter estoque do medicamento (Apenas Satélite)
      const medId = saida.medicamento_id || saida.medicamentoId;
      const medicamento = medicamentos.find(m => String(m.id) === String(medId));
      if (medicamento) {
        await db.entities.Medicamento.update(medicamento.id, {
          estoque_satelite: (medicamento.estoque_satelite || 0) + (Number(saida.quantidade) || 0),
        });
      }

      // 2. Reverter saldo do lote físico se houver lote vinculado
      const loteId = saida.lote_id || saida.loteId;
      if (loteId) {
        const loteObj = (lotes || []).find(l => String(l.id) === String(loteId));
        if (loteObj) {
          const novoSaldo = (Number(loteObj.quantidade_atual) || 0) + (Number(saida.quantidade) || 0);
          await db.entities.Lote.update(loteObj.id, {
            quantidade_atual: novoSaldo,
            status: "ativo"
          });
        }
      }

      // 3. Deletar a saída no banco de dados
      await db.entities.Saida.delete(saida.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      setDeleteId(null);
      toast.success("Dispensação deletada e estoque estornado com sucesso!");
    },
    onError: (err) => {
      toast.error("Erro ao deletar saída: " + (err.message || err));
    },
  });


  const updateSaidaMutation = useMutation({
    mutationFn: async (data) => {
      // Na edição de Saída, sempre editamos 1 item de cada vez
      const editedItem = data.itens[0]; // Em modo edição o array sempre tem 1 elemento
      const updateData = {
          ...data,
          medicamento_id: editedItem.medicamento_id,
          medicamento_nome: editedItem.medicamento_nome,
          lote_id: editedItem.lote_id,
          numero_lote: editedItem.numero_lote,
          quantidade: editedItem.quantidade
      };
      delete updateData.itens; // limpa o array pra não ir pro banco

      const oldSaida = saidas.find(s => s.id === updateData.id);
      if (!oldSaida) throw new Error("Saída não encontrada");

      if (oldSaida.medicamento_id !== updateData.medicamento_id || oldSaida.lote_id !== updateData.lote_id) {
        const oldMed = medicamentos.find(m => m.id === oldSaida.medicamento_id);
        if (oldMed) {
          await db.entities.Medicamento.update(oldMed.id, {
            estoque_satelite: (oldMed.estoque_satelite || 0) + oldSaida.quantidade,
          });
        }

        const newMed = medicamentos.find(m => m.id === updateData.medicamento_id);
        if (newMed) {
          await db.entities.Medicamento.update(newMed.id, {
            estoque_satelite: Math.max(0, (newMed.estoque_satelite || 0) - updateData.quantidade), 
          });
        }
      } else {
        const diff = updateData.quantidade - oldSaida.quantidade; 
        if (diff !== 0) {
          const med = medicamentos.find(m => m.id === updateData.medicamento_id);
          if (med) {
            await db.entities.Medicamento.update(med.id, {
              estoque_satelite: Math.max(0, (med.estoque_satelite || 0) - diff)
            });
          }
        }
      }

      return db.entities.Saida.update(updateData.id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      setFormOpen(false);
      setEditData(null);
      toast.success("Saída atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar saída: " + (error.message || error));
    }
  });

  const handleSave = (data) => {
    if (editData) {
      updateSaidaMutation.mutate(data);
    } else {
      createSaidaMutation.mutate(data);
    }
  };

  const handleEdit = (saida) => {
    setEditData(saida);
    setFormOpen(true);
  };

  const handleDelete = () => {
    const saida = saidas.find(s => s.id === deleteId);
    if (saida) {
      deleteSaidaMutation.mutate(saida);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    try {
      toast.loading("Gerando PDF...");
      const element = printRef.current;
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`relatorio-saidas-${format(new Date(), "dd-MM-yyyy")}.pdf`);
      toast.dismiss();
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao gerar PDF");
    }
  };



  const medicamentosMap = useMemo(() => {
    const map = {};
    medicamentos.forEach(m => {
      map[m.id] = m;
    });
    return map;
  }, [medicamentos]);

  // Medicamentos com saldo ativo na Farmácia Satélite
  const medicamentosSatelite = useMemo(() => {
    return (medicamentos || [])
      .filter(m => m.ativo !== false && !m.deleted_at && (Number(m.estoque_satelite) || 0) > 0)
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [medicamentos]);

  const totalUnidadesSatelite = useMemo(() => {
    return medicamentosSatelite.reduce((acc, m) => acc + (Number(m.estoque_satelite) || 0), 0);
  }, [medicamentosSatelite]);

  const filteredMedicamentosSatelite = useMemo(() => {
    if (!search || !search.trim()) return medicamentosSatelite;
    const term = normalizeSearch(search);
    const terms = term.split(/\s+/).filter(Boolean);
    return medicamentosSatelite.filter(m => {
      const fullText = normalizeSearch(`${m.nome || ""} ${m.codigo || ""} ${m.concentracao || ""} ${m.apresentacao || ""} ${m.unidade_medida || ""}`);
      return terms.every(t => fullText.includes(t));
    });
  }, [medicamentosSatelite, search]);

  // Lotes que comprovadamente possuem saldo na Farmácia Satélite
  const lotesSateliteByMedId = useMemo(() => {
    const map = {};
    (medicamentosSatelite || []).forEach(med => {
      map[med.id] = calcularLotesSatelite({
        medId: med.id,
        medCodigo: med.codigo,
        medNome: med.nome,
        saldoTotalSat: med.estoque_satelite,
        lotes,
        transferencias,
        pedidosSatelite,
        saidas,
      });
    });
    return map;
  }, [medicamentosSatelite, lotes, transferencias, pedidosSatelite, saidas]);

  const counts = useMemo(() => {
    let todos = 0, pacientes = 0, geral = 0, perdas = 0, totalUnidades = 0;
    (saidas || []).forEach(s => {
      if (s.motivo === "Transferência de Estoque") return;
      const isLog = (s.medicamento_nome && s.medicamento_nome.includes("[LOG")) || (s.tipo && s.tipo.includes("Log"));
      if (isLog) return; // Logs são exibidos exclusivamente no painel RT

      todos++;
      totalUnidades += (Number(s.quantidade) || 0);
      const isPac = !!s.paciente_nome || (s.destino && s.destino.toLowerCase().includes("paciente")) || (s.motivo && s.motivo.toLowerCase().includes("paciente")) || (s.tipo && s.tipo.toLowerCase().includes("paciente"));
      const isPerda = s.destino === "Perda" || (s.motivo && s.motivo.toLowerCase().includes("perda"));

      if (isPerda) perdas++;
      else if (isPac) pacientes++;
      else geral++;
    });
    return { todos, pacientes, geral, perdas, totalUnidades };
  }, [saidas]);

  const filteredSaidas = useMemo(() => {
    return (saidas || []).filter(s => {
    const searchLow = (search || "").trim().toLowerCase();
    
    // Omitir logs de auditoria (exibidos exclusivamente no painel RT)
    const isLog = (s.medicamento_nome && s.medicamento_nome.includes("[LOG")) || (s.tipo && s.tipo.includes("Log"));
    if (isLog) return false;

    // Filtro por termo de busca
    const matchesSearch = !searchLow ||
      (s.medicamento_nome?.toLowerCase().includes(searchLow)) ||
      (s.numero_lote?.toLowerCase().includes(searchLow)) ||
      (s.paciente_nome?.toLowerCase().includes(searchLow)) ||
      (s.ala_nome?.toLowerCase().includes(searchLow)) ||
      (s.motivo?.toLowerCase().includes(searchLow)) ||
      (s.tipo?.toLowerCase().includes(searchLow));
    
    // Filtro por data
    let matchesDate = true;
    if (dateRange?.from) {
      const saidaDateStr = s.data_saida?.split('T')[0];
      const saidaDate = parseISO(saidaDateStr);
      
      const from = startOfDay(dateRange.from);
      const to = dateRange.to ? dateRange.to : startOfDay(dateRange.from);
      
      matchesDate = saidaDate.getTime() >= from.getTime() && saidaDate.getTime() <= (to.getTime() + 86400000);
    }

    // Ignore transferências de estoque
    const isNotTransferencia = s.motivo !== "Transferência de Estoque";

    // Filtro por Categoria (Abas)
    let matchesCategory = true;
    const isPac = !!s.paciente_nome || (s.destino && s.destino.toLowerCase().includes("paciente")) || (s.motivo && s.motivo.toLowerCase().includes("paciente")) || (s.tipo && s.tipo.toLowerCase().includes("paciente"));
    const isPerda = s.destino === "Perda" || (s.motivo && s.motivo.toLowerCase().includes("perda"));

    if (activeCategory === "pacientes") {
      matchesCategory = isPac && !isPerda;
    } else if (activeCategory === "geral") {
      matchesCategory = !isPac && !isPerda;
    } else if (activeCategory === "perdas") {
      matchesCategory = isPerda;
    }

    return matchesSearch && matchesDate && isNotTransferencia && matchesCategory;
  }).sort((a, b) => {
    // 1. Prioridade máxima: O que foi gravado agora (created_at)
    const creatA = a.created_at || "";
    const creatB = b.created_at || "";
    if (creatA !== creatB) return creatB.localeCompare(creatA);

    // 2. Data do movimento
    const dateA = a.data_saida || "";
    const dateB = b.data_saida || "";
    if (dateA !== dateB) return dateB.localeCompare(dateA);

    return (b.id || "").localeCompare(a.id || "");
  });
  }, [saidas, search, dateRange, activeCategory]);

  const observer = useRef();
  const lastElementRef = (node) => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      const currentListLength = activeCategory === "disponiveis_satelite" ? filteredMedicamentosSatelite.length : filteredSaidas.length;
      if (entries[0].isIntersecting && displayCount < currentListLength) {
        setDisplayCount(prev => prev + 50);
      }
    });
    if (node) observer.current.observe(node);
  };

  const reportContent = (
    <>
      <div className="text-center mb-8 pb-6 border-b-2 border-blue-600">
        <div className="flex justify-between items-center mb-4">
          <div className="text-left">
            <p className="text-blue-600 font-bold text-xl uppercase tracking-tight">ZORION SAÚDE</p>
            <p className="text-slate-500 text-xs">Sistema de Controle Farmacêutico</p>
          </div>
          <div className="text-right text-[10px] text-slate-400 font-mono">
            <p>Gerado em:</p>
            <p>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-1 uppercase tracking-widest">Relatório de Saídas</h1>
        <p className="text-slate-500 text-sm font-medium">Registro Cronológico de Dispensação de Medicamentos</p>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border border-slate-200 rounded-lg p-4 bg-blue-50">
            <p className="text-xs font-medium text-slate-600 mb-2">Total de Saídas</p>
            <p className="text-2xl font-bold text-blue-700">{filteredSaidas.length}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4 bg-red-50">
            <p className="text-xs font-medium text-slate-600 mb-2">Quantidade Total</p>
            <p className="text-2xl font-bold text-red-700">
              {filteredSaidas.reduce((sum, s) => sum + (s.quantidade || 0), 0).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        <table className="w-full border-collapse border border-slate-300">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Data</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Cód.</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Medicamento</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Lote</th>
              <th className="text-center py-2 px-3 text-xs font-semibold border border-blue-600">Qtd</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Ala</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Observação</th>
            </tr>
          </thead>
          <tbody>
            {filteredSaidas.map((saida, idx) => {
              const med = medicamentosMap[saida.medicamento_id];
              return (
                <tr key={saida.id} className={idx % 2 === 0 ? "bg-slate-50/50" : "bg-white"}>
                  <td className="py-2 px-3 border border-slate-200 text-sm">
                    {safeFormatDate(saida.data_saida)}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-[10px] font-mono whitespace-nowrap">
                    {med?.codigo || "S/C"}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-sm font-medium">
                    <div>{saida.medicamento_nome}</div>
                    {(med?.concentracao || med?.apresentacao) && (
                      <div className="text-xs text-slate-500 font-normal">
                        {med?.concentracao ? med.concentracao : (med?.unidade_medida || "")}
                        {med?.concentracao && med?.apresentacao ? ` • ${med.apresentacao}` : (med?.apresentacao || "")}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-sm">{saida.numero_lote}</td>
                  <td className="py-2 px-3 border border-slate-200 text-center font-bold text-red-700 text-sm">
                    -{saida.quantidade}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-sm">{saida.ala_nome || "-"}</td>
                  <td className="py-2 px-3 border border-slate-200 text-xs text-slate-500">{saida.observacao || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-12 pt-6 border-t-2 border-slate-300">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-sm text-slate-600 mb-12">Responsável pela Farmácia:</p>
            <div className="border-t-2 border-slate-400 pt-2">
              <p className="text-xs text-slate-500">Assinatura e Carimbo</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-12">Farmacêutico Responsável:</p>
            <div className="border-t-2 border-slate-400 pt-2">
              <p className="text-xs text-slate-500">Assinatura e CRF</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <Button 
        onClick={() => setReportOpen(true)} 
        variant="outline" 
        className="h-9 text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs gap-1.5"
      >
        <FileText className="w-3.5 h-3.5 text-slate-500" />
        Relatório
      </Button>
      <Button 
        onClick={() => { setEditData(null); setPreselectedMedId(null); setFormOpen(true); }} 
        className="h-9 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 gap-1.5"
      >
        <Plus className="w-4 h-4" />
        Nova Saída
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-9 text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs ml-auto gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            Colunas
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-white shadow-lg border-slate-200">
          {Object.keys(visibleColumns).map((col) => (
            <DropdownMenuCheckboxItem
              key={col}
              className="text-xs capitalize"
              checked={visibleColumns[col]}
              onCheckedChange={(checked) =>
                setVisibleColumns((prev) => ({ ...prev, [col]: checked }))
              }
            >
              {col === "codigo" ? "Cód." :
                col === "dataSaida" ? "Data Saída" :
                  col === "qtd" ? "Quantidade" :
                    col === "observacao" ? "Observação" :
                      col === "paciente" ? "Paciente" :
                        col === "acoes" ? "Ações" : col}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className={cn("p-6 space-y-4 h-[calc(100vh)] overflow-hidden flex flex-col", isTab && "p-4 h-[calc(100vh-140px)]")}>      
      {/* Header */}
      {!isTab ? (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <PackageMinus className="w-6 h-6 text-blue-600" />
              Saídas & Dispensação
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-0.5">
              Registro, baixa de estoque e dispensação de medicamentos na Farmácia Satélite
            </p>
          </div>
          {actionButtons}
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <PackageMinus className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-sm text-slate-800">Saídas da Farmácia Satélite</span>
          </div>
          {actionButtons}
        </div>
      )}

      {/* KPI Stats Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 0: Saldo Disponível na Satélite */}
        <div 
          onClick={() => setActiveCategory("disponiveis_satelite")}
          className={cn(
            "p-3 rounded-xl border shadow-xs flex items-center justify-between cursor-pointer transition-all",
            activeCategory === "disponiveis_satelite"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200/80 hover:border-emerald-300"
          )}
        >
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Saldo na Satélite</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{medicamentosSatelite.length}</span>
              <span className="text-[10px] text-emerald-600 font-medium">({totalUnidadesSatelite} un)</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600">
            <Boxes className="w-4 h-4" />
          </div>
        </div>

        {/* Card 1: Total Saídas */}
        <div 
          onClick={() => setActiveCategory("todos")}
          className={cn(
            "p-3 rounded-xl border shadow-xs flex items-center justify-between cursor-pointer transition-all",
            activeCategory === "todos"
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 ring-2 ring-blue-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200/80 hover:border-blue-300"
          )}
        >
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Dispensado</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-slate-800 dark:text-white">{counts.todos}</span>
              <span className="text-[10px] text-slate-400 font-medium">({counts.totalUnidades} un)</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
            <PackageMinus className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Saídas por Pacientes */}
        <div 
          onClick={() => setActiveCategory("pacientes")}
          className={cn(
            "p-3 rounded-xl border shadow-xs flex items-center justify-between cursor-pointer transition-all",
            activeCategory === "pacientes"
              ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200/80 hover:border-indigo-300"
          )}
        >
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Por Pacientes</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">{counts.pacientes}</span>
              <span className="text-[10px] text-slate-400 font-medium">leitos / alas</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600">
            <User className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Saídas Gerais / Avulsas */}
        <div 
          onClick={() => setActiveCategory("geral")}
          className={cn(
            "p-3 rounded-xl border shadow-xs flex items-center justify-between cursor-pointer transition-all",
            activeCategory === "geral"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200/80 hover:border-emerald-300"
          )}
        >
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gerais / Avulsas</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{counts.geral}</span>
              <span className="text-[10px] text-slate-400 font-medium">setores internos</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
            <Building2 className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Histórico de Perdas */}
        <div 
          onClick={() => setActiveCategory("perdas")}
          className={cn(
            "p-3 rounded-xl border shadow-xs flex items-center justify-between cursor-pointer transition-all",
            activeCategory === "perdas"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-400 ring-2 ring-rose-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200/80 hover:border-rose-300"
          )}
        >
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Perdas & Descartes</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400">{counts.perdas}</span>
              <span className="text-[10px] text-slate-400 font-medium">avarias / quebras</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/80">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("disponiveis_satelite")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "disponiveis_satelite" 
                ? "bg-emerald-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <Boxes className="w-3.5 h-3.5 text-emerald-200" />
            Disponíveis na Satélite
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "disponiveis_satelite" ? "bg-emerald-700 text-emerald-100" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
            )}>
              {medicamentosSatelite.length}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("todos")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "todos" 
                ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs ring-1 ring-slate-200/80" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <PackageMinus className="w-3.5 h-3.5 text-blue-600" />
            Histórico Geral
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "todos" ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-600"
            )}>
              {counts.todos}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("pacientes")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "pacientes" 
                ? "bg-indigo-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <User className="w-3.5 h-3.5 text-indigo-300" />
            Por Pacientes
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "pacientes" ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 text-slate-600"
            )}>
              {counts.pacientes}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("geral")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "geral" 
                ? "bg-emerald-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-300" />
            Gerais / Setores
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "geral" ? "bg-emerald-700 text-emerald-100" : "bg-slate-200 text-slate-600"
            )}>
              {counts.geral}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("perdas")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "perdas" 
                ? "bg-rose-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
            Perdas
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "perdas" ? "bg-rose-700 text-rose-100" : "bg-slate-200 text-slate-600"
            )}>
              {counts.perdas}
            </span>
          </Button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {activeCategory === "disponiveis_satelite" ? (
            <>Exibindo <strong>{Math.min(filteredMedicamentosSatelite.length, displayCount)}</strong> de <strong>{filteredMedicamentosSatelite.length}</strong> medicamento(s) com saldo na Satélite</>
          ) : (
            <>Exibindo <strong>{Math.min(filteredSaidas.length, displayCount)}</strong> de <strong>{filteredSaidas.length}</strong> registro(s)</>
          )}
        </div>
      </div>

      {/* Search and Date Filter */}
      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder={activeCategory === "disponiveis_satelite" ? "Buscar por medicamento, código ou apresentação disponível na Satélite..." : "Buscar por medicamento, lote, paciente ou ala..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-9 h-9.5 bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:bg-white transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    "w-[230px] justify-start text-left font-normal border-slate-200 dark:border-slate-700 h-9.5 shadow-xs text-xs rounded-lg",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    "Filtrar Período..."
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                />
                <div className="p-2 border-t border-slate-100 flex justify-end">
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-slate-500 hover:text-red-600 font-semibold"
                    onClick={() => {
                        setDateRange({ from: undefined, to: undefined });
                    }}
                   >
                     Limpar Período
                   </Button>
                </div>
              </PopoverContent>
            </Popover>

            {(search || dateRange?.from) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setDateRange({ from: undefined, to: undefined });
                }}
                className="h-9.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex-1 min-h-[300px] overflow-hidden flex flex-col relative">
        <div className="overflow-auto flex-1">
          <Table className="min-w-[1200px] w-full">
            <TableHeader className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
              {activeCategory === "disponiveis_satelite" ? (
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24 text-[11px] font-bold uppercase tracking-wider text-slate-600">Cód.</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Medicamento</TableHead>
                  <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Saldo Satélite</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Lotes Cadastrados</TableHead>
                  <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">Ações</TableHead>
                </TableRow>
              ) : (
                <TableRow className="hover:bg-transparent">
                  {visibleColumns.codigo && <TableHead className="w-20 text-[11px] font-bold uppercase tracking-wider text-slate-600">Cód.</TableHead>}
                  {visibleColumns.medicamento && <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Medicamento</TableHead>}
                  {visibleColumns.lote && <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Lote</TableHead>}
                  {visibleColumns.dataSaida && <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Data Saída</TableHead>}
                  {visibleColumns.qtd && <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">Qtd</TableHead>}
                  {visibleColumns.ala && <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Ala / Destino</TableHead>}
                  {visibleColumns.paciente && <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Paciente</TableHead>}
                  {visibleColumns.observacao && <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Observação / Motivo</TableHead>}
                  {visibleColumns.acoes && <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">Ações</TableHead>}
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(7).fill(0).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : activeCategory === "disponiveis_satelite" ? (
                filteredMedicamentosSatelite.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3.5 ring-8 ring-emerald-50/50 dark:ring-emerald-950/20">
                          <Boxes className="w-7 h-7" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Nenhum item com saldo na Farmácia Satélite</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                          {search
                            ? "Nenhum medicamento encontrado para o termo pesquisado."
                            : "Atualmente não há medicamentos com saldo positivo na Farmácia Satélite."}
                        </p>
                        {search && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSearch("")}
                            className="text-xs font-semibold"
                          >
                            Limpar Busca
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMedicamentosSatelite.slice(0, displayCount).map((med, index) => {
                    const isLastElement = index === Math.min(filteredMedicamentosSatelite.length, displayCount) - 1;
                    const mav = isMav(med.nome);
                    const p344 = isPsicotropico(med.grupo_terapeutico);
                    const medLotes = lotesSateliteByMedId[med.id] || [];
                    const loteFefo = medLotes[0];

                    return (
                      <TableRow 
                        ref={isLastElement ? lastElementRef : null} 
                        key={med.id} 
                        className="hover:bg-emerald-50/40 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/60"
                      >
                        <TableCell>
                          <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {med.codigo || "S/C"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn("font-bold text-xs text-slate-800 dark:text-slate-100", mav && "text-red-700 dark:text-red-400")}>
                              {med.nome}
                            </span>
                            {mav && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-red-100 text-red-700 border border-red-200">
                                <AlertTriangle className="w-2.5 h-2.5" /> MAV
                              </span>
                            )}
                            {p344 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200">
                                <ShieldAlert className="w-2.5 h-2.5" /> P344
                              </span>
                            )}
                            {med.is_adiantamento && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 font-semibold px-1.5 py-0.2 rounded">
                                💳 Adiantamento
                              </span>
                            )}
                          </div>
                          {(med.concentracao || med.unidade_medida || med.apresentacao) && (
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-medium">
                              {(med.concentracao || med.unidade_medida) && <span>{med.concentracao || med.unidade_medida}</span>}
                              {(med.concentracao || med.unidade_medida) && med.apresentacao && <span>•</span>}
                              {med.apresentacao && <span>{med.apresentacao}</span>}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                            {med.estoque_satelite || 0} {med.unidade_medida || "un"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {loteFefo ? (
                            <div className="text-xs flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded text-[11px] font-bold">
                                {loteFefo.numero_lote}
                              </span>
                              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/60 px-1 rounded">
                                ({loteFefo.saldoSatelite} un)
                              </span>
                              {loteFefo.data_validade && (
                                <span className="text-[10px] text-slate-500">
                                  (Val: {safeFormatDate(loteFefo.data_validade)})
                                </span>
                              )}
                              {medLotes.length > 1 && (
                                <span className="ml-1 text-[10px] text-slate-400 font-medium">
                                  +{medLotes.length - 1} lote(s)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sem lote específico na Satélite</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditData(null);
                              setPreselectedMedId(med.id);
                              setFormOpen(true);
                            }}
                            className="h-8 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs gap-1.5"
                          >
                            <PackageMinus className="w-3.5 h-3.5" />
                            Dar Saída
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )
              ) : filteredSaidas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3.5 ring-8 ring-blue-50/50 dark:ring-blue-950/20">
                        <PackageMinus className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Nenhuma saída encontrada</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        {search || dateRange?.from 
                          ? "Não foram encontrados registros para os filtros selecionados." 
                          : "Nenhuma saída de medicamento foi registrada ainda nesta categoria."}
                      </p>
                      {search || dateRange?.from ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => { setSearch(""); setDateRange({ from: undefined, to: undefined }); }}
                          className="text-xs font-semibold"
                        >
                          Limpar Filtros
                        </Button>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={() => { setEditData(null); setFormOpen(true); }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 gap-1.5 h-8"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Registrar Nova Saída
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSaidas.slice(0, displayCount).map((saida, index) => {
                  const isLastElement = index === Math.min(filteredSaidas.length, displayCount) - 1;
                  const med = medicamentosMap[saida.medicamento_id];
                  const mav = isMav(saida.medicamento_nome);
                  const p344 = med && isPsicotropico(med.grupo_terapeutico);

                  return (
                    <TableRow 
                      ref={isLastElement ? lastElementRef : null} 
                      key={saida.id} 
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/60"
                    >
                      {visibleColumns.codigo && (
                        <TableCell>
                          <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {med?.codigo || "S/C"}
                          </span>
                        </TableCell>
                      )}
                      {visibleColumns.medicamento && (
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn("font-bold text-xs text-slate-800 dark:text-slate-100", mav && "text-red-700 dark:text-red-400")}>
                              {saida.medicamento_nome}
                            </span>
                            {mav && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-red-100 text-red-700 border border-red-200">
                                <AlertTriangle className="w-2.5 h-2.5" /> MAV
                              </span>
                            )}
                            {p344 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200">
                                <ShieldAlert className="w-2.5 h-2.5" /> P344
                              </span>
                            )}
                          </div>
                          {(med?.concentracao || med?.unidade_medida || med?.apresentacao) && (
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-medium">
                              {(med?.concentracao || med?.unidade_medida) && <span>{med?.concentracao || med?.unidade_medida}</span>}
                              {(med?.concentracao || med?.unidade_medida) && med?.apresentacao && <span>•</span>}
                              {med?.apresentacao && <span>{med.apresentacao}</span>}
                            </div>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.lote && (
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {saida.numero_lote || "-"}
                          </span>
                        </TableCell>
                      )}
                      {visibleColumns.dataSaida && (
                        <TableCell className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {saida.data_saida && safeFormatDate(saida.data_saida)}
                        </TableCell>
                      )}
                      {visibleColumns.qtd && (
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 px-2.5 py-0.5 rounded-full">
                            <ArrowDownRight className="w-3 h-3 text-rose-600" />
                            {saida.quantidade} un
                          </span>
                        </TableCell>
                      )}
                      {visibleColumns.ala && (
                        <TableCell>
                          {saida.ala_nome ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-semibold">
                              {saida.ala_nome}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.paciente && (
                        <TableCell>
                          {saida.paciente_nome ? (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase max-w-[220px] truncate">
                              <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">{saida.paciente_nome}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.observacao && (
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                          {saida.observacao || saida.motivo || "—"}
                        </TableCell>
                      )}
                      {visibleColumns.acoes && (
                        <TableCell className="text-center">
                          <div className="flex justify-center items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar saída"
                              onClick={() => handleEdit(saida)}
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir saída"
                              onClick={() => setDeleteId(saida.id)}
                              className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {((activeCategory === "disponiveis_satelite" ? filteredMedicamentosSatelite.length : filteredSaidas.length) > displayCount) && (
          <div className="py-2 text-center text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80">
            Carregando mais itens ao rolar...
          </div>
        )}
      </div>

      {/* Form Modal */}
      <SaidaForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditData(null); setPreselectedMedId(null); }}
        onSave={handleSave}
        initialData={editData}
        initialMedId={preselectedMedId}
        medicamentos={medicamentos}
        lotes={lotes}
        alas={alas}
        isLoading={createSaidaMutation.isPending || updateSaidaMutation.isPending}
      />


      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta saída? Esta ação reverterá o estoque e não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório de Saídas</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 mb-4 no-print">
            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={handleExportPDF} className="bg-red-600 hover:bg-red-700" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </div>

          <div ref={printRef} className="bg-white p-8">
            {reportContent}
          </div>
        </DialogContent>
      </Dialog>

      <div id="print-area" className="hidden print:block print-only bg-white p-8">
        {reportContent}
      </div>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body { 
            print-color-adjust: exact; 
            -webkit-print-color-adjust: exact; 
            background-color: white !important;
          }
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
          }
          
          .no-print, nav, header, footer, button, .sonner-toaster, [data-radix-portal] { display: none !important; }
          .p-6 { padding: 0 !important; }
          
          .bg-white { border: none !important; padding: 0 !important; }
          
          table { 
            width: 100% !important;
            page-break-inside: auto;
            border-collapse: collapse !important;
          }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          
          h1, h2, h3 { 
            page-break-after: avoid; 
            color: black !important;
          }
          
          .border-b-2.border-blue-600 {
            border-bottom-color: #2563eb !important;
            border-bottom-width: 2px !important;
          }
          
          .bg-blue-50 { background-color: #eff6ff !important; }
          .bg-red-50 { background-color: #fef2f2 !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          
          .text-blue-600 { color: #2563eb !important; }
          .text-blue-700 { color: #1d4ed8 !important; }
          .text-red-700 { color: #b91c1c !important; }
        }
      `}</style>
    </div>
  );
}
