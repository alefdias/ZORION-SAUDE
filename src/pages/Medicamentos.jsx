import { useState } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Package, Printer, Settings2, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";
import MedicamentoForm from "@/components/forms/MedicamentoForm";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const GRUPO_LABELS = {
  analgesico: "Analgésico",
  antitermico: "Antitérmico",
  anti_inflamatorio: "Anti-inflamatório",
  antibiotico: "Antibiótico",
  antialergico: "Antialérgico",
  antihipertensivo: "Antihipertensivo",
  antidiabetico: "Antidiabético",
  controlado: "Controlado",
  psicotropico: "Psicotrópico",
  hormonio: "Hormônio",
};

const APRESENTACAO_LABELS = {
  comprimido: "Comprimido",
  capsula: "Cápsula",
  gotas: "Gotas",
  xarope: "Xarope",
  injetavel: "Injetável",
  pomada: "Pomada",
  creme: "Creme",
  spray: "Spray",
  supositorio: "Supositório",
  envelope: "Envelope",
  shampoo: "Shampoo",
  ampola: "Ampola",
  tubo: "Tubo",
  frasco: "Frasco",
  seringa: "Seringa",
  sache: "Sachê",
};

export function getApresentacaoEConcentracao(med) {
  if (!med) return { apresentacao: "-", concentracao: "-" };

  const apresentacao = (med.apresentacao || "-").trim();
  const concentracao = (med.concentracao || med.unidade_medida || "-").trim();

  return {
    apresentacao: apresentacao || "-",
    concentracao: (concentracao && !["un", "unidade", "unid", "-", ""].includes(concentracao.toLowerCase())) ? concentracao : "-"
  };
}

