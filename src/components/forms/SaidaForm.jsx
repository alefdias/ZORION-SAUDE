import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComboboxMedicamento } from "@/components/ui/combobox-medicamento";
import { AlertTriangle, PackageMinus } from "lucide-react";
import { toast } from "sonner";

const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

import { isMav, isPsicotropico } from "@/utils/mavUtils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const emptyForm = {
    medicamento_id: "",
    medicamento_nome: "",
    lote_id: "",
    numero_lote: "",
    quantidade: "",
    ala_id: "",
    ala_nome: "",
    data_saida: getLocalDateString(),
    paciente_nome: "",
    motivo: "",
    observacao: "",
};

export default function SaidaForm({ open, onClose, onSave, initialData = null, medicamentos = [], lotes = [], alas = [], isLoading }) {
    const [form, setForm] = useState(emptyForm);

    useEffect(() => {
        if (open) {
            if (initialData) {
                setForm({
                    ...initialData,
                    ala_id: initialData.ala_id || "",
                });
            } else {
                setForm(emptyForm);
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

        setForm((prev) => ({
            ...prev,
            medicamento_id: id,
            medicamento_nome: med?.nome || "",
            lote_id: loteFefo ? loteFefo.id : "",
            numero_lote: loteFefo ? loteFefo.numero_lote : ""
        }));
    };

    const handleLote = (id) => {
        const lote = lotes.find((l) => l.id === id);
        setForm((prev) => ({
            ...prev,
            lote_id: id,
            numero_lote: lote?.numero_lote || ""
        }));
    };

    const handleAla = (id) => {
        if (id === "__none__") {
            setForm((prev) => ({ ...prev, ala_id: "", ala_nome: "" }));
            return;
        }
        const ala = alas.find((a) => a.id === id);
        setForm((prev) => ({ ...prev, ala_id: id, ala_nome: ala?.nome || "" }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!form.medicamento_id) {
            toast.error("Selecione um medicamento");
            return;
        }
        if (!form.lote_id) {
            toast.error("Selecione um lote disponível");
            return;
        }
        if (!form.quantidade || Number(form.quantidade) <= 0) {
            toast.error("Informe uma quantidade válida");
            return;
        }

        const selectedMed = medicamentos.find(m => m.id === form.medicamento_id);
        if (selectedMed && Number(form.quantidade) > Number(selectedMed.estoque_satelite || 0)) {
            toast.error("Quantidade excede o estoque disponível na Farmácia Satélite");
            return;
        }

        const requerNome = selectedMed && (isPsicotropico(selectedMed.categoria) || isMav(selectedMed.nome));
        if (requerNome && (!form.paciente_nome || !form.paciente_nome.trim())) {
            // Apenas aviso, não bloqueia o envio
            toast.warning("Recomendado: informe o nome do paciente para medicamentos de Controle Especial ou MAV.");
        }

        onSave({
            ...form,
            quantidade: Number(form.quantidade),
            ala_id: form.ala_id || null, // Garantir NULL para FK opcional
        });
    };

    const filteredLotes = lotes
        .filter(l => l.medicamento_id === form.medicamento_id)
        .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
        
    const selectedMed = medicamentos.find(m => m.id === form.medicamento_id);
    const stockExceeded = selectedMed && Number(form.quantidade) > Number(selectedMed.estoque_satelite || 0);
    
    // Memoize the filtered array to avoid expensive re-creations on every render (e.g. when typing)
    const satelliteMedicamentos = useMemo(() => {
        return medicamentos.filter(m => Number(m.estoque_satelite || 0) > 0);
    }, [medicamentos]);

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PackageMinus className="w-5 h-5 text-red-500" />
                        {initialData ? "Editar Saída de Medicamento" : "Nova Saída de Medicamento"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Medicamento */}
                    <div>
                        <Label htmlFor="med-select">Medicamento <span className="text-red-500">*</span></Label>
                        <ComboboxMedicamento
                            medicamentos={satelliteMedicamentos}
                            value={form.medicamento_id}
                            onChange={handleMedicamento}
                        />
                        {isMav(form.medicamento_nome) && (
                            <p className="text-sm font-bold text-red-900 mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                Medicamento de Alta Vigilância (MAV)
                            </p>
                        )}
                    </div>

                    {/* Lote */}
                    <div>
                        <Label htmlFor="lote-select">Lote <span className="text-red-500">*</span></Label>
                        <Select
                            value={form.lote_id}
                            onValueChange={handleLote}
                            disabled={!form.medicamento_id || filteredLotes.length === 0}
                        >
                            <SelectTrigger id="lote-select">
                                <SelectValue placeholder={
                                    !form.medicamento_id ? "Selecione um medicamento primeiro" :
                                        filteredLotes.length === 0 ? "Sem lotes disponíveis" : "Selecione o lote..."
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
                                            {index === 0 ? "⭐ " : ""}{l.numero_lote} (Stock: {l.quantidade_atual}) - Val: {formattedDate} {index === 0 ? "(Vence Primeiro)" : ""}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        {selectedMed && (
                            <p className="text-xs text-slate-500 mt-1">
                                Estoque disponível na Satélite: <span className="font-bold">{selectedMed.estoque_satelite || 0}</span>
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Quantidade */}
                        <div>
                            <Label htmlFor="quantidade">Quantidade <span className="text-red-500">*</span></Label>
                            <Input
                                id="quantidade"
                                type="number"
                                min="1"
                                max={selectedMed?.estoque_satelite || 1}
                                placeholder="0"
                                value={form.quantidade}
                                onChange={handleChange("quantidade")}
                                required
                                className={stockExceeded ? "border-red-500 focus-visible:ring-red-400" : ""}
                            />
                            {stockExceeded && (
                                <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    Quantidade excede o estoque!
                                </p>
                            )}
                        </div>

                        {/* Data de Saída */}
                        <div>
                            <Label htmlFor="data-saida">Data de Saída</Label>
                            <Input
                                id="data-saida"
                                type="date"
                                value={form.data_saida}
                                onChange={handleChange("data_saida")}
                                required
                            />
                        </div>
                    </div>

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
                        <Label htmlFor="paciente_nome" className="flex items-center gap-1">
                            Nome do Paciente
                            {(isPsicotropico(selectedMed?.categoria) || isMav(selectedMed?.nome)) ? (
                                <span className="text-amber-500 text-xs font-semibold ml-1">(Recomendado para MAV / Controle Especial)</span>
                            ) : (
                                <span className="text-slate-400 text-xs ml-1">(Opcional)</span>
                            )}
                        </Label>
                        <Input
                            id="paciente_nome"
                            placeholder="Nome completo do paciente recebedor/destinatário"
                            value={form.paciente_nome || ""}
                            onChange={handleChange("paciente_nome")}
                            className={(isPsicotropico(selectedMed?.categoria) || isMav(selectedMed?.nome)) && !form.paciente_nome ? "border-amber-300 focus-visible:ring-amber-300" : ""}
                        />
                        {(isPsicotropico(selectedMed?.categoria) || isMav(selectedMed?.nome)) && (
                            <p className="text-xs text-amber-600 mt-1 font-medium">
                                Recomendado para medicamentos de controle especial ou alta vigilância (MAV).
                            </p>
                        )}
                    </div>

                    {/* Motivo */}
                    <div>
                        <Label htmlFor="motivo">Motivo da Saída</Label>
                        <Input
                            id="motivo"
                            placeholder="Ex: Prescrição Médica, Vencimento..."
                            value={form.motivo}
                            onChange={handleChange("motivo")}
                        />
                    </div>

                    {/* Observação */}
                    <div>
                        <Label htmlFor="observacao">Observação</Label>
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
                            {isLoading ? "Salvando..." : "Confirmar Saída"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
