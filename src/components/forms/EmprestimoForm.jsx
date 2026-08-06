import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandHelping, AlertTriangle } from "lucide-react";

const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyForm = {
    tipo: "emprestar", // 'emprestar' (out) or 'receber' (in)
    medicamento_id: "",
    medicamento_nome: "",
    lote_id: "",
    numero_lote: "",
    quantidade: "",
    ala_destino_id: "",
    ala_destino_nome: "",
    responsavel: "",
    data_emprestimo: getLocalDateString(),
    status: "pendente",
    observacao: "",
};

export default function EmprestimoForm({ open, onClose, onSave, medicamentos = [], lotes = [], alas = [], isLoading }) {
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

    const handleHospital = (e) => {
        setForm((prev) => ({ ...prev, ala_destino_id: null, ala_destino_nome: e.target.value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.medicamento_id || !form.quantidade) return;
        if (form.tipo === "emprestar" && !form.lote_id) return;

        onSave({
            ...form,
            quantidade: Number(form.quantidade),
            lote_id: form.lote_id || null,
            ala_destino_id: form.ala_destino_id || null,
        });
    };

    const filteredLotes = lotes.filter(l => l.medicamento_id === form.medicamento_id && (l.quantidade_atual || 0) > 0);
    const currentLote = lotes.find(l => l.id === form.lote_id);
    const stockExceeded = form.tipo === "emprestar" && currentLote && Number(form.quantidade) > (currentLote.quantidade_atual || 0);

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-purple-600">
                        <HandHelping className="w-5 h-5" />
                        Novo Registro de Empréstimo
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={form.tipo} onValueChange={(v) => setForm(p => ({ ...p, tipo: v }))} className="w-full">
                    <TabsList className="grid grid-cols-2 w-full mb-4">
                        <TabsTrigger value="emprestar">Emprestar</TabsTrigger>
                        <TabsTrigger value="receber">Receber</TabsTrigger>
                    </TabsList>
                </Tabs>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Medicamento */}
                    <div>
                        <Label>Medicamento <span className="text-red-500">*</span></Label>
                        <Select value={form.medicamento_id} onValueChange={handleMedicamento}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o medicamento..." />
                            </SelectTrigger>
                            <SelectContent>
                                {medicamentos.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.codigo && <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded mr-2 uppercase">{m.codigo}</span>}
                                        {m.nome}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Lote (Only mandatory for 'emprestar') */}
                    {form.tipo === "emprestar" ? (
                        <div>
                            <Label>Lote <span className="text-red-500">*</span></Label>
                            <Select
                                value={form.lote_id}
                                onValueChange={handleLote}
                                disabled={!form.medicamento_id || filteredLotes.length === 0}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={
                                        !form.medicamento_id ? "Selecione um medicamento primeiro" :
                                            filteredLotes.length === 0 ? "Sem lotes disponíveis" : "Selecione o lote..."
                                    } />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredLotes.map((l) => (
                                        <SelectItem key={l.id} value={l.id}>
                                            {l.numero_lote} (Stock: {l.quantidade_atual})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div>
                            <Label>Número do Lote (Opcional)</Label>
                            <Input
                                placeholder="Número do lote de origem"
                                value={form.numero_lote}
                                onChange={handleChange("numero_lote")}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {/* Quantidade */}
                        <div>
                            <Label>Quantidade <span className="text-red-500">*</span></Label>
                            <Input
                                type="number"
                                min="1"
                                placeholder="0"
                                value={form.quantidade}
                                onChange={handleChange("quantidade")}
                                required
                                className={stockExceeded ? "border-red-500 focus-visible:ring-red-400" : ""}
                            />
                            {stockExceeded && (
                                <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    Estoque insuficiente!
                                </p>
                            )}
                        </div>

                        {/* Data */}
                        <div>
                            <Label>Data do Registro</Label>
                            <Input
                                type="date"
                                value={form.data_emprestimo}
                                onChange={handleChange("data_emprestimo")}
                                required
                            />
                        </div>
                    </div>

                    {/* Hospital / Destino ou Origem */}
                    <div>
                        <Label>{form.tipo === "emprestar" ? "Hospital de Destino" : "Hospital de Origem"}</Label>
                        <Input
                            placeholder="Nome do hospital..."
                            value={form.ala_destino_nome}
                            onChange={handleHospital}
                            required
                        />
                    </div>

                    {/* Responsável */}
                    <div>
                        <Label>Responsável</Label>
                        <Input
                            placeholder="Nome do responsável"
                            value={form.responsavel}
                            onChange={handleChange("responsavel")}
                        />
                    </div>

                    {/* Observação */}
                    <div>
                        <Label>Observação</Label>
                        <Input
                            placeholder="Opcional"
                            value={form.observacao}
                            onChange={handleChange("observacao")}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button
                            type="submit"
                            disabled={isLoading || !form.medicamento_id || (form.tipo === "emprestar" && !form.lote_id) || !form.quantidade || stockExceeded}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {isLoading ? "Salvando..." : "Confirmar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