export default function Medicamentos() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("padronizados");
  const [formOpen, setFormOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [visibleColumns, setVisibleColumns] = useState({
    codigo: true,
    medicamento: true,
    origem: false,
    grupo: false,
    forma: false,
    concentracao: true,
    apresentacao: true,
    via: true,
    grupo_terapeutico: true,
    estoque: true,
    acoes: true
  });

  const queryClient = useQueryClient();

  const { data: medicamentos = [], isLoading } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => db.entities.Medicamento.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      setFormOpen(false);
      toast.success("Medicamento cadastrado com sucesso!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.Medicamento.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      setFormOpen(false);
      setEditingMed(null);
      toast.success("Medicamento atualizado com sucesso!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Medicamento.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      toast.success("Medicamento excluído com sucesso!");
    },
  });

  const handleSave = (data) => {
    if (editingMed) {
      updateMutation.mutate({ id: editingMed.id, data });
    } else {
      createMutation.mutate({ ...data, estoque_atual: 0 });
    }
  };

  const handleEdit = (med) => {
    setEditingMed(med);
    setFormOpen(true);
  };

  const handleDelete = (id) => {
    setDeleteConfirm({ open: true, id });
  };

  const confirmDelete = () => {
    deleteMutation.mutate(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null });
  };

  const filteredMeds = medicamentos.filter(m => {
    // Aba filter
    if (activeTab === "padronizados" && !m.padronizado) return false;
    if (activeTab === "nao_padronizados" && m.padronizado) return false;
    
    // Search filter
    const searchLower = search.toLowerCase();
    const searchableString = [
        m.nome,
        m.principio_ativo,
        m.codigo,
        m.codigo_barras,
        m.grupo_terapeutico,
        m.origem,
        m.grupo_terapeutico,
        m.forma_farmaceutica,
        m.via_administracao,
        m.apresentacao,
        m.concentracao,
        m.antimicrobiano ? "antimicrobiano" : "",
        m.ccih ? "ccih" : "",
        m.portaria_344 ? "portaria 344 port. 344 portaria344" : "",
        (m.alto_risco_mav || m.is_mav) ? "mav alto risco" : ""
    ].filter(Boolean).join(" ").toLowerCase();

    return searchableString.includes(searchLower);
  }).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

  return (
    <div className="p-6 space-y-5 h-[calc(100vh)] overflow-hidden flex flex-col bg-slate-50/50">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Catálogo de Medicamentos</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Gerencie produtos, concentrações e padronização</p>
        </div>
        <div className="flex items-center gap-2.5 no-print">
          <Button variant="outline" onClick={() => window.print()} className="gap-2 border-slate-300 hover:bg-slate-100 text-slate-700 shadow-sm transition-all">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-slate-300 hover:bg-slate-100 text-slate-700 shadow-sm transition-all gap-2">
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Colunas</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {Object.keys(visibleColumns).map((col) => (
                <DropdownMenuCheckboxItem
                  key={col}
                  className="capitalize cursor-pointer"
                  checked={visibleColumns[col]}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, [col]: checked }))
                  }
                >
                  {col === "codigo" ? "Cód." :
                    col === "apresentacao" ? "Apresentação" :
                      col === "grupo_terapeutico" ? "Grupo Terapêutico" :
                        col === "grupo" ? "Grupo Antigo" :
                          col === "forma" ? "Forma Farmacêutica" :
                            col === "via" ? "Via de Administração" :
                              col === "concentracao" ? "Concentração" :
                                col === "acoes" ? "Ações" : col}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => { setEditingMed(null); setFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 gap-2 transition-all">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline font-semibold">Novo Produto</span>
          </Button>
        </div>
      </div>

      {/* Integrated Toolbar: Search & Tabs */}
      <Card className="p-1.5 border-slate-200 shadow-sm bg-white rounded-xl flex flex-col md:flex-row items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2 md:w-[320px] h-10 bg-slate-100/50 p-1 rounded-lg">
            <TabsTrigger value="padronizados" className="rounded-md font-semibold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 transition-all">
              Padronizados
            </TabsTrigger>
            <TabsTrigger value="nao_padronizados" className="rounded-md font-semibold text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 transition-all">
              Não Padronizados
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full md:w-[350px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Buscar medicamento, princípio ou cód..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-50 border-slate-200 hover:border-slate-300 focus:bg-white transition-colors h-10 rounded-lg text-sm"
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="border border-slate-200 shadow-sm relative h-[calc(100vh-230px)] rounded-xl overflow-hidden bg-white">
        <Table className="min-w-[1000px] w-full" containerClassName="absolute inset-0 border-0">
          <TableHeader className="sticky top-0 z-20 bg-slate-100/80 backdrop-blur-md border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
              {visibleColumns.codigo && <TableHead className="w-24 text-xs font-bold text-slate-600 uppercase tracking-wider">Código</TableHead>}
              {visibleColumns.medicamento && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Medicamento</TableHead>}
              {visibleColumns.origem && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Origem</TableHead>}
              {visibleColumns.grupo && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Grupo</TableHead>}
              {visibleColumns.forma && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Forma</TableHead>}
              {visibleColumns.concentracao && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Concentração</TableHead>}
              {visibleColumns.apresentacao && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Apresentação</TableHead>}
              {visibleColumns.via && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Via de Administração</TableHead>}
              {visibleColumns.grupo_terapeutico && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Grupo Terapêutico</TableHead>}
              {visibleColumns.estoque && <TableHead className="text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Estoque</TableHead>}
              {visibleColumns.acoes && <TableHead className="w-16"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : filteredMeds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Nenhum medicamento encontrado</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredMeds.map((med) => (
                <TableRow key={med.id} className="hover:bg-slate-50/50">
                  {visibleColumns.codigo && (
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {med.codigo || "S/C"}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.medicamento && (
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className={cn("font-medium text-slate-800 flex flex-wrap items-center gap-1.5", isMav(med) && "text-red-600 font-bold")}>
                            {med.nome}
                            {(isMav(med) || med.alto_risco_mav || med.is_mav) && <Badge variant="destructive" className="text-[10px] py-0 px-1 ml-1">MAV/Alto Risco</Badge>}
                            {isPsicotropico(med.grupo_terapeutico) && <User className="inline-block w-4 h-4 ml-1 text-indigo-600" title="Requer nome do paciente" />}
                            {med.portaria_344 && <Badge className="bg-indigo-600 hover:bg-indigo-700 text-[10px] py-0 px-1 ml-1">Port. 344</Badge>}
                            {med.antimicrobiano && <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px] py-0 px-1 ml-1">Antimicrobiano</Badge>}
                            {med.ccih && <Badge className="bg-orange-600 hover:bg-orange-700 text-[10px] py-0 px-1 ml-1">CCIH</Badge>}
                          </p>
                        </div>
                        {med.principio_ativo && (
                          <p className="text-[10px] text-slate-500">{med.principio_ativo}</p>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.origem && (
                    <TableCell className="text-slate-600 text-xs uppercase">{med.origem || "-"}</TableCell>
                  )}
                  {visibleColumns.grupo && (
                    <TableCell className="text-slate-600 text-xs">{med.grupo_terapeutico || "-"}</TableCell>
                  )}
                  {visibleColumns.forma && (
                    <TableCell className="text-slate-600 text-xs">{med.forma_farmaceutica || "-"}</TableCell>
                  )}
                  {visibleColumns.concentracao && (
                    <TableCell className="text-slate-800 font-bold font-mono">
                      {getApresentacaoEConcentracao(med).concentracao}
                    </TableCell>
                  )}
                  {visibleColumns.apresentacao && (
                    <TableCell className="text-slate-600 font-medium">
                      {getApresentacaoEConcentracao(med).apresentacao}
                    </TableCell>
                  )}
                  {visibleColumns.via && (
                    <TableCell className="text-slate-600 text-xs">{med.via_administracao || "-"}</TableCell>
                  )}
                  {visibleColumns.grupo_terapeutico && (
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {GRUPO_LABELS[med.grupo_terapeutico] || med.grupo_terapeutico}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.estoque && (
                    <TableCell className="text-center">
                      <Badge
                        className={
                          (med.estoque_atual || 0) <= (med.estoque_minimo || 0)
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }
                      >
                        {med.estoque_atual || 0}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.acoes && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(med)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(med.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <MedicamentoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        medicamento={editingMed}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, id: deleteConfirm.id })}
        title="Excluir Medicamento"
        description="Tem certeza que deseja excluir este medicamento? Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        confirmLabel="Sim, excluir"
      />

      {/* Relatório Oculto para Impressão */}
      <div id="print-area" className="hidden print:block p-8 bg-white text-slate-900 font-sans">
        <div className="border-b-2 border-blue-600 pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black text-blue-950 uppercase tracking-tight">ZORION SAÚDE — RELATÓRIO DE MEDICAMENTOS</h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">ESTOQUE CENTRAL HOSPITALAR • LISTA DE PADRONIZAÇÃO DE MEDICAMENTOS</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Emissão: <span className="font-bold text-slate-800">{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span></p>
            <p>Total de itens: <span className="font-bold text-slate-800">{filteredMeds.length}</span></p>
          </div>
        </div>

        <table className="w-full text-left border-collapse border border-slate-300">
          <thead>
            <tr className="bg-blue-900 text-white text-xs font-bold uppercase tracking-wider">
              <th className="border border-blue-800 py-2 px-3 text-center w-16">Cód</th>
              <th className="border border-blue-800 py-2 px-3">Medicamento / Princípio Ativo</th>
              <th className="border border-blue-800 py-2 px-3">Categoria</th>
              <th className="border border-blue-800 py-2 px-3">Apresentação / Concentração</th>
              <th className="border border-blue-800 py-2 px-3 text-center">Estoque Atual</th>
            </tr>
          </thead>
          <tbody>
            {filteredMeds.map((med, idx) => (
              <tr key={med.id} className={idx % 2 === 0 ? "bg-slate-50/50" : "bg-white"}>
                <td className="border border-slate-200 py-2 px-3 text-[10px] font-mono text-center">
                  {med.codigo || "S/C"}
                </td>
                <td className="border border-slate-200 py-2 px-3 text-sm">
                  <p className={cn("font-bold", isMav(med.nome) && "text-red-900")}>
                    {med.nome} {isMav(med.nome) && "(MAV)"}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase">{med.principio_ativo || ""}</p>
                </td>
                <td className="border border-slate-200 py-2 px-3 text-xs">
                  {GRUPO_LABELS[med.grupo_terapeutico] || med.grupo_terapeutico}
                </td>
                <td className="border border-slate-200 py-2 px-3 text-xs font-medium">
                  {getApresentacaoEConcentracao(med).apresentacao} — <span className="font-bold font-mono">{getApresentacaoEConcentracao(med).concentracao}</span>
                </td>
                <td className="border border-slate-200 py-2 px-3 text-center font-bold text-blue-700 text-sm">
                  {med.estoque_atual || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
          }
          
          .no-print, nav, header, footer, button, [role="combobox"], [role="menu"] { display: none !important; }
          .print-only { display: block !important; }
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
          
          .bg-blue-600 { background-color: #2563eb !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .text-blue-700 { color: #1d4ed8 !important; }
        }
      `}</style>
    </div>
  );
}
