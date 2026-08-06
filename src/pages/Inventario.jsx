import { useState, useRef } from "react";
import { db } from "@/api/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {  format , parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
    ClipboardCheck,
    Plus,
    Search,
    History,
    Printer,
    CheckCircle2,
    AlertCircle,
    XCircle,
    ArrowRight,
    Boxes,
    Save,
    Trash2,
    Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import logo from "../assets/logo-tr.png";

export default function Inventario() {
    const queryClient = useQueryClient();
    const printRef = useRef();
    const [activeTab, setActiveTab] = useState("historico");
    const [searchTerm, setSearchTerm] = useState("");
    const [isNewInventarioOpen, setIsNewInventarioOpen] = useState(false);
    const [currentInventario, setCurrentInventario] = useState(null);
    const [inventarioItems, setInventarioItems] = useState([]);
    const [isFinishing, setIsFinishing] = useState(false);
    const [deleteBalançoId, setDeleteBalançoId] = useState(null);
    const [visibleColumns, setVisibleColumns] = useState({
        codigo: true,
        medicamento: true,
        sistema: true,
        fisico: true,
        divergencia: true,
        status: true
    });

    // Queries
    const { data: inventarios = [], isLoading: loadingInventarios } = useQuery({
        queryKey: ['inventarios'],
        queryFn: () => db.entities.Inventario.list('-data_inicio'),
    });

    const { data: medicamentos = [] } = useQuery({
        queryKey: ['medicamentos'],
        queryFn: () => db.entities.Medicamento.list(),
    });

    const { data: lotes = [] } = useQuery({
        queryKey: ['lotes'],
        queryFn: () => db.entities.Lote.list(),
    });

    // Verificar se há um inventário em andamento
    const inventarioEmAndamento = inventarios.find(i => i.status === 'em_andamento');

    const startNewInventario = async () => {
        try {
            const id = crypto.randomUUID();
            const newInventario = {
                id,
                data_inicio: new Date().toISOString(),
                status: 'em_andamento',
                responsavel: 'Administrador',
                observacao: ''
            };

            toast.loading("Iniciando balanço...");
            await db.entities.Inventario.create(newInventario);

            // Criar itens do inventário baseados no estoque atual
            const items = lotes
                .filter(l => l.quantidade_atual > 0)
                .map(l => {
                    const med = medicamentos.find(m => m.id === l.medicamento_id);
                    return {
                        inventario_id: id,
                        medicamento_id: l.medicamento_id,
                        medicamento_nome: l.medicamento_nome,
                        lote_id: l.id,
                        numero_lote: l.numero_lote,
                        quantidade_sistema: l.quantidade_atual,
                        quantidade_fisica: null,
                        divergencia: 0,
                        ajustado: 0
                    };
                });

            for (const item of items) {
                await db.entities.InventarioItem.create(item);
            }

            await queryClient.invalidateQueries({ queryKey: ['inventarios'] });
            toast.dismiss();
            toast.success("Balanço iniciado com sucesso!");
            setActiveTab("andamento");
        } catch (error) {
            console.error("Erro completo:", error);
            toast.dismiss();
            const errorMsg = typeof error === 'string' ? error : (error.message || "Erro desconhecido");
            toast.error("Erro ao iniciar balanço: " + errorMsg);
        }
    };

    const handleUpdateFisico = (itemId, value) => {
        setInventarioItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const fis = parseInt(value) || 0;
                return {
                    ...item,
                    quantidade_fisica: fis,
                    divergencia: fis - item.quantidade_sistema
                };
            }
            return item;
        }));
    };

    const saveProgresso = async () => {
        try {
            toast.loading("Salvando progresso...");
            for (const item of inventarioItems) {
                if (item.quantidade_fisica !== null) {
                    await db.entities.InventarioItem.update(item.id, {
                        quantidade_fisica: item.quantidade_fisica,
                        divergencia: item.divergencia
                    });
                }
            }
            toast.dismiss();
            toast.success("Progresso salvo!");
        } catch (error) {
            toast.dismiss();
            toast.error("Erro ao salvar: " + error.message);
        }
    };

    const finalizarInventario = async () => {
        try {
            setIsFinishing(true);
            toast.loading("Finalizando e ajustando estoque...");

            const id = inventarioEmAndamento.id;

            for (const item of inventarioItems) {
                // Se houver divergência, ajustar o lote e o medicamento
                if (item.quantidade_fisica !== null && item.divergencia !== 0) {
                    // 1. Atualizar o Lote
                    const lote = lotes.find(l => l.id === item.lote_id);
                    if (lote) {
                        await db.entities.Lote.update(lote.id, {
                            quantidade_atual: item.quantidade_fisica,
                            status: item.quantidade_fisica > 0 ? 'disponivel' : 'esgotado'
                        });

                        // 2. Atualizar o Medicamento (estoque_atual)
                        const med = medicamentos.find(m => m.id === item.medicamento_id);
                        if (med) {
                            const novoEstoqueMed = (med.estoque_atual || 0) + item.divergencia;
                            await db.entities.Medicamento.update(med.id, {
                                estoque_atual: Math.max(0, novoEstoqueMed)
                            });
                        }
                    }

                    // Marcar item como ajustado
                    await db.entities.InventarioItem.update(item.id, {
                        ajustado: 1,
                        quantidade_fisica: item.quantidade_fisica,
                        divergencia: item.divergencia
                    });
                }
            }

            // Finalizar o inventário
            await db.entities.Inventario.update(id, {
                status: 'concluido',
                data_fim: new Date().toISOString()
            });

            await queryClient.invalidateQueries();
            toast.dismiss();
            toast.success("Balanço finalizado e estoque ajustado!");
            setActiveTab("historico");
        } catch (error) {
            console.error("Erro ao finalizar:", error);
            toast.dismiss();
            const errorMsg = typeof error === 'string' ? error : (error.message || "Erro desconhecido");
            toast.error("Erro ao finalizar: " + errorMsg);
        } finally {
            setIsFinishing(false);
            setIsNewInventarioOpen(false);
        }
    };

    const cancelarInventario = async () => {
        if (!confirm("Tem certeza que deseja cancelar este balanço? Todos os dados de contagem atuais serão perdidos.")) return;

        try {
            toast.loading("Cancelando balanço...");
            const id = inventarioEmAndamento.id;

            // Opcional: Deletar itens órfãos
            for (const item of inventarioItems) {
                await db.entities.InventarioItem.delete(item.id);
            }

            await db.entities.Inventario.delete(id);

            await queryClient.invalidateQueries({ queryKey: ['inventarios'] });
            toast.dismiss();
            toast.success("Balanço cancelado.");
            setActiveTab("historico");
        } catch (error) {
            toast.dismiss();
            toast.error("Erro ao cancelar: " + error.message);
        }
    };

    const reverterInventario = async (id) => {
        if (!confirm("Aviso Crítico: Tem certeza que deseja reverter este balanço? Isso irá recompor o estoque exatamente como estava antes do balanço ser finalizado e marcará este balanço como cancelado.")) return;

        try {
            toast.loading("Revertendo balanço...");

            const itens = await db.entities.InventarioItem.list();
            const itensDesteBalanço = itens.filter(i => i.inventario_id === id && i.ajustado === 1 && i.divergencia !== 0);

            for (const item of itensDesteBalanço) {
                // Reverter o Lote
                const lote = lotes.find(l => l.id === item.lote_id);
                if (lote) {
                    const novaQtd = (lote.quantidade_atual || 0) - item.divergencia;
                    await db.entities.Lote.update(lote.id, {
                        quantidade_atual: Math.max(0, novaQtd),
                        status: novaQtd > 0 ? 'disponivel' : 'esgotado'
                    });

                    // Reverter o Medicamento
                    const med = medicamentos.find(m => m.id === item.medicamento_id);
                    if (med) {
                        const novoEstoqueMed = (med.estoque_atual || 0) - item.divergencia;
                        await db.entities.Medicamento.update(med.id, {
                            estoque_atual: Math.max(0, novoEstoqueMed)
                        });
                    }
                }
            }

            // Marcar o inventário como cancelado
            await db.entities.Inventario.update(id, {
                status: 'cancelado'
            });

            await queryClient.invalidateQueries();
            toast.dismiss();
            toast.success("Balanço revertido e estoque restaurado.");
        } catch (error) {
            console.error(error);
            toast.dismiss();
            toast.error("Erro ao reverter o balanço: " + error.message);
        }
    };

    const handleDeletarRegistroSemReverter = async () => {
        if (!deleteBalançoId) return;
        try {
            toast.loading("Excluindo registro...");
            
            // 1. Deletar itens do inventário para evitar órfãos
            const itens = await db.entities.InventarioItem.list();
            const itensDesteBalanço = itens.filter(i => i.inventario_id === deleteBalançoId);
            for (const item of itensDesteBalanço) {
                await db.entities.InventarioItem.delete(item.id);
            }

            // 2. Deletar o registro de inventário
            await db.entities.Inventario.delete(deleteBalançoId);

            await queryClient.invalidateQueries({ queryKey: ['inventarios'] });
            toast.dismiss();
            toast.success("Registro excluído com sucesso (Estoque mantido).");
            setDeleteBalançoId(null);
        } catch (error) {
            console.error(error);
            toast.dismiss();
            toast.error("Erro ao excluir registro: " + error.message);
        }
    };

    // Carregar itens do inventário em andamento
    useQuery({
        queryKey: ['inventario-items', inventarioEmAndamento?.id, medicamentos.length],
        queryFn: async () => {
            const items = await db.entities.InventarioItem.list();
            const filtered = items.filter(i => i.inventario_id === inventarioEmAndamento.id);

            // "Heal" missing medication codes for already started inventories
            const healed = filtered.map(item => {
                if (!item.medicamento_codigo || item.medicamento_codigo === 'S/C') {
                    const med = medicamentos.find(m => m.id === item.medicamento_id);
                    if (med?.codigo) {
                        return { ...item, medicamento_codigo: med.codigo };
                    }
                }
                return item;
            });

            setInventarioItems(healed);
            return healed;
        },
        enabled: !!inventarioEmAndamento,
    });

    const handlePrint = () => {
        window.print();
    };

    const filteredItems = inventarioItems.filter(item =>
        item.medicamento_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.numero_lote?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.medicamento_codigo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6">
            <div className="no-print space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Balanço de Estoque</h1>
                        <p className="text-slate-500 text-sm">Conferência física e ajuste de divergências</p>
                    </div>

                    {!inventarioEmAndamento && (
                        <Button onClick={startNewInventario} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="w-4 h-4" />
                            Iniciar Novo Balanço
                        </Button>
                    )}
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                        <TabsTrigger value="historico" className="gap-2">
                            <History className="w-4 h-4" />
                            Histórico
                        </TabsTrigger>
                        <TabsTrigger value="andamento" disabled={!inventarioEmAndamento} className="gap-2">
                            <ClipboardCheck className="w-4 h-4" />
                            Em Andamento
                            {inventarioEmAndamento && (
                                <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 border-0">1</Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="historico" className="mt-6">
                        <Card className="border-0 shadow-sm">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data Início</TableHead>
                                        <TableHead>Data Fim</TableHead>
                                        <TableHead>Responsável</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingInventarios ? (
                                        Array(3).fill(0).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : inventarios.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                                                Nenhum balanço realizado anteriormente.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        inventarios.map((i) => (
                                            <TableRow key={i.id}>
                                                <TableCell>{format(parseISO(i.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                                                <TableCell>{i.data_fim ? format(parseISO(i.data_fim), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
                                                <TableCell>{i.responsavel}</TableCell>
                                                <TableCell>
                                                    <Badge variant="default" className={
                                                        i.status === 'concluido' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                                                            i.status === 'em_andamento' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                                                'text-slate-500'
                                                    }>
                                                        {i.status === 'concluido' ? 'Concluído' : i.status === 'em_andamento' ? 'Em Andamento' : 'Cancelado'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {i.status === 'concluido' && (
                                                            <>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    onClick={() => reverterInventario(i.id)} 
                                                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
                                                                    title="Reverter Estoque e Cancelar"
                                                                >
                                                                    <XCircle className="w-4 h-4 mr-1" /> Reverter
                                                                </Button>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    onClick={() => setDeleteBalançoId(i.id)} 
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50" 
                                                                    title="Deletar Registro (Mantém Estoque Atual)"
                                                                >
                                                                    <Trash2 className="w-4 h-4 mr-1" /> Deletar
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Button variant="ghost" size="sm" onClick={() => {
                                                            if (i.status === 'em_andamento') setActiveTab("andamento");
                                                        }}>
                                                            {i.status === 'em_andamento' ? <ArrowRight className="w-4 h-4" /> : "Ver Detalhes"}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>

                    <TabsContent value="andamento" className="mt-6 space-y-6">
                        {inventarioEmAndamento && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="border-l-4 border-l-amber-500 shadow-sm">
                                        <CardHeader className="py-4">
                                            <CardTitle className="text-sm font-medium text-slate-500">Status da Sessão</CardTitle>
                                            <div className="text-2xl font-bold text-amber-600 uppercase">Em Andamento</div>
                                            <CardDescription>Iniciado em {format(parseISO(inventarioEmAndamento.data_inicio), "dd/MM/yyyy 'às' HH:mm")}</CardDescription>
                                        </CardHeader>
                                    </Card>

                                    <Card className="shadow-sm">
                                        <CardHeader className="py-4">
                                            <CardTitle className="text-sm font-medium text-slate-500">Itens para Conferir</CardTitle>
                                            <div className="text-2xl font-bold text-slate-800">{inventarioItems.length}</div>
                                            <CardDescription>Lotes ativos no sistema</CardDescription>
                                        </CardHeader>
                                    </Card>

                                    <Card className="shadow-sm">
                                        <CardHeader className="py-4">
                                            <CardTitle className="text-sm font-medium text-slate-500">Progresso</CardTitle>
                                            <div className="text-2xl font-bold text-indigo-600">
                                                {inventarioItems.filter(i => i.quantidade_fisica !== null).length} / {inventarioItems.length}
                                            </div>
                                            <CardDescription>Itens contados</CardDescription>
                                        </CardHeader>
                                    </Card>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between no-print">
                                    <div className="relative flex-1 w-full">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <Input
                                            placeholder="Filtrar por nome ou lote..."
                                            className="pl-10"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button variant="outline" onClick={handlePrint} className="gap-2">
                                            <Printer className="w-4 h-4" />
                                            Folha de Contagem
                                        </Button>
                                        <Button variant="outline" onClick={saveProgresso} className="gap-2">
                                            <Save className="w-4 h-4" />
                                            Salvar Progresso
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={cancelarInventario}
                                            className="gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={() => setIsNewInventarioOpen(true)}
                                            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                                            disabled={inventarioItems.filter(i => i.quantidade_fisica !== null).length === 0 && inventarioItems.length > 0}
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Finalizar Balanço
                                        </Button>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="ml-auto">
                                                <Settings2 className="w-4 h-4 mr-2" />
                                                Colunas
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {Object.keys(visibleColumns).map((col) => (
                                                <DropdownMenuCheckboxItem
                                                    key={col}
                                                    className="capitalize"
                                                    checked={visibleColumns[col]}
                                                    onCheckedChange={(checked) =>
                                                        setVisibleColumns((prev) => ({ ...prev, [col]: checked }))
                                                    }
                                                >
                                                    {col === "codigo" ? "Cód." :
                                                        col === "fisico" ? "Físico (Contagem)" :
                                                            col === "divergencia" ? "Divergência" : col}
                                                </DropdownMenuCheckboxItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <Card className="border-0 shadow-sm relative h-[500px]">
                                    <Table className="min-w-[1000px] w-full" containerClassName="absolute inset-0 border-0">
                                        <TableHeader className="sticky top-0 z-20 shadow-sm bg-white">
                                            <TableRow className="bg-slate-50 hover:bg-slate-50 h-10">
                                                {visibleColumns.codigo && <TableHead className="w-24 h-10 py-0 text-xs font-bold uppercase">Cód.</TableHead>}
                                                {visibleColumns.medicamento && <TableHead className="w-[300px] h-10 py-0 text-xs font-bold uppercase">Medicamento / Lote</TableHead>}
                                                {visibleColumns.sistema && <TableHead className="text-center h-10 py-0 text-xs font-bold uppercase">Sistema</TableHead>}
                                                {visibleColumns.fisico && <TableHead className="text-center w-[150px] h-10 py-0 text-xs font-bold uppercase">Físico (Contagem)</TableHead>}
                                                {visibleColumns.divergencia && <TableHead className="text-center h-10 py-0 text-xs font-bold uppercase">Divergência</TableHead>}
                                                {visibleColumns.status && <TableHead className="text-right h-10 py-0 text-xs font-bold uppercase">Status</TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredItems.map((item) => (
                                                <TableRow key={item.id} className={cn("h-12", item.quantidade_fisica !== null ? "bg-indigo-50/30" : "hover:bg-slate-50")}>
                                                    {visibleColumns.codigo && (
                                                        <TableCell className="py-1">
                                                            <Badge variant="outline" className="font-mono text-[10px] uppercase">
                                                                {item.medicamento_codigo && item.medicamento_codigo !== 'S/C'
                                                                    ? item.medicamento_codigo
                                                                    : (medicamentos.find(m => m.id === item.medicamento_id)?.codigo || "S/C")}
                                                            </Badge>
                                                        </TableCell>
                                                    )}
                                                    {visibleColumns.medicamento && (
                                                        <TableCell className="py-1">
                                                            <div>
                                                                <p className="font-semibold text-slate-800 text-sm leading-tight">{item.medicamento_nome}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">LOTE: {item.numero_lote}</span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                    {visibleColumns.sistema && (
                                                        <TableCell className="text-center font-bold text-slate-600 text-sm py-1">
                                                            {item.quantidade_sistema}
                                                        </TableCell>
                                                    )}
                                                    {visibleColumns.fisico && (
                                                        <TableCell className="py-1">
                                                            <Input
                                                                type="number"
                                                                placeholder=""
                                                                className="text-center font-bold h-8 text-sm"
                                                                value={item.quantidade_fisica === null ? "" : item.quantidade_fisica}
                                                                onChange={(e) => handleUpdateFisico(item.id, e.target.value)}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    {visibleColumns.divergencia && (
                                                        <TableCell className="text-center py-1">
                                                            {item.quantidade_fisica !== null && (
                                                                <Badge variant="default" className={cn(
                                                                    "text-[10px] px-1.5 h-5",
                                                                    item.divergencia === 0 ? "bg-emerald-100 text-emerald-700" :
                                                                        item.divergencia > 0 ? "bg-blue-100 text-blue-700" :
                                                                            "bg-red-100 text-red-700"
                                                                )}>
                                                                    {item.divergencia > 0 ? `+${item.divergencia}` : item.divergencia}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                    )}
                                                    {visibleColumns.status && (
                                                        <TableCell className="text-right py-1">
                                                            {item.quantidade_fisica !== null ? (
                                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
                                                            ) : (
                                                                <div className="w-4 h-4 rounded-full border-2 border-slate-200 ml-auto" />
                                                            )}
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Card>
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Relatório Profissional para Impressão (Folha de Contagem) */}
            <div className="print-only" style={{ display: 'none' }}>
                <div className="report-container" id="print-area" ref={printRef}>
                    {/* Conteúdo do Relatório */}
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-4">
                            <img src={logo} alt="Logo" className="h-16 w-auto object-contain" />
                            <div className="w-px h-12 bg-slate-300 mx-2 hidden sm:block"></div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 leading-tight tracking-tight">AXION SAÚDE</h1>
                                <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Farmácia Central</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Documento de Controle</p>
                            <p className="text-xs font-bold text-slate-900">{format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
                            <p className="text-[10px] text-slate-400 font-mono">REF: {inventarioEmAndamento?.id?.substring(0, 8).toUpperCase()}</p>
                        </div>
                    </div>

                    <div className="w-full h-1 bg-slate-800 mb-0.5"></div>
                    <div className="w-full h-px bg-slate-800 mb-6"></div>

                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Folha de Contagem de Estoque</h2>
                        <div className="inline-block px-4 py-1 bg-slate-100 rounded-full mt-2">
                            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider italic">Balanço Geral de Medicamentos e Insumos</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status da Sessão</p>
                                    <Badge variant="default" className={cn(
                                        "px-3 py-1 text-xs font-bold border-0 rounded-md",
                                        inventarioEmAndamento?.status === 'em_andamento' ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
                                    )}>
                                        {inventarioEmAndamento?.status === 'em_andamento' ? "EM ANDAMENTO" : "FINALIZADO"}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Início da Sessão</p>
                                    <p className="text-sm font-bold text-slate-700">{inventarioEmAndamento ? format(parseISO(inventarioEmAndamento.data_inicio), "dd/MM/yyyy 'às' HH:mm") : "-"}</p>
                                </div>
                            </div>

                            <div className="space-y-3 border-x border-slate-200 px-6">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Responsável</p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                            {inventarioEmAndamento?.responsavel?.charAt(0) || "A"}
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">{inventarioEmAndamento?.responsavel || "Administrador"}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Itens</p>
                                    <p className="text-sm font-bold text-slate-700">{inventarioItems.length} lotes listados</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Progresso</p>
                                    <div className="flex items-end justify-between mb-1">
                                        <p className="text-xl font-black text-slate-900 leading-none">
                                            {inventarioItems.filter(i => i.quantidade_fisica !== null).length} <span className="text-xs font-bold text-slate-400">/ {inventarioItems.length}</span>
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-500">{Math.round((inventarioItems.filter(i => i.quantidade_fisica !== null).length / (inventarioItems.length || 1)) * 100)}%</p>
                                    </div>
                                    <Progress value={(inventarioItems.filter(i => i.quantidade_fisica !== null).length / (inventarioItems.length || 1)) * 100} className="h-2 bg-slate-200" />
                                </div>
                                <p className="text-[9px] text-slate-400 italic font-medium leading-tight">
                                    Este documento deve ser preenchido manualmente durante a contagem física e posteriormente validado no sistema.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-800 hover:bg-slate-800 border-b-0">
                                    <TableHead className="text-white font-bold h-12 px-6 uppercase tracking-wider text-[11px] w-24">Cód.</TableHead>
                                    <TableHead className="text-white font-bold h-12 px-2 uppercase tracking-wider text-[11px]">Medicamento / Descrição</TableHead>
                                    <TableHead className="text-white font-bold text-center h-12 uppercase tracking-wider text-[11px] w-[120px]">Lote</TableHead>
                                    <TableHead className="text-white font-bold text-center h-12 uppercase tracking-wider text-[11px] w-[100px]">Sistema</TableHead>
                                    <TableHead className="text-white font-bold text-center h-12 uppercase tracking-wider text-[11px] w-[130px]">Físico (Contagem)</TableHead>
                                    <TableHead className="text-white font-bold text-center h-12 uppercase tracking-wider text-[11px] w-[100px]">Diverg.</TableHead>
                                    <TableHead className="text-white font-bold text-center h-12 uppercase tracking-wider text-[11px] w-[60px]">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {inventarioItems.length > 0 ? (
                                    inventarioItems.map((item, index) => (
                                        <TableRow key={item.id} className={cn(
                                            "h-14 border-b border-slate-100",
                                            index % 2 === 1 ? "bg-slate-50/50" : "bg-white"
                                        )}>
                                            <TableCell className="px-6 py-2">
                                                <Badge variant="outline" className="font-mono text-[10px] uppercase border-slate-200">
                                                    {item.medicamento_codigo && item.medicamento_codigo !== 'S/C'
                                                        ? item.medicamento_codigo
                                                        : (medicamentos.find(m => m.id === item.medicamento_id)?.codigo || "S/C")}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-2 py-2">
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm leading-tight uppercase">{item.medicamento_nome}</p>
                                                    <p className="text-[9px] text-slate-500 font-medium mt-0.5">ID: {item.medicamento_id?.substring(0, 8)}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="default" className="font-mono text-[10px] px-2 py-0 border-slate-300 text-slate-600 bg-white">
                                                    {item.numero_lote}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-black text-slate-900 text-base">
                                                {item.quantidade_sistema}
                                            </TableCell>
                                            <TableCell className="text-center px-4">
                                                <div className="w-full h-10 border-2 border-slate-300 rounded bg-white flex items-center justify-center">
                                                    <span className="text-slate-200 font-light text-xs uppercase tracking-widest">{item.quantidade_fisica !== null ? item.quantidade_fisica : "____"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {item.quantidade_fisica !== null ? (
                                                    <span className={cn(
                                                        "font-bold text-sm",
                                                        item.divergencia === 0 ? "text-slate-400" :
                                                            item.divergencia > 0 ? "text-emerald-600" : "text-red-600"
                                                    )}>
                                                        {item.divergencia > 0 ? `+${item.divergencia}` : item.divergencia}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">--</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {item.quantidade_fisica !== null ? (
                                                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center mx-auto border border-emerald-200">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                    </div>
                                                ) : (
                                                    <div className="w-5 h-5 rounded-full border border-slate-300 mx-auto"></div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-slate-400 italic">Nenhum item em estoque para conferência.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-10 space-y-8 no-break">
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Observações Adicionais</p>
                            <div className="space-y-3">
                                <div className="h-px bg-slate-200 w-full"></div>
                                <div className="h-px bg-slate-200 w-full"></div>
                                <div className="h-px bg-slate-200 w-full"></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-12 px-8">
                            <div className="text-center mt-12">
                                <div className="w-full h-px bg-slate-900 mb-2"></div>
                                <p className="text-xs font-black text-slate-900 uppercase">Assinatura do Responsável</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1">{inventarioEmAndamento?.responsavel || "ADMINISTRADOR"}</p>
                                <div className="mt-4 flex justify-center gap-2">
                                    <span className="text-[9px] text-slate-400 font-medium">DATA: ____/____/____</span>
                                </div>
                            </div>
                            <div className="text-center mt-12">
                                <div className="w-full h-px bg-slate-900 mb-2"></div>
                                <p className="text-xs font-black text-slate-900 uppercase">Assinatura do Conferente</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1">Carimbo e Registro Profissional</p>
                                <div className="mt-4 flex justify-center gap-2">
                                    <span className="text-[9px] text-slate-400 font-medium">DATA: ____/____/____</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-16 flex justify-between items-end border-t border-slate-200 pb-4">
                        <div>
                            <p className="text-[9px] font-bold text-slate-800 uppercase leading-none mb-1">Axion Saúde - Gestão Hospitalar</p>
                            <p className="text-[8px] text-slate-400 uppercase tracking-widest">Sistema de Gerenciamento de Farmácia v2.4.0</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-medium text-slate-500 uppercase leading-none">Pág. 01 / 01</p>
                            <p className="text-[8px] text-slate-400 mt-1 uppercase">Autenticado pelo Sistema - UUID: {inventarioEmAndamento?.id?.substring(0, 18)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmação de Finalização */}
            <AlertDialog open={isNewInventarioOpen} onOpenChange={setIsNewInventarioOpen}>
                <AlertDialogContent className="max-w-[500px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            Finalizar Balanço e Ajustar Estoque?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Ao confirmar, o sistema irá atualizar as quantidades atuais de todos os lotes
                            no banco de dados para corresponderem à sua contagem física.

                            <div className="mt-4 p-4 bg-amber-50 rounded-lg text-amber-900 border border-amber-200">
                                <p className="font-bold flex items-center gap-1 mb-1">
                                    <Boxes className="w-4 h-4" /> Resumo do Ajuste:
                                </p>
                                <ul className="text-xs space-y-1">
                                    <li>• Total de itens conferidos: {inventarioItems.filter(i => i.quantidade_fisica !== null).length}</li>
                                    <li>• Medicamentos com divergência: {inventarioItems.filter(i => i.divergencia !== 0 && i.quantidade_fisica !== null).length}</li>
                                </ul>
                            </div>

                            <p className="mt-4 font-semibold text-red-600">
                                Essa operação não pode ser desfeita após a confirmação.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isFinishing}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                finalizarInventario();
                            }}
                            disabled={isFinishing}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                        >
                            {isFinishing ? "Processando..." : "Confirmar e Ajustar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Confirmação de Exclusão sem Reverter */}
            <AlertDialog open={!!deleteBalançoId} onOpenChange={() => setDeleteBalançoId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="w-5 h-5" />
                            Confirmar Exclusão de Registro?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-4">
                            <p>
                                Você está prestes a excluir este balanço do histórico.
                            </p>
                            
                            <div className="p-4 bg-red-50 rounded-lg text-red-900 border border-red-200">
                                <p className="font-bold flex items-center gap-1 mb-1 italic uppercase">
                                    <AlertCircle className="w-4 h-4" /> Atenção:
                                </p>
                                <p className="text-xs">
                                    Esta ação **NÃO REVERTERÁ** os ajustes de estoque feitos. As quantidades atuais permanecerão como estão agora.
                                    Use esta opção apenas se deseja limpar o histórico mantendo as correções físicas.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Não, Voltar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeletarRegistroSemReverter}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Sim, Deletar apenas o Registro
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          /* Esconder elementos com classe no-print e outros elementos da UI */
          .no-print, 
          aside, nav, header, button, .tabs-list, [role="tablist"], .sonner-toaster,
          dialog,
          .fixed-top-0 { 
            display: none !important; 
          }
          
          /* Garantir que root e body fiquem normais */
          body, html, #root, .p-6, .print-container, .lg\\:ml-64, main { 
            display: block !important; 
            position: static !important; 
            height: auto !important; 
            min-height: auto !important; 
            overflow: visible !important; 
            margin: 0 !important; 
            width: 100% !important; 
            padding: 0 !important; 
          }
          
          /* Garantir que o container de impressão apareça e ocupe o espaço correto */
          .print-only { 
            display: block !important; 
            visibility: visible !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .report-container {
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 20mm !important;
            margin: 0 auto !important;
            background: white !important;
            display: flex !important;
            flex-direction: column !important;
            page-break-after: always !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            border: none !important;
            box-shadow: none !important;
          }

          /* Resetar estilos globais para impressão */
          body { 
            background: white !important; 
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Esconder elementos root que podem atrapalhar */
          #root {
            padding: 0 !important;
            margin: 0 !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Garantir que a tabela e outros elementos não quebrem no meio */
          table { width: 100% !important; border-collapse: collapse !important; border-spacing: 0 !important; }
          th { background-color: #1e293b !important; color: white !important; -webkit-print-color-adjust: exact !important; }
          tr { break-inside: avoid !important; page-break-inside: avoid !important; }
          
          .no-break {
             break-inside: avoid !important;
             page-break-inside: avoid !important;
          }

          /* Estilo zebra */
          tr:nth-child(even) { background-color: #f8fafc !important; -webkit-print-color-adjust: exact !important; }
          
          /* Badges na impressão */
          .bg-amber-500 { background-color: #f59e0b !important; color: white !important; }
          .bg-emerald-500 { background-color: #10b981 !important; color: white !important; }
          
          @page { 
            size: A4 portrait;
            margin: 0;
          }
        }
      `}} />
        </div>
    );
}
