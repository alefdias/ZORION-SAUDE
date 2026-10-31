import { useState, useRef, useMemo } from "react";
import { db } from "@/api/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {  format , parseISO } from "date-fns";
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
    Settings2,
    EyeOff,
    Pill,
    ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isPsicotropico } from "@/utils/mavUtils";
import logo from "../assets/logo-tr.png";

export default function Inventario() {
    const queryClient = useQueryClient();
    const printRef = useRef();
    const [activeTab, setActiveTab] = useState("historico");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("todos"); // "todos" | "clinicos" | "psicotropicos"
    const [isNewInventarioOpen, setIsNewInventarioOpen] = useState(false);
    const [currentInventario, setCurrentInventario] = useState(null);
    const [inventarioItems, setInventarioItems] = useState([]);
    // fotografia do que veio do banco: o "salvar progresso" grava só o que mudou
    const originaisRef = useRef(new Map());
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
                        // lote.medicamento_nome pode vir nulo no banco antigo
                        medicamento_nome: l.medicamento_nome || med?.nome || "SEM NOME",
                        lote_id: l.id,
                        numero_lote: l.numero_lote,
                        quantidade_sistema: l.quantidade_atual,
                        quantidade_fisica: null,
                        divergencia: 0,
                        ajustado: false
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

    // Campo vazio = item AINDA NÃO CONTADO (quantidade_fisica = null).
    // Antes, qualquer tecla virava 0 e o item passava a contar como conferido.
    const handleUpdateFisico = (itemId, value) => {
        const limpo = String(value ?? "").trim();
        setInventarioItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;

            if (limpo === "") {
                return { ...item, quantidade_fisica: null, divergencia: 0 };
            }

            const fis = parseInt(limpo, 10);
            if (Number.isNaN(fis)) return item;

            const quantidade = Math.max(0, fis);
            return {
                ...item,
                quantidade_fisica: quantidade,
                divergencia: quantidade - item.quantidade_sistema
            };
        }));
    };

    // Lança no estoque SÓ os itens contados e ainda não lançados.
    // Cada item atualiza o lote e o medicamento na hora — dá para contar 5,
    // lançar, sair, e continuar depois pelo resto.
    const lancarContagens = async () => {
        try {
            if (!inventarioEmAndamento) {
                toast.error("Nenhum balanço em andamento.");
                return;
            }

            const paraLancar = inventarioItems.filter(
                item => item.quantidade_fisica !== null && !item.ajustado
            );

            if (paraLancar.length === 0) {
                toast.error("Nenhuma contagem nova para lançar (as já lançadas não são mexidas).");
                return;
            }

            toast.loading(`Lançando ${paraLancar.length} contagem(ns)...`);

            // estoque corrente por medicamento (dois lotes do mesmo remédio somam)
            const estoque = new Map();
            medicamentos.forEach(m => estoque.set(m.id, Number(m.estoque_atual) || 0));

            for (const item of paraLancar) {
                const fisico = item.quantidade_fisica;
                const diff = fisico - item.quantidade_sistema;

                await db.entities.Lote.update(item.lote_id, {
                    quantidade_atual: fisico,
                    status: fisico > 0 ? "disponivel" : "esgotado",
                });

                if (diff !== 0 && estoque.has(item.medicamento_id)) {
                    const novo = Math.max(0, (estoque.get(item.medicamento_id) || 0) + diff);
                    estoque.set(item.medicamento_id, novo);
                    await db.entities.Medicamento.update(item.medicamento_id, {
                        estoque_atual: novo,
                    });
                }

                await db.entities.InventarioItem.update(item.id, {
                    quantidade_fisica: fisico,
                    divergencia: diff,
                    ajustado: true,
                });
            }

            const lancados = new Set(paraLancar.map(i => i.id));
            setInventarioItems(prev =>
                prev.map(i =>
                    lancados.has(i.id)
                        ? {
                              ...i,
                              divergencia: i.quantidade_fisica - i.quantidade_sistema,
                              ajustado: true,
                          }
                        : i
                )
            );

            await queryClient.invalidateQueries({ queryKey: ["medicamentos"] });
            await queryClient.invalidateQueries({ queryKey: ["lotes"] });

            const contados = inventarioItems.filter(i => i.quantidade_fisica !== null).length;
            const restantes = inventarioItems.length - contados;

            toast.dismiss();
            toast.success(
                `${paraLancar.length} item(ns) lançado(s) no estoque · ` +
                `${contados}/${inventarioItems.length} contados` +
                (restantes > 0 ? ` · ${restantes} restantes` : " · completo")
            );
        } catch (error) {
            toast.dismiss();
            toast.error("Erro ao lançar: " + (error.message || error));
        }
    };

    const finalizarInventario = async () => {
        try {
            const semContagem = inventarioItems.filter(i => i.quantidade_fisica === null).length;
            if (semContagem > 0) {
                toast.error(
                    `Faltam ${semContagem} itens sem contagem. ` +
                    `Conte o restante (os já lançados continuam gravados) — o balanço só fecha completo.`
                );
                return;
            }

            const naoLancados = inventarioItems.filter(i => !i.ajustado).length;
            if (naoLancados > 0) {
                toast.error(`Há ${naoLancados} item(ns) contados e não lançados. Use "Lançar contagens" antes de finalizar.`);
                return;
            }

            setIsFinishing(true);
            toast.loading("Fechando o balanço...");

            // O ajuste de lote/estoque já foi feito item a item no lançamento.
            await db.entities.Inventario.update(inventarioEmAndamento.id, {
                status: 'concluido',
                data_fim: new Date().toISOString()
            });

            await queryClient.invalidateQueries();
            toast.dismiss();
            toast.success("Balanço concluído.");
            setActiveTab("historico");
        } catch (error) {
            console.error("Erro ao finalizar:", error);
            toast.dismiss();
            const errorMsg = typeof error === 'string' ? error : (error.message || "Erro desconhecido");
            toast.error("Erro ao finalizar: " + errorMsg);
        } finally {
            setIsFinishing(false);
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

            originaisRef.current = new Map(healed.map(i => [i.id, i.quantidade_fisica]));
            setInventarioItems(healed);
            return healed;
        },
        enabled: !!inventarioEmAndamento,
    });

    const [isBlindCount, setIsBlindCount] = useState(false);

    const statsCentral = useMemo(() => {
        const rawList = inventarioEmAndamento && inventarioItems.length > 0 
            ? inventarioItems 
            : lotes.filter(l => (Number(l.quantidade_atual) || 0) > 0);

        let clinicos = 0;
        let psicotropicos = 0;

        rawList.forEach(item => {
            const med = medicamentos.find(m => m.id === item.medicamento_id);
            const isCtrl = (med && (med.portaria_344 || isPsicotropico(med.grupo_terapeutico)));
            if (isCtrl) {
                psicotropicos++;
            } else {
                clinicos++;
            }
        });

        const contados = inventarioItems.filter(i => i.quantidade_fisica !== null).length;
        const pendentes = inventarioEmAndamento ? inventarioItems.length - contados : 0;

        return {
            total: rawList.length,
            clinicos,
            psicotropicos,
            contados,
            pendentes
        };
    }, [inventarioEmAndamento, inventarioItems, lotes, medicamentos]);

    const printItems = useMemo(() => {
        let baseList = [];
        if (inventarioEmAndamento && inventarioItems.length > 0) {
            baseList = inventarioItems;
        } else {
            baseList = lotes
                .filter(l => (Number(l.quantidade_atual) || 0) > 0)
                .map(l => {
                    const med = medicamentos.find(m => m.id === l.medicamento_id);
                    return {
                        id: l.id,
                        medicamento_id: l.medicamento_id,
                        medicamento_nome: med?.nome || l.medicamento_nome || "Medicamento",
                        medicamento_codigo: med?.codigo || "S/C",
                        numero_lote: l.numero_lote || "-",
                        quantidade_sistema: l.quantidade_atual || 0,
                        quantidade_fisica: null,
                        divergencia: 0,
                        portaria_344: med?.portaria_344,
                        grupo_terapeutico: med?.grupo_terapeutico
                    };
                });
        }

        if (filterType === "clinicos") {
            baseList = baseList.filter(item => {
                const med = medicamentos.find(m => m.id === item.medicamento_id);
                const isCtrl = (med && (med.portaria_344 || isPsicotropico(med.grupo_terapeutico))) || item.portaria_344;
                return !isCtrl;
            });
        } else if (filterType === "pendentes") {
            baseList = baseList.filter(item => item.quantidade_fisica === null);
        } else if (filterType === "psicotropicos") {
            baseList = baseList.filter(item => {
                const med = medicamentos.find(m => m.id === item.medicamento_id);
                const isCtrl = (med && (med.portaria_344 || isPsicotropico(med.grupo_terapeutico))) || item.portaria_344;
                return isCtrl;
            });
        }

        return [...baseList].sort((a, b) =>
            String(a.medicamento_nome || "").localeCompare(String(b.medicamento_nome || ""))
        );
    }, [inventarioEmAndamento, inventarioItems, lotes, medicamentos, filterType]);

    const handlePrintManual = (blind = false) => {
        setIsBlindCount(blind);
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const handlePrint = () => {
        handlePrintManual(false);
    };

    const filteredItems = useMemo(() => {
        let list = inventarioItems;
        if (filterType === "clinicos") {
            list = list.filter(item => {
                const med = medicamentos.find(m => m.id === item.medicamento_id);
                return !(med?.portaria_344 || isPsicotropico(med?.grupo_terapeutico));
            });
        } else if (filterType === "pendentes") {
            list = list.filter(item => item.quantidade_fisica === null);
        } else if (filterType === "psicotropicos") {
            list = list.filter(item => {
                const med = medicamentos.find(m => m.id === item.medicamento_id);
                return !!(med?.portaria_344 || isPsicotropico(med?.grupo_terapeutico));
            });
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter(item =>
                item.medicamento_nome?.toLowerCase().includes(term) ||
                item.numero_lote?.toLowerCase().includes(term) ||
                item.medicamento_codigo?.toLowerCase().includes(term)
            );
        }

        return list;
    }, [inventarioItems, filterType, searchTerm, medicamentos]);

    return (
        <div className="p-6 space-y-6">
            <div className="no-print space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Balanço - Farmácia Central</h1>
                        <p className="text-slate-500 text-sm">Conferência física manual por lotes e ajuste de divergências</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            onClick={() => handlePrintManual(false)}
                            variant="outline"
                            className="gap-2 border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 h-10 px-3.5"
                        >
                            <Printer className="w-4 h-4 text-indigo-600" />
                            Imprimir Folha de Contagem
                        </Button>
                        <Button
                            onClick={() => handlePrintManual(true)}
                            variant="outline"
                            className="gap-2 border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 h-10 px-3.5"
                            title="Oculta os saldos do sistema para contagem sem viés"
                        >
                            <EyeOff className="w-4 h-4 text-amber-600" />
                            Folha Cega (Sem Saldo)
                        </Button>
                        {!inventarioEmAndamento && (
                            <Button onClick={startNewInventario} className="gap-2 bg-indigo-600 hover:bg-indigo-700 font-semibold h-10 px-4">
                                <Plus className="w-4 h-4" />
                                Iniciar Novo Balanço
                            </Button>
                        )}
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="inline-flex flex-wrap p-1 bg-slate-100 rounded-xl text-xs font-semibold gap-1">
                            <button
                                type="button"
                                onClick={() => setFilterType("todos")}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                                    filterType === "todos"
                                        ? "bg-white text-indigo-600 shadow-xs font-bold"
                                        : "text-slate-600 hover:text-slate-900"
                                )}
                            >
                                Todos ({statsCentral.total})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType("clinicos")}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                                    filterType === "clinicos"
                                        ? "bg-white text-blue-600 shadow-xs font-bold"
                                        : "text-slate-600 hover:text-slate-900"
                                )}
                                title="Medicamentos clínicos gerais (não sujeitos à Portaria 344)"
                            >
                                <Pill className="w-3.5 h-3.5 text-blue-500" />
                                <span>Clínicos</span>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                                    filterType === "clinicos" ? "bg-blue-100 text-blue-700 font-bold" : "bg-slate-200 text-slate-600"
                                )}>
                                    {statsCentral.clinicos}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType("psicotropicos")}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                                    filterType === "psicotropicos"
                                        ? "bg-white text-amber-600 shadow-xs font-bold"
                                        : "text-slate-600 hover:text-slate-900"
                                )}
                                title="Medicamentos sob controle especial da Portaria SVS/MS 344/98"
                            >
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                <span>Psicotrópicos (Portaria 344)</span>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                                    filterType === "psicotropicos" ? "bg-amber-100 text-amber-700 font-bold" : "bg-slate-200 text-slate-600"
                                )}>
                                    {statsCentral.psicotropicos}
                                </span>
                            </button>
                            {inventarioEmAndamento && (
                                <button
                                    type="button"
                                    onClick={() => setFilterType("pendentes")}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                                        filterType === "pendentes"
                                            ? "bg-white text-rose-600 shadow-xs font-bold"
                                            : "text-slate-600 hover:text-slate-900"
                                    )}
                                    title="Itens que ainda não foram contados neste balanço"
                                >
                                    <span>Pendentes</span>
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                                        filterType === "pendentes" ? "bg-rose-100 text-rose-700 font-bold" : "bg-slate-200 text-slate-600"
                                    )}>
                                        {statsCentral.pendentes}
                                    </span>
                                </button>
                            )}
                        </div>

                        <TabsList className="grid w-full sm:w-[320px] grid-cols-2">
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
                    </div>

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
                                        <Button
                                            variant="outline"
                                            onClick={lancarContagens}
                                            className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold"
                                            title="Grava no estoque as contagens preenchidas e ainda não lançadas"
                                        >
                                            <Save className="w-4 h-4" />
                                            Lançar contagens
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
                                <h1 className="text-xl font-bold text-slate-900 leading-tight tracking-tight">ZORION SAÚDE</h1>
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
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                            {isBlindCount ? "Folha de Contagem Cega de Estoque" : "Folha de Contagem de Estoque"}
                        </h2>
                        <div className="inline-block px-4 py-1 bg-slate-100 rounded-full mt-2">
                            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider italic">
                                Farmácia Central • {filterType === "psicotropicos" ? "Psicotrópicos (Portaria SVS/MS 344/98)" : filterType === "clinicos" ? "Medicamentos Clínicos Gerais (Não Controlados)" : "Balanço Geral por Lotes e Validades"}
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status da Sessão</p>
                                    <Badge variant="default" className={cn(
                                        "px-3 py-1 text-xs font-bold border-0 rounded-md",
                                        inventarioEmAndamento?.status === 'em_andamento' 
                                            ? "bg-amber-500 text-white" 
                                            : "bg-indigo-600 text-white"
                                    )}>
                                        {inventarioEmAndamento?.status === 'em_andamento' ? "EM ANDAMENTO" : "CONTAGEM AVULSA"}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Início da Sessão</p>
                                    <p className="text-sm font-bold text-slate-700">
                                        {inventarioEmAndamento 
                                            ? format(parseISO(inventarioEmAndamento.data_inicio), "dd/MM/yyyy 'às' HH:mm") 
                                            : format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 border-x border-slate-200 px-6">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Responsável / Conferente</p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                            {inventarioEmAndamento?.responsavel?.charAt(0) || "C"}
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">{inventarioEmAndamento?.responsavel || "____________________"}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Itens</p>
                                    <p className="text-sm font-bold text-slate-700">{printItems.length} lotes listados</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Turno da Contagem</p>
                                    <p className="text-xs font-bold text-slate-700">
                                        (&nbsp;&nbsp;) Manhã &nbsp;&nbsp; (&nbsp;&nbsp;) Tarde &nbsp;&nbsp; (&nbsp;&nbsp;) Noite
                                    </p>
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
                                    {!isBlindCount && (
                                        <TableHead className="text-white font-bold text-center h-12 uppercase tracking-wider text-[11px] w-[100px]">Sistema</TableHead>
                                    )}
                                    <TableHead className="text-white font-bold text-center h-12 uppercase tracking-wider text-[11px] w-[130px]">Físico (Contagem)</TableHead>
                                    <TableHead className="text-white font-bold text-center h-12 uppercase tracking-wider text-[11px] w-[100px]">Diverg.</TableHead>
                                    <TableHead className="text-white font-bold text-center h-12 uppercase tracking-wider text-[11px] w-[60px]">Visto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {printItems.length > 0 ? (
                                    printItems.map((item, index) => (
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
                                            {!isBlindCount && (
                                                <TableCell className="text-center font-black text-slate-900 text-base">
                                                    {item.quantidade_sistema}
                                                </TableCell>
                                            )}
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
                                                <div className="w-5 h-5 rounded-full border border-slate-300 mx-auto"></div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={isBlindCount ? 6 : 7} className="text-center py-12 text-slate-400 italic">Nenhum item em estoque para conferência.</TableCell>
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
                            <p className="text-[9px] font-bold text-slate-800 uppercase leading-none mb-1">Zorion Saúde - Gestão Hospitalar</p>
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
