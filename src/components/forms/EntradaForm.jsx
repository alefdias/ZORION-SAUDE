import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComboboxMedicamento } from "@/components/ui/combobox-medicamento";
import { ComboboxFornecedor } from "@/components/ui/combobox-fornecedor";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { AlertTriangle, CreditCard, ArrowLeftRight, CheckCircle2, Droplet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";
import { db } from "@/api/db";
import { isLiquido, extrairVolumeMl } from "@/utils/liquidUtils";

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
    volume_frasco_ml: "",
    atualizar_cadastro_med: false,
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
                    volume_frasco_ml: entrada.volume_frasco_ml?.toString() || "",
                    atualizar_cadastro_med: false,
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
        const isLiq = med ? (isLiquido(med) || med.is_liquido) : false;
        const vol = isLiq ? (med.volume_frasco_ml || extrairVolumeMl(med) || "") : "";
        setForm((prev) => ({ 
            ...prev, 
            medicamento_id: id, 
            medicamento_nome: med?.nome || "",
            volume_frasco_ml: vol ? String(vol) : prev.volume_frasco_ml,
            atualizar_cadastro_med: false
        }));
    };

    const handleFornecedor = (id) => {
        if (id === "__none__") {
            setForm((prev) => ({ ...prev, fornecedor_id: "", fornecedor_nome: "" }));
            return;
        }
        const forn = fornecedores.find((f) => f.id === id);
        setForm((prev) => ({ ...prev, fornecedor_id: id, fornecedor_nome: forn?.nome || "" }));
    };

    const selectedMed = medicamentos.find((m) => m.id === form.medicamento_id);
    const isAdiantamento = selectedMed ? (selectedMed.is_adiantamento === true || selectedMed.is_adiantamento === 1 || selectedMed.is_adiantamento === "1" || selectedMed.is_adiantamento === "true") : false;

    const handleToggleAdiantamento = async () => {
        if (!selectedMed) return;
        const isCurrent = selectedMed.is_adiantamento === true || selectedMed.is_adiantamento === 1 || selectedMed.is_adiantamento === "1" || selectedMed.is_adiantamento === "true";
        const novoStatus = isCurrent ? 0 : 1;
        try {
            await db.entities.Medicamento.update(selectedMed.id, {
                is_adiantamento: novoStatus,
                nota_fiscal: novoStatus ? (selectedMed.nota_fiscal || "") : "",
                valor_compra: novoStatus ? (selectedMed.valor_compra || "") : "",
                fornecedor_nome: novoStatus ? (selectedMed.fornecedor_nome || "") : ""
            });
            selectedMed.is_adiantamento = novoStatus;
            queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
            await db.logAction(
                "ALTERACAO_STATUS_ADIANTAMENTO",
                "Medicamento",
                selectedMed.id,
                `Medicamento '${selectedMed.nome}' teve status de adiantamento alterado para: ${novoStatus ? 'Adiantamento (Cartão do Estado)' : 'Compra Regular / Padronizado'}`
            );
            toast.success(
                novoStatus
                    ? `O medicamento '${selectedMed.nome}' foi marcado como Compra por Adiantamento!`
                    : `O medicamento '${selectedMed.nome}' agora é Compra Regular (deixou de ser adiantamento)!`
            );
            setForm(prev => ({ ...prev }));
        } catch (err) {
            toast.error("Erro ao alternar status de adiantamento: " + err);
        }
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
            volume_frasco_ml: form.volume_frasco_ml ? Number(form.volume_frasco_ml) : null,
            atualizar_cadastro_med: Boolean(form.atualizar_cadastro_med),
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
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
                <DialogHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                        {entrada ? "Editar Entrada de Medicamento" : "Nova Entrada de Medicamento"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
                    <div className="p-5 overflow-y-auto space-y-4 flex-1">
                        {/* Medicamento */}
                        <div>
                            <Label htmlFor="med-select">Medicamento <span className="text-red-500">*</span></Label>
                        <ComboboxMedicamento
                            medicamentos={medicamentos}
                            value={form.medicamento_id}
                            onChange={handleMedicamento}
                        />

                        {/* Banner Visual de Adiantamento / Compra Regular */}
                        {selectedMed && (
                            <div className={`mt-2.5 rounded-xl p-3 border transition-all text-xs ${
                                isAdiantamento 
                                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800" 
                                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                            }`}>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-2 rounded-lg ${isAdiantamento ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}`}>
                                            <CreditCard className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 font-bold">
                                                <span className={isAdiantamento ? "text-amber-900 dark:text-amber-200" : "text-slate-800 dark:text-slate-200"}>
                                                    {isAdiantamento ? "Compra por Adiantamento (Cartão do Estado)" : "Compra Regular / Pregão Hospitalar"}
                                                </span>
                                            </div>
                                            <p className={`text-[11px] mt-0.5 ${isAdiantamento ? "text-amber-700/90 dark:text-amber-400/90" : "text-slate-500 dark:text-slate-400"}`}>
                                                {isAdiantamento 
                                                    ? "Esta entrada será contabilizada no Relatório de Adiantamento da Farmácia Satélite." 
                                                    : "Entrada de fluxo de estoque padrão (sem vínculo com verba de adiantamento)."}
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleToggleAdiantamento}
                                        className={`h-7 text-xs font-semibold gap-1.5 shrink-0 shadow-sm ${
                                            isAdiantamento 
                                                ? "border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300" 
                                                : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300"
                                        }`}
                                    >
                                        <ArrowLeftRight className="w-3 h-3" />
                                        {isAdiantamento ? "Deixar de ser Adiantamento (Tornar Regular)" : "Vincular a Adiantamento"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Indicador e Ajuste de Volume por Frasco/Lote para Medicamento Líquido */}
                        {selectedMed && (isLiquido(selectedMed) || selectedMed.is_liquido) && (
                            <div className="mt-2.5 rounded-xl p-3.5 border bg-sky-50/90 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 text-xs space-y-3 shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Droplet className="w-5 h-5 text-sky-600 animate-pulse shrink-0" />
                                        <div>
                                            <p className="font-bold text-sky-950 dark:text-sky-100 text-sm">
                                                Medicamento Líquido Multidose
                                            </p>
                                            <p className="text-[11px] text-sky-700 dark:text-sky-300">
                                                A quantidade desta entrada deve ser registrada em <strong>unidades de FRASCOS</strong>.
                                            </p>
                                        </div>
                                    </div>
                                    <Badge className="bg-sky-600 text-white font-mono text-xs px-2.5 py-0.5 shadow-sm">
                                        {form.volume_frasco_ml ? `${form.volume_frasco_ml} mL / frasco` : "Defina o volume"}
                                    </Badge>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-sky-200 dark:border-sky-900 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                    <div>
                                        <Label htmlFor="vol-frasco-lote" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                            Volume do Frasco deste Lote (mL):
                                        </Label>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <Input
                                                id="vol-frasco-lote"
                                                type="number"
                                                min="1"
                                                placeholder="Ex: 10, 20, 100, 120"
                                                value={form.volume_frasco_ml}
                                                onChange={(e) => setForm(prev => ({ ...prev, volume_frasco_ml: e.target.value }))}
                                                className="h-8 font-bold text-sky-900 dark:text-sky-100 bg-sky-50/60 border-sky-300 focus:bg-white"
                                            />
                                            <span className="text-xs font-bold text-slate-500">mL</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            * Se este lote veio com frasco diferente (ex: 100 mL em vez de 120 mL), altere aqui.
                                        </p>
                                    </div>

                                    <div className="flex items-start space-x-2 pt-1 sm:pt-0">
                                        <input
                                            type="checkbox"
                                            id="chk-atualizar-cadastro"
                                            checked={Boolean(form.atualizar_cadastro_med)}
                                            onChange={(e) => setForm(prev => ({ ...prev, atualizar_cadastro_med: e.target.checked }))}
                                            className="h-4 w-4 mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                        />
                                        <Label htmlFor="chk-atualizar-cadastro" className="text-xs text-slate-600 dark:text-slate-300 font-normal cursor-pointer leading-tight">
                                            Atualizar também o cadastro padrão deste medicamento para <strong>{form.volume_frasco_ml || '...'} mL</strong>
                                        </Label>
                                    </div>
                                </div>
                            </div>
                        )}
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
                            <DatePickerField
                                id="data-validade"
                                label="Data de Validade"
                                required
                                value={form.data_validade}
                                onChange={(v) => setForm(prev => ({ ...prev, data_validade: v }))}
                                errorClass={
                                    validadeWarning?.type === "error"
                                        ? "border-red-500"
                                        : validadeWarning?.type === "warn"
                                            ? "border-amber-400"
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
                        <DatePickerField
                            id="data-entrada"
                            label="Data de Entrada"
                            value={form.data_entrada}
                            onChange={(v) => setForm(prev => ({ ...prev, data_entrada: v }))}
                        />

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
                        <Label htmlFor="fornecedor-select">Fornecedor / Distribuidora</Label>
                        <ComboboxFornecedor
                            fornecedores={fornecedores}
                            value={form.fornecedor_id}
                            onChange={handleFornecedor}
                            placeholder="Selecione ou busque a distribuidora..."
                        />
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
                </div>

                <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 font-semibold text-white shadow-sm"
                    >
                        {isLoading ? "Salvando..." : "Registrar Entrada"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
);
}
