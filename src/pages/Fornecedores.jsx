import { useState } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Building2, Phone, Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import FornecedorForm from "@/components/forms/FornecedorForm";

export default function Fornecedores({ isTab }) {
  const [search, setSearch] = useState("");
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
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.Fornecedor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setFormOpen(false);
      setEditingForn(null);
      toast.success("Fornecedor atualizado com sucesso!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Fornecedor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success("Fornecedor excluído com sucesso!");
    },
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

  const filteredFornecedores = fornecedores.filter(f =>
    f.nome?.toLowerCase().includes(search.toLowerCase()) ||
    f.cnpj?.includes(search) ||
    f.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={isTab ? "p-4 space-y-4" : "p-6 space-y-6"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {!isTab ? (
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Fornecedores</h1>
            <p className="text-slate-500 text-sm">Cadastro de fornecedores e distribuidores</p>
          </div>
        ) : <div />}
        <Button onClick={() => { setEditingForn(null); setFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Fornecedor
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4 border-0 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Buscar por nome, CNPJ ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Fornecedor</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(6).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredFornecedores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Nenhum fornecedor encontrado</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredFornecedores.map((forn) => (
                <TableRow key={forn.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-800">
                    {forn.nome}
                  </TableCell>
                  <TableCell className="text-slate-600">{forn.cnpj || "-"}</TableCell>
                  <TableCell className="text-slate-600">{forn.contato_nome || "-"}</TableCell>
                  <TableCell>
                    {forn.telefone ? (
                      <span className="flex items-center gap-1 text-slate-600">
                        <Phone className="w-3 h-3" />
                        {forn.telefone}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {forn.email ? (
                      <span className="flex items-center gap-1 text-slate-600">
                        <Mail className="w-3 h-3" />
                        {forn.email}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(forn)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(forn.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Form Modal */}
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
