import { useState, useMemo } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  FileSpreadsheet
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import FornecedorForm from "@/components/forms/FornecedorForm";

export default function Fornecedores({ isTab }) {
  const [search, setSearch] = useState("");
  const [filterUf, setFilterUf] = useState("TODAS");
  const [filterSituacao, setFilterSituacao] = useState("TODAS");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [editingForn, setEditingForn] = useState(null);

  const queryClient = useQueryClient();

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => db.entities.Fornecedor.list('nome'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => db.entities.Fornecedor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setFormOpen(false);
      toast.success("Fornecedor cadastrado com sucesso!");
    },
    onError: (err) => {
      toast.error("Erro ao cadastrar fornecedor: " + err.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.Fornecedor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setFormOpen(false);
      setEditingForn(null);
      toast.success("Fornecedor atualizado com sucesso!");
    },
    onError: (err) => {
      toast.error("Erro ao atualizar fornecedor: " + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Fornecedor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success("Fornecedor excluído com sucesso!");
    },
    onError: (err) => {
      toast.error("Erro ao excluir fornecedor: " + err.message);
    }
  });

  const handleSave = (data) => {
    if (editingForn) {
      updateMutation.mutate({ id: editingForn.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (forn) => {
    setEditingForn(forn);
    setFormOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja excluir este fornecedor?")) {
      deleteMutation.mutate(id);
    }
  };

  // Unique list of UFs for filtering
  const availableUfs = useMemo(() => {
    const set = new Set();
    fornecedores.forEach(f => {
      if (f.uf && f.uf.trim()) set.add(f.uf.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [fornecedores]);

  // Filtered List
  const filteredFornecedores = useMemo(() => {
    let list = fornecedores;
    const q = search.trim().toLowerCase();

    if (q) {
      list = list.filter(f =>
        (f.nome || "").toLowerCase().includes(q) ||
        (f.razao_social || "").toLowerCase().includes(q) ||
        (f.cnpj || "").replace(/[^0-9]/g, "").includes(q.replace(/[^0-9]/g, "")) ||
        (f.cnpj || "").toLowerCase().includes(q) ||
        (f.municipio || "").toLowerCase().includes(q) ||
        (f.email || "").toLowerCase().includes(q)
      );
    }

    if (filterUf !== "TODAS") {
      list = list.filter(f => (f.uf || "").toUpperCase() === filterUf);
    }

    if (filterSituacao !== "TODAS") {
      list = list.filter(f => (f.situacao || "ATIVA").toUpperCase() === filterSituacao);
    }

    return list;
  }, [fornecedores, search, filterUf, filterSituacao]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredFornecedores.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedFornecedores = filteredFornecedores.slice(startIndex, startIndex + pageSize);

  // Statistics
  const totalAtivos = useMemo(() => {
    return fornecedores.filter(f => (f.situacao || "ATIVA").toUpperCase() === "ATIVA").length;
  }, [fornecedores]);

  return (
    <div className={isTab ? "p-4 space-y-4" : "p-6 space-y-6 max-w-[1600px] mx-auto"}>
      {/* Header & Metric Cards */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {!isTab ? (
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-7 h-7 text-blue-600" />
              Fornecedores & Distribuidoras
            </h1>
            <p className="text-slate-500 text-sm">
              Base oficial de distribuidoras e fornecedores farmacêuticos (CNAE 4644-3/01)
            </p>
          </div>
        ) : <div />}

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            onClick={() => { setEditingForn(null); setFormOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar Fornecedor
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50/70 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-blue-600">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Fornecedores</p>
              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white mt-0.5">
                {fornecedores.length.toLocaleString('pt-BR')}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50/70 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-emerald-600">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Situação Ativa</p>
              <h3 className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {totalAtivos.toLocaleString('pt-BR')}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50/70 to-white dark:from-slate-800 dark:to-slate-900 border-l-4 border-l-indigo-600">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Estados (UFs)</p>
              <h3 className="text-2xl font-extrabold text-indigo-800 dark:text-indigo-300 mt-0.5">
                {availableUfs.length} Estados
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search Controls */}
      <Card className="p-3.5 border-0 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Buscar por Razão Social, Nome Fantasia, CNPJ, Município ou E-mail..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 bg-slate-50/60 border-slate-200 text-sm rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Filter UF */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">UF:</span>
              <Select
                value={filterUf}
                onValueChange={(val) => { setFilterUf(val); setPage(1); }}
              >
                <SelectTrigger className="w-[120px] bg-slate-50 text-xs font-semibold rounded-xl">
                  <SelectValue placeholder="Todas UFs" />
                </SelectTrigger>
                <SelectContent className="max-h-52">
                  <SelectItem value="TODAS">Todas as UFs</SelectItem>
                  {availableUfs.map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Situacao */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Status:</span>
              <Select
                value={filterSituacao}
                onValueChange={(val) => { setFilterSituacao(val); setPage(1); }}
              >
                <SelectTrigger className="w-[130px] bg-slate-50 text-xs font-semibold rounded-xl">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todos Status</SelectItem>
                  <SelectItem value="ATIVA">Ativos</SelectItem>
                  <SelectItem value="INAPTA">Inaptos</SelectItem>
                  <SelectItem value="SUSPENSA">Suspensos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Page Size */}
            <Select
              value={pageSize.toString()}
              onValueChange={(val) => { setPageSize(Number(val)); setPage(1); }}
            >
              <SelectTrigger className="w-[110px] bg-slate-50 text-xs font-medium rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 / pág</SelectItem>
                <SelectItem value="50">50 / pág</SelectItem>
                <SelectItem value="100">100 / pág</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/60 text-slate-700">
                <TableHead className="font-bold text-xs uppercase tracking-wider">Razão Social / Nome</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">CNPJ</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Município / UF</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Situação</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Contato / Fone</TableHead>
                <TableHead className="w-12 text-center"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(6).fill(0).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedFornecedores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-semibold">Nenhum fornecedor encontrado</p>
                    <p className="text-slate-400 text-xs mt-1">Tente ajustar os termos de busca ou filtros de estado.</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedFornecedores.map((forn) => {
                  const isAtiva = (forn.situacao || "ATIVA").toUpperCase() === "ATIVA";
                  return (
                    <TableRow key={forn.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Nome / Razao Social */}
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100 max-w-md">
                        <div className="font-semibold text-sm leading-snug truncate" title={forn.razao_social || forn.nome}>
                          {forn.razao_social || forn.nome}
                        </div>
                        {forn.nome && forn.razao_social && forn.nome !== forn.razao_social && (
                          <span className="text-xs text-slate-500 block truncate">
                            Fantasia: {forn.nome}
                          </span>
                        )}
                        {forn.cnae && (
                          <span className="inline-block mt-0.5 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                            {forn.cnae.split(" - ")[0] || forn.cnae}
                          </span>
                        )}
                      </TableCell>

                      {/* CNPJ */}
                      <TableCell className="text-slate-700 font-mono text-xs whitespace-nowrap">
                        {forn.cnpj || "-"}
                      </TableCell>

                      {/* Municipio / UF */}
                      <TableCell className="text-slate-600 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{forn.municipio || "-"}</span>
                          {forn.uf && (
                            <Badge variant="outline" className="ml-1 text-[10px] font-bold px-1.5 py-0 h-4 bg-slate-50">
                              {forn.uf}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Situacao */}
                      <TableCell className="text-center whitespace-nowrap">
                        <Badge className={`text-[11px] font-semibold px-2 py-0.5 ${
                          isAtiva 
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200' 
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200 border-rose-200'
                        }`}>
                          {forn.situacao || "ATIVA"}
                        </Badge>
                      </TableCell>

                      {/* Contato / Telefone */}
                      <TableCell className="text-xs text-slate-600">
                        {forn.telefone && (
                          <div className="flex items-center gap-1 text-slate-700 font-medium">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {forn.telefone}
                          </div>
                        )}
                        {forn.email && (
                          <div className="flex items-center gap-1 text-slate-500 truncate max-w-[180px]" title={forn.email}>
                            <Mail className="w-3 h-3 text-slate-400" />
                            {forn.email}
                          </div>
                        )}
                        {!forn.telefone && !forn.email && (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100">
                              <MoreHorizontal className="w-4 h-4 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(forn)}>
                              <Pencil className="w-4 h-4 mr-2 text-blue-600" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(forn.id)}
                              className="text-red-600 focus:text-red-700"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Exibindo{" "}
            <strong className="text-slate-800">
              {filteredFornecedores.length > 0 ? startIndex + 1 : 0}
            </strong>{" "}
            a{" "}
            <strong className="text-slate-800">
              {Math.min(startIndex + pageSize, filteredFornecedores.length)}
            </strong>{" "}
            de{" "}
            <strong className="text-slate-800">
              {filteredFornecedores.length.toLocaleString('pt-BR')}
            </strong>{" "}
            fornecedores
            {filteredFornecedores.length !== fornecedores.length && ` (filtrados de ${fornecedores.length.toLocaleString('pt-BR')})`}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="h-8 px-2.5 text-xs bg-white"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Anterior
            </Button>

            <span className="px-2 font-medium text-slate-700">
              Página {currentPage} de {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-8 px-2.5 text-xs bg-white"
            >
              Próxima
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal Form */}
      <FornecedorForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingForn(null); }}
        onSave={handleSave}
        fornecedor={editingForn}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
