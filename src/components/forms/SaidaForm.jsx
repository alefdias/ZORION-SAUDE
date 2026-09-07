import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

        if (!form.ala_id || form.ala_id === "__none__" || !form.ala_nome) {
            toast.error("Por favor, selecione a Ala / Setor de Destino obrigatória.");
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
            ala_id: form.ala_id,
            ala_nome: form.ala_nome,
            destino: form.ala_nome,
            data_saida: form.data_saida,
            paciente_nome: form.paciente_nome,
            motivo: form.motivo || (form.paciente_nome ? `Atendimento Paciente: ${form.paciente_nome}` : `Dispensação Ala: ${form.ala_nome}`),
            observacao: form.observacao
        });
    };

    const filteredLotes = lotes
        .filter(l => l.medicamento_id === currentItem.medicamento_id)
        .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
        
    const selectedMed = medicamentos.find(m => m.id === currentItem.medicamento_id);

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6">
                <DialogHeader className="border-b pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white shadow-md shadow-red-500/20">
                            <PackageMinus className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-900">
                                {initialData ? "Editar Saída de Medicamento" : "Nova Saída & Dispensação"}
                            </DialogTitle>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Baixa de estoque da Farmácia Satélite para atendimento a pacientes ou setores
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                    {/* Sessão de Adição de Itens (Oculto na edição) */}
                    {!initialData && (
                        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3.5 shadow-xs">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <span>Adicionar Medicamento</span>
                                </h3>
                                {selectedMed && (
                                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        Saldo Satélite: <strong>{selectedMed.estoque_satelite || 0} un</strong>
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700">Medicamento</Label>
                                    <ComboboxMedicamento
                                        medicamentos={medicamentos}
                                        value={currentItem.medicamento_id}
                                        onChange={handleMedicamento}
                                    />
                                    {isMav(currentItem.medicamento_nome) && (
                                        <p className="text-[10px] font-bold text-red-700 mt-1 flex items-center gap-1 bg-red-50 p-1 rounded border border-red-200">
                                            <AlertTriangle className="w-3 h-3 text-red-600" /> Medicamento de Alta Vigilância (MAV)
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold text-slate-700">Lote</Label>
                                        {filteredLotes.length > 0 && (
                                            <span className="text-[10px] text-amber-700 font-medium">⭐ FEFO (Mais próximo)</span>
                                        )}
                                    </div>
                                    <Select
                                        value={currentItem.lote_id}
                                        onValueChange={handleLote}
                                        disabled={!currentItem.medicamento_id || filteredLotes.length === 0}
                                    >
                                        <SelectTrigger className="text-xs bg-white h-9">
                                            <SelectValue placeholder={
                                                !currentItem.medicamento_id ? "Selecione o medicamento..." :
                                                    filteredLotes.length === 0 ? "Sem lotes cadastrados" : "Selecione o lote"
                                            } />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filteredLotes.map((l, index) => {
                                                return (
                                                    <SelectItem key={l.id} value={l.id} className={index === 0 ? "font-bold text-amber-800 bg-amber-50/60" : ""}>
                                                        {index === 0 ? "⭐ " : ""}{l.numero_lote} (Validade: {l.data_validade || "N/I"})
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex gap-3 items-end pt-1">
                                <div className="flex-1 space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700">Quantidade</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        placeholder="Qtd a dispensar..."
                                        value={currentItem.quantidade}
                                        onChange={(e) => setCurrentItem({ ...currentItem, quantidade: e.target.value })}
                                        className="text-xs h-9 bg-white"
                                    />
                                </div>
                                <Button 
                                    type="button" 
                                    onClick={handleAddItem} 
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 shrink-0 shadow-xs"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar Item
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Tabela de Itens Selecionados */}
                    {form.itens.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                            <div className="bg-slate-100/90 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                                    Medicamentos a Baixar ({form.itens.length})
                                </span>
                                <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                    Total: -{form.itens.reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0)} un
                                </span>
                            </div>
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-2.5 text-left">Medicamento</th>
                                        <th className="p-2.5 text-left">Lote</th>
                                        <th className="p-2.5 text-center">Quantidade</th>
                                        {!initialData && <th className="p-2.5 w-10 text-center"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {form.itens.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                            <td className="p-2.5 font-bold text-slate-800">{item.medicamento_nome}</td>
                                            <td className="p-2.5">
                                                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px] text-slate-700">
                                                    {item.numero_lote || "-"}
                                                </span>
                                            </td>
                                            <td className="p-2.5 text-center">
                                                <span className="inline-flex items-center font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                                                    -{item.quantidade} un
                                                </span>
                                            </td>
                                            {!initialData && (
                                                <td className="p-2.5 text-center">
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded" 
                                                        onClick={() => handleRemoveItem(idx)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* Data de Saída */}
                        <DatePickerField
                            id="data-saida"
                            label="Data da Saída"
                            value={form.data_saida}
                            onChange={(v) => setForm(prev => ({ ...prev, data_saida: v }))}
                        />

                        {/* Ala / Destino (Obrigatório) */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="ala-select" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                    Ala / Setor de Destino <span className="text-rose-500 font-bold">*</span>
                                </Label>
                                <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                    Obrigatório
                                </span>
                            </div>
                            <Select value={form.ala_id || ""} onValueChange={handleAla}>
                                <SelectTrigger id="ala-select" className={cn("text-xs h-9 bg-white", !form.ala_id && "border-slate-300")}>
                                    <SelectValue placeholder="Selecione a Ala de Destino..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {alas.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Nome do Paciente (Opcional) */}
                        <div className="space-y-1.5">
                            <Label htmlFor="paciente_nome" className="text-xs font-semibold text-slate-700">
                                Nome do Paciente <span className="text-slate-400 font-normal">(Opcional)</span>
                            </Label>
                            
                            {form.ala_id ? (
                                <Select 
                                    value={form.paciente_nome} 
                                    onValueChange={(val) => setForm(prev => ({ ...prev, paciente_nome: val === "__nenhum__" ? "" : val }))}
                                >
                                    <SelectTrigger className="text-xs h-9 bg-white">
                                        <SelectValue placeholder="Selecione um paciente da ala..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__nenhum__">— Sem paciente vinculado —</SelectItem>
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
                                    placeholder="Selecione a ala para listar os pacientes..."
                                    disabled={!form.ala_id}
                                    value={form.paciente_nome === "__nenhum__" ? "" : (form.paciente_nome || "")}
                                    onChange={handleChange("paciente_nome")}
                                    className="text-xs h-9 bg-white"
                                />
                            )}
                        </div>

                        {/* Observação / Justificativa (Opcional) */}
                        <div className="space-y-1.5">
                            <Label htmlFor="observacao" className="text-xs font-semibold text-slate-700">
                                Observação / Justificativa <span className="text-slate-400 font-normal">(Opcional)</span>
                            </Label>
                            <Input
                                id="observacao"
                                placeholder="Informações complementares (opcional)..."
                                value={form.observacao}
                                onChange={handleChange("observacao")}
                                className="text-xs h-9 bg-white"
                            />
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-4 gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isLoading}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 h-9 px-5"
                        >
                            {isLoading ? "Salvando..." : `Confirmar Saída ${form.itens.length > 0 ? `(${form.itens.length} itens)` : ""}`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
