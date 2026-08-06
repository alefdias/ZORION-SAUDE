import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComboboxMedicamento } from "@/components/ui/combobox-medicamento";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";

const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

import { isMav } from "@/utils/mavUtils";
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
    data_devolucao: getLocalDateString(),
    observacao: "",
};

export default function DevolucaoForm({ open, onClose, onSave, medicamentos = [], lotes = [], alas = [], isLoading }) {
    const [form, setForm] = useState(emptyForm);

    useEffect(() => {
        if (open) setForm(emptyForm);
    }, [open]);

    const handleChange = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleMedicamento = (id) => {
        const med = medicamentos.find((m) => m.id === id);
        setForm((prev) => ({
            ...prev,
            medicamento_id: id,
            medicamento_nome: med?.nome || "",
            lote_id: "",
            numero_lote: ""
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
            toast.error("Selecione o lote para onde o medicamento retornará");
            return;
        }
        if (!form.quantidade || Number(form.quantidade) <= 0) {
            toast.error("Informe uma quantidade válida para devolução");
            return;
        }

        onSave({
            ...form,
            quantidade: Number(form.quantidade),
            ala_id: form.ala_id || null,
        });
    };

    const filteredLotes = lotes.filter(l => l.medicamento_id === form.medicamento_id);

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PackagePlus className="w-5 h-5 text-emerald-500" />
                        Nova Devolução de Medicamento (Ala)
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="med-select">Medicamento <span className="text-red-500">*</span></Label>
                        <ComboboxMedicamento
                            medicamentos={medicamentos}
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

                    <div>
                        <Label htmlFor="lote-select">Devolver para o Lote <span className="text-red-500">*</span></Label>
                        <Select
                            value={form.lote_id}
                            onValueChange={handleLote}
                            disabled={!form.medicamento_id || filteredLotes.length === 0}
                        >
                            <SelectTrigger id="lote-select">
                                <SelectValue placeholder={
                                    !form.medicamento_id ? "Selecione um medicamento primeiro" :
                                        filteredLotes.length === 0 ? "Sem lotes castrados" : "Selecione o lote..."
                                } />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredLotes.map((l) => {
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
                                        <SelectItem key={l.id} value={l.id}>
                                            {l.numero_lote} (Estoque atual: {l.quantidade_atual}) - Val: {formattedDate}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="quantidade">Qtd. Devolvida <span className="text-red-500">*</span></Label>
                            <Input
                                id="quantidade"
                                type="number"
                                min="1"
                                placeholder="0"
                                value={form.quantidade}
                                onChange={handleChange("quantidade")}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="data-devolucao">Data da Devolução</Label>
                            <Input
                                id="data-devolucao"
                                type="date"
                                value={form.data_devolucao}
                                onChange={handleChange("data_devolucao")}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="ala-select">Ala que Devolveu</Label>
                        <Select value={form.ala_id || "__none__"} onValueChange={handleAla}>
                            <SelectTrigger id="ala-select">
                                <SelectValue placeholder="Selecione a origem..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                                {alas.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

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
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isLoading ? "Salvando..." : "Confirmar Devolução"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
