import { useState } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Hospital } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import AlaForm from "@/components/forms/AlaForm";

export default function Alas({ isTab }) {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingAla, setEditingAla] = useState(null);

  const queryClient = useQueryClient();

  const { data: alas = [], isLoading } = useQuery({
    queryKey: ['alas'],
    queryFn: () => db.entities.Ala.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => db.entities.Ala.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alas'] });
      setFormOpen(false);
      toast.success("Ala cadastrada com sucesso!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.Ala.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alas'] });
      setFormOpen(false);
      setEditingAla(null);
      toast.success("Ala atualizada com sucesso!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Ala.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alas'] });
      toast.success("Ala excluída com sucesso!");
    },
  });

  const handleSave = (data) => {
    if (editingAla) {
      updateMutation.mutate({ id: editingAla.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (ala) => {
    setEditingAla(ala);
    setFormOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja excluir esta ala?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredAlas = alas.filter(a =>
    a.nome?.toLowerCase().includes(search.toLowerCase()) ||
    a.descricao?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={isTab ? "p-4 space-y-4" : "p-6 space-y-6"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {!isTab ? (
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Alas do Hospital</h1>
            <p className="text-slate-500 text-sm">Cadastro de alas e setores</p>
          </div>
        ) : <div />}
        <Button onClick={() => { setEditingAla(null); setFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Ala
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4 border-0 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Buscar por nome ou descrição..."
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
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : filteredAlas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12">
                  <Hospital className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Nenhuma ala encontrada</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredAlas.map((ala) => (
                <TableRow key={ala.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-800">
                    {ala.nome}
                  </TableCell>
                  <TableCell className="text-slate-600">{ala.descricao || "-"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(ala)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(ala.id)}
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
      <AlaForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingAla(null); }}
        onSave={handleSave}
        ala={editingAla}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
