import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComboboxMedicamento } from "@/components/ui/combobox-medicamento";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { AlertTriangle, PackageMinus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/api/db";

const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

import { isMav, isPsicotropico } from "@/utils/mavUtils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const emptyForm = {
    itens: [], // { medicamento_id, medicamento_nome, lote_id, numero_lote, quantidade }
    ala_id: "",
    ala_nome: "",
    data_saida: getLocalDateString(),
    paciente_nome: "",
    motivo: "",
    observacao: "",
};

export default function SaidaForm({ open, onClose, onSave, initialData = null, medicamentos = [], lotes = [], alas = [], isLoading }) {
    const [form, setForm] = useState(emptyForm);
    const [currentItem, setCurrentItem] = useState({ medicamento_id: "", medicamento_nome: "", lote_id: "", numero_lote: "", quantidade: "" });

    const { data: pacientes = [] } = useQuery({
        queryKey: ['pacientes'],
        queryFn: () => db.entities.Paciente.list(),
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                // Modo edição (apenas 1 item)
                setForm({
                    itens: [{
                        medicamento_id: initialData.medicamento_id,
                        medicamento_nome: initialData.medicamento_nome,
                        lote_id: initialData.lote_id,
                        numero_lote: initialData.numero_lote,
                        quantidade: initialData.quantidade
                    }],
                    ala_id: initialData.ala_id || "",
                    ala_nome: initialData.ala_nome || "",
                    data_saida: initialData.data_saida || getLocalDateString(),
                    paciente_nome: initialData.paciente_nome || "",
                    motivo: initialData.motivo || "",
                    observacao: initialData.observacao || "",
                });
            } else {
                setForm(emptyForm);
                setCurrentItem({ medicamento_id: "", medicamento_nome: "", lote_id: "", numero_lote: "", quantidade: "" });
            }
        }
    }, [open, initialData]);

    const handleChange = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleMedicamento = (id) => {
        const med = medicamentos.find((m) => m.id === id);
        
        // FEFO: Encontrar o lote que vence primeiro
        const lotesDoMed = lotes
            .filter(l => l.medicamento_id === id && l.quantidade_atual > 0)
            .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
        
        const loteFefo = lotesDoMed.length > 0 ? lotesDoMed[0] : null;

        setCurrentItem((prev) => ({
            ...prev,
            medicamento_id: id,
            medicamento_nome: med?.nome || "",
            lote_id: loteFefo ? loteFefo.id : "",
            numero_lote: loteFefo ? loteFefo.numero_lote : ""
        }));
    };

    const handleLote = (id) => {
        const lote = lotes.find((l) => l.id === id);
        setCurrentItem((prev) => ({
            ...prev,
            lote_id: id,
            numero_lote: lote?.numero_lote || ""
        }));
    };

    const handleAla = (id) => {
        if (id === "__none__") {
            setForm((prev) => ({ ...prev, ala_id: "", ala_nome: "", paciente_nome: "" }));
            return;
        }
        const ala = alas.find((a) => a.id === id);
        setForm((prev) => ({ ...prev, ala_id: id, ala_nome: ala?.nome || "", paciente_nome: "" }));
    };

    const handleAddItem = () => {
        if (!currentItem.medicamento_id) {
            toast.error("Selecione um medicamento"); return;
        }
        if (!currentItem.lote_id) {
            toast.error("Selecione um lote disponível"); return;
        }
        if (!currentItem.quantidade || Number(currentItem.quantidade) <= 0) {
            toast.error("Informe uma quantidade válida"); return;
        }
        setForm(prev => ({ ...prev, itens: [...prev.itens, { ...currentItem, quantidade: Number(currentItem.quantidade) }] }));
        setCurrentItem({ medicamento_id: "", medicamento_nome: "", lote_id: "", numero_lote: "", quantidade: "" });
    };

    const handleRemoveItem = (index) => {
        setForm(prev => ({ ...prev, itens: prev.itens.filter((_, i) => i !== index) }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Se o usuário preencheu o item atual mas não clicou em "Adicionar", vamos adicionar silenciosamente se for uma nova saída
        let finalItens = [...form.itens];
        if (!initialData && currentItem.medicamento_id && currentItem.lote_id && Number(currentItem.quantidade) > 0) {
            finalItens.push({ ...currentItem, quantidade: Number(currentItem.quantidade) });
        }

        if (finalItens.length === 0) {
            toast.error("Adicione ao menos um medicamento para dar saída");
            return;
        }

        let requerNome = false;
        for (const item of finalItens) {
            const selectedMed = medicamentos.find(m => m.id === item.medicamento_id);
            if (selectedMed && (isPsicotropico(selectedMed.grupo_terapeutico) || isMav(selectedMed.nome))) {
                requerNome = true;
            }
        }

        if (requerNome && (!form.paciente_nome || !form.paciente_nome.trim())) {
            toast.warning("Recomendado: informe o nome do paciente para medicamentos de Controle Especial ou MAV.");
        }

        onSave({
            id: initialData?.id, // apenas para edição
            itens: finalItens,
            ala_id: form.ala_id || null,
            ala_nome: form.ala_nome,
            data_saida: form.data_saida,
            paciente_nome: form.paciente_nome,
            motivo: form.motivo,
            observacao: form.observacao
        });
    };

    const filteredLotes = lotes
        .filter(l => l.medicamento_id === currentItem.medicamento_id)
        .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
        
    const selectedMed = medicamentos.find(m => m.id === currentItem.medicamento_id);

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PackageMinus className="w-5 h-5 text-red-500" />
                        {initialData ? "Editar Saída de Medicamento" : "Nova Saída de Medicamento(s)"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Sessão de Adição de Itens (Oculto na edição) */}
                    {!initialData && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                            <h3 className="font-bold text-sm text-slate-700">Selecione o(s) Produto(s)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Medicamento (Central / Satélite)</Label>
                                    <ComboboxMedicamento
                                        medicamentos={medicamentos}
                                        value={currentItem.medicamento_id}
                                        onChange={handleMedicamento}
                                    />
                                    {isMav(currentItem.medicamento_nome) && (
                                        <p className="text-[10px] font-bold text-red-900 mt-1 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> MAV
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label>Lote</Label>
                                    <Select
                                        value={currentItem.lote_id}
                                        onValueChange={handleLote}
                                        disabled={!currentItem.medicamento_id || filteredLotes.length === 0}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={
                                                !currentItem.medicamento_id ? "Selecione..." :
                                                    filteredLotes.length === 0 ? "Sem lotes" : "Selecione o lote"
                                            } />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filteredLotes.map((l, index) => {
                                                let formattedDate = l.data_validade;
                                                try {
                                                    formattedDate = format(parseISO(l.data_validade), 'dd/MM/yyyy', { locale: ptBR });
                                                } catch (e) {
                                                    if (l.data_validade && l.data_validade.includes('-')) {
                                                        const parts = l.data_validade.split('-');
                                                        if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                    }
                                                }
                                                return (
                                                    <SelectItem key={l.id} value={l.id} className={index === 0 ? "font-bold text-amber-700 bg-amber-50" : ""}>
                                                        {index === 0 ? "⭐ " : ""}{l.numero_lote} (Stk: {l.quantidade_atual})
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <Label>Quantidade</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        placeholder="0"
                                        value={currentItem.quantidade}
                                        onChange={(e) => setCurrentItem({ ...currentItem, quantidade: e.target.value })}
                                    />
                                </div>
                                <Button type="button" onClick={handleAddItem} className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
                                    <Plus className="w-4 h-4 mr-2" /> Adicionar à Lista
                                </Button>
                            </div>
                            {selectedMed && (
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Estoque Central: <b>{selectedMed.estoque_atual || 0}</b> | Estoque Satélite: <b>{selectedMed.estoque_satelite || 0}</b>
                                </p>
                            )}
                        </div>
                    )}

                    {/* Tabela de Itens Selecionados */}
                    {form.itens.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 text-slate-600 font-bold text-xs">
                                    <tr>
                                        <th className="p-2 text-left">Medicamento</th>
                                        <th className="p-2 text-left">Lote</th>
                                        <th className="p-2 text-center">Qtd</th>
                                        {!initialData && <th className="p-2 w-10"></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {form.itens.map((item, idx) => (
                                        <tr key={idx} className="border-t border-slate-100">
                                            <td className="p-2 font-medium">{item.medicamento_nome}</td>
                                            <td className="p-2 text-slate-500">{item.numero_lote}</td>
                                            <td className="p-2 text-center font-bold text-red-600">-{item.quantidade}</td>
                                            {!initialData && (
                                                <td className="p-2 text-center">
                                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => handleRemoveItem(idx)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Data de Saída */}
                        <DatePickerField
                            id="data-saida"
                            label="Data de Saída"
                            value={form.data_saida}
                            onChange={(v) => setForm(prev => ({ ...prev, data_saida: v }))}
                        />

                        {/* Ala / Destino */}
                        <div>
                            <Label htmlFor="ala-select">Ala / Setor de Destino</Label>
                            <Select value={form.ala_id || "__none__"} onValueChange={handleAla}>
                                <SelectTrigger id="ala-select">
                                    <SelectValue placeholder="Selecione o destino..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">— Nenhum / Retirada Geral —</SelectItem>
                                    {alas.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Nome do Paciente */}
                        <div>
                            <Label htmlFor="paciente_nome">Nome do Paciente</Label>
                            
                            {form.ala_id ? (
                                <Select 
                                    value={form.paciente_nome} 
                                    onValueChange={(val) => setForm(prev => ({ ...prev, paciente_nome: val === "__nenhum__" ? "" : val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um paciente da ala..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__nenhum__">— Não especificado —</SelectItem>
                                        {pacientes
                                            .filter(p => p.alaId === form.ala_id || p.alaNome === form.ala_nome)
                                            .filter(p => p.status === "Ativo")
                                            .map(p => (
                                                <SelectItem key={p.id} value={p.nome}>
                                                    {p.nome}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="paciente_nome"
                                    placeholder="Nome completo (Opcional)"
                                    value={form.paciente_nome === "__nenhum__" ? "" : (form.paciente_nome || "")}
                                    onChange={handleChange("paciente_nome")}
                                />
                            )}
                        </div>

                        {/* Motivo */}
                        <div>
                            <Label htmlFor="motivo">Motivo da Saída</Label>
                            <Input
                                id="motivo"
                                placeholder="Ex: Prescrição Médica..."
                                value={form.motivo}
                                onChange={handleChange("motivo")}
                            />
                        </div>
                    </div>

                    {/* Observação */}
                    <div>
                        <Label htmlFor="observacao">Observação Geral</Label>
                        <Input
                            id="observacao"
                            placeholder="Opcional"
                            value={form.observacao}
                            onChange={handleChange("observacao")}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isLoading ? "Salvando..." : `Confirmar Saída ${form.itens.length > 0 ? `(${form.itens.length})` : ""}`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
