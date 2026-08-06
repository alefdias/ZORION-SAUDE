import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComboboxMedicamento } from "@/components/ui/combobox-medicamento";
import { AlertTriangle, Calendar } from "lucide-react";
import {  differenceInDays , parseISO } from "date-fns";
import { toast } from "sonner";

const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyForm = {
    medicamento_id: "",
    medicamento_nome: "",
    numero_lote: "",
    data_validade: "",
    data_entrada: getLocalDateString(),
    quantidade: "",
    valor_unitario: "",
    valor_total: "",
    fornecedor_id: "",
    fornecedor_nome: "",
    nota_fiscal: "",
    observacao: "",
};

export default function EntradaForm({ open, onClose, onSave, medicamentos = [], fornecedores = [], isLoading, entrada }) {
    const [form, setForm] = useState(emptyForm);

    useEffect(() => {
        if (open) {
            if (entrada) {
                setForm({
                    ...entrada,
                    data_entrada: entrada.data_entrada ? entrada.data_entrada.split("T")[0] : getLocalDateString(),
                    data_validade: entrada.data_validade ? entrada.data_validade.split("T")[0] : "",
                    quantidade: entrada.quantidade?.toString() || "",
                    valor_unitario: entrada.valor_unitario?.toString() || "",
                    valor_total: entrada.valor_total?.toString() || "",
                });
            } else {
                setForm(emptyForm);
            }
        }
    }, [open, entrada]);

    const handleChange = (field) => (e) => {
        const value = e.target.value;
        setForm((prev) => {
            const updated = { ...prev, [field]: value };
            return updated;
        });
    };

    const handleMedicamento = (id) => {
        const med = medicamentos.find((m) => m.id === id);
        setForm((prev) => ({ ...prev, medicamento_id: id, medicamento_nome: med?.nome || "" }));
    };

    const handleFornecedor = (id) => {
        if (id === "__none__") {
            setForm((prev) => ({ ...prev, fornecedor_id: "", fornecedor_nome: "" }));
            return;
        }
        const forn = fornecedores.find((f) => f.id === id);
        setForm((prev) => ({ ...prev, fornecedor_id: id, fornecedor_nome: forn?.nome || "" }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!form.medicamento_id) {
            toast.error("Por favor, selecione um medicamento");
            return;
        }
        if (!form.numero_lote) {
            toast.error("Por favor, informe o número do lote");
            return;
        }
        if (!form.data_validade) {
            toast.error("Por favor, informe a data de validade");
            return;
        }
        if (!form.quantidade || Number(form.quantidade) <= 0) {
            toast.error("Por favor, informe uma quantidade válida");
            return;
        }

        onSave({
            ...form,
            quantidade: Number(form.quantidade),
            valor_unitario: form.valor_unitario ? Number(form.valor_unitario) : null,
            valor_total: form.valor_total ? Number(form.valor_total) : null,
            fornecedor_id: form.fornecedor_id || null, // Garantir NULL para FK opcional
        });
    };

    // Calcular alerta de validade
    const validadeWarning = (() => {
        if (!form.data_validade) return null;
        const dias = differenceInDays(parseISO(form.data_validade), new Date());
        if (dias < 0) return { type: "error", msg: "Data de validade já vencida!" };
        if (dias <= 90) return { type: "warn", msg: `Vence em ${dias} dias — estoque curto!` };
        return null;
    })();

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {entrada ? "Editar Entrada de Medicamento" : "Nova Entrada de Medicamento"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Medicamento */}
                    <div>
                        <Label htmlFor="med-select">Medicamento <span className="text-red-500">*</span></Label>
                        <ComboboxMedicamento
                            medicamentos={medicamentos}
                            value={form.medicamento_id}
                            onChange={handleMedicamento}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Número do Lote */}
                        <div>
                            <Label htmlFor="numero-lote">Número do Lote <span className="text-red-500">*</span></Label>
                            <Input
                                id="numero-lote"
                                placeholder="Ex: LOT2025001"
                                value={form.numero_lote}
                                onChange={handleChange("numero_lote")}
                                required
                            />
                        </div>

                        {/* Data de Validade */}
                        <div>
                            <Label htmlFor="data-validade" className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                Data de Validade <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="data-validade"
                                type="date"
                                value={form.data_validade}
                                onChange={handleChange("data_validade")}
                                required
                                className={
                                    validadeWarning?.type === "error"
                                        ? "border-red-500 focus-visible:ring-red-400"
                                        : validadeWarning?.type === "warn"
                                            ? "border-amber-400 focus-visible:ring-amber-300"
                                            : ""
                                }
                            />
                            {validadeWarning && (
                                <p className={`text-xs flex items-center gap-1 mt-1 ${validadeWarning.type === "error" ? "text-red-600" : "text-amber-600"}`}>
                                    <AlertTriangle className="w-3 h-3" />
                                    {validadeWarning.msg}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Data de Entrada */}
                        <div>
                            <Label htmlFor="data-entrada">Data de Entrada</Label>
                            <Input
                                id="data-entrada"
                                type="date"
                                value={form.data_entrada}
                                onChange={handleChange("data_entrada")}
                                required
                            />
                        </div>

                        {/* Quantidade */}
                        <div>
                            <Label htmlFor="quantidade">Quantidade <span className="text-red-500">*</span></Label>
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
                    </div>



                    {/* Fornecedor */}
                    <div>
                        <Label htmlFor="fornecedor-select">Fornecedor</Label>
                        <Select value={form.fornecedor_id || "__none__"} onValueChange={handleFornecedor}>
                            <SelectTrigger id="fornecedor-select">
                                <SelectValue placeholder="Selecione o fornecedor..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">— Nenhum —</SelectItem>
                                {fornecedores.map((f) => (
                                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
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
                            {isLoading ? "Salvando..." : "Registrar Entrada"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
