import { useState, useEffect, useMemo } from "react";
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
    paciente_id: "",
    paciente_nome: "",
    motivo: "",
    observacao: "",
};

export default function SaidaForm({ open, onClose, onSave, initialData = null, initialMedId = null, medicamentos = [], lotes = [], alas = [], isLoading }) {
    const [form, setForm] = useState(emptyForm);
    const [currentItem, setCurrentItem] = useState({ medicamento_id: "", medicamento_nome: "", lote_id: "", numero_lote: "", quantidade: "" });
    const [modoDigitarManual, setModoDigitarManual] = useState(false);

    const { data: pacientes = [] } = useQuery({
        queryKey: ['pacientes'],
        queryFn: () => db.entities.Paciente.list(),
    });

    const { data: transferencias = [] } = useQuery({
        queryKey: ['transferencias_pendentes'],
        queryFn: () => db.entities.TransferenciaPendente.list(),
    });

    const { data: todasSaidas = [] } = useQuery({
        queryKey: ['saidas'],
        queryFn: () => db.entities.Saida.list(),
    });

    const { data: pedidosSatelite = [] } = useQuery({
        queryKey: ['pedidos_satelite'],
        queryFn: () => db.entities.PedidoSatelite.list(),
    });

    // Filtra estritamente apenas medicamentos que possuem saldo na Farmácia Satélite para evitar qualquer confusão
    const medsParaExibir = useMemo(() => {
        return medicamentos.filter(m => {
            if (initialData?.medicamento_id === m.id || currentItem.medicamento_id === m.id) return true;
            return m.ativo !== false && !m.deleted_at && (Number(m.estoque_satelite) || 0) > 0;
        });
    }, [medicamentos, initialData, currentItem.medicamento_id]);

    // Calcula de forma precisa o saldo de cada lote que de fato foi transferido e recebido na Farmácia Satélite
    const filteredLotes = useMemo(() => {
        if (!currentItem.medicamento_id) return [];

        const med = medicamentos.find(m => m.id === currentItem.medicamento_id);
        const saldoTotalSatelite = Number(med?.estoque_satelite) || 0;
        if (saldoTotalSatelite <= 0) return [];

        const lotesDoMed = lotes.filter(l => l.medicamento_id === currentItem.medicamento_id);
        if (lotesDoMed.length === 0) return [];

        const mapaSaldoLote = {};
        lotesDoMed.forEach(l => {
            mapaSaldoLote[l.id] = 0;
        });

        // 1. Entradas por transferências aceitas para a satélite
        transferencias.forEach(t => {
            if (t.direcao === "para_satelite" && (t.status === "Aceito" || t.status === "aceito")) {
                const mId = t.medicamento_id || t.medicamentoId;
                if (mId === currentItem.medicamento_id) {
                    const lId = t.lote_id || t.loteId;
                    const matchLote = lotesDoMed.find(l => l.id === lId || l.numero_lote === t.numero_lote);
                    if (matchLote) {
                        mapaSaldoLote[matchLote.id] = (mapaSaldoLote[matchLote.id] || 0) + (Number(t.quantidade) || 0);
                    }
                }
            }
        });

        // 2. Entradas por pedidos da satélite concluídos
        pedidosSatelite.forEach(p => {
            if (p.status === "Concluido" || p.status === "Entregue") {
                try {
                    const itens = Array.isArray(p.itens_json) ? p.itens_json : JSON.parse(p.itens_json || "[]");
                    itens.forEach(it => {
                        const mId = it.medicamento_id || it.medicamentoId;
                        if (mId === currentItem.medicamento_id) {
                            const matchLote = lotesDoMed.find(l => l.id === it.lote_id || l.numero_lote === it.numero_lote);
                            if (matchLote) {
                                mapaSaldoLote[matchLote.id] = (mapaSaldoLote[matchLote.id] || 0) + (Number(it.quantidade_atendida || it.quantidade) || 0);
                            }
                        }
                    });
                } catch (e) {}
            }
        });

        // 3. Entradas por transferências registradas diretamente em Saidas (destino Farmácia Satélite)
        todasSaidas.forEach(s => {
            const isTransfParaSat = (s.destino && s.destino.toLowerCase().includes("satélite")) || s.motivo === "Transferência de Estoque";
            const mId = s.medicamento_id || s.medicamentoId;
            if (isTransfParaSat && mId === currentItem.medicamento_id) {
                const matchLote = lotesDoMed.find(l => l.id === s.lote_id || l.numero_lote === s.numero_lote);
                if (matchLote) {
                    mapaSaldoLote[matchLote.id] = (mapaSaldoLote[matchLote.id] || 0) + (Number(s.quantidade) || 0);
                }
            }
        });

        // 4. Subtrair saídas já realizadas pela Farmácia Satélite (dispensações a pacientes)
        todasSaidas.forEach(s => {
            const isTransfParaSat = (s.destino && s.destino.toLowerCase().includes("satélite")) || s.motivo === "Transferência de Estoque";
            if (!isTransfParaSat) {
                const mId = s.medicamento_id || s.medicamentoId;
                if (mId === currentItem.medicamento_id) {
                    const matchLote = lotesDoMed.find(l => l.id === s.lote_id || l.numero_lote === s.numero_lote);
                    if (matchLote) {
                        mapaSaldoLote[matchLote.id] = (mapaSaldoLote[matchLote.id] || 0) - (Number(s.quantidade) || 0);
                    }
                }
            }
        });

        // Filtra estritamente lotes que possuem saldo na Farmácia Satélite
        const lotesComCalculo = lotesDoMed.map(l => ({
            ...l,
            saldoSatelite: Math.max(0, mapaSaldoLote[l.id] || 0)
        })).filter(l => l.saldoSatelite > 0);

        if (lotesComCalculo.length > 0) {
            return lotesComCalculo.sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
        }

        // Se não houver histórico de movimentações detalhadas por lote, distribui o saldo da satélite por FEFO
        // limitando estritamente ao total disponível na satélite (nunca exibindo lotes centrais a mais)
        const lotesOrdenados = [...lotesDoMed].sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
        let saldoRestanteSat = saldoTotalSatelite;
        const lotesFallback = [];

        for (const l of lotesOrdenados) {
            if (saldoRestanteSat <= 0) break;
            const saldoAtribuido = Math.min(saldoRestanteSat, Number(l.quantidade_atual) || saldoRestanteSat);
            if (saldoAtribuido > 0) {
                lotesFallback.push({
                    ...l,
                    saldoSatelite: saldoAtribuido
                });
                saldoRestanteSat -= saldoAtribuido;
            }
        }

        if (lotesFallback.length > 0) {
            return lotesFallback;
        }

        if (lotesOrdenados.length > 0) {
            return [{
                ...lotesOrdenados[0],
                saldoSatelite: saldoTotalSatelite
            }];
        }

        return [];
    }, [currentItem.medicamento_id, medicamentos, lotes, transferencias, pedidosSatelite, todasSaidas]);

    const selectLoteFEFO = (medId) => {
        const lotesDoMed = filteredLotes.filter(l => l.medicamento_id === medId);
        return lotesDoMed.length > 0 ? lotesDoMed[0] : null;
    };

    useEffect(() => {
        if (open) {
            setModoDigitarManual(false);
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
                    paciente_id: initialData.paciente_id || "",
                    paciente_nome: initialData.paciente_nome || "",
                    motivo: initialData.motivo || "",
                    observacao: initialData.observacao || "",
                });
            } else if (initialMedId) {
                setForm(emptyForm);
                const med = medicamentos.find(m => m.id === initialMedId);
                const loteFefo = selectLoteFEFO(initialMedId);
                setCurrentItem({
                    medicamento_id: initialMedId,
                    medicamento_nome: med?.nome || "",
                    lote_id: loteFefo ? loteFefo.id : "",
                    numero_lote: loteFefo ? loteFefo.numero_lote : "",
                    quantidade: ""
                });
            } else {
                setForm(emptyForm);
                setCurrentItem({ medicamento_id: "", medicamento_nome: "", lote_id: "", numero_lote: "", quantidade: "" });
            }
        }
    }, [open, initialData, initialMedId]);

    const handleChange = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleMedicamento = (id) => {
        const med = medicamentos.find((m) => m.id === id);
        const loteFefo = selectLoteFEFO(id);

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
            setForm((prev) => ({ ...prev, ala_id: "", ala_nome: "", paciente_id: "", paciente_nome: "" }));
            setModoDigitarManual(false);
            return;
        }
        const ala = alas.find((a) => a.id === id);
        setForm((prev) => ({ ...prev, ala_id: id, ala_nome: ala?.nome || "", paciente_id: "", paciente_nome: "" }));
        setModoDigitarManual(false);
    };

    const handlePacienteSelect = (val) => {
        if (val === "__manual__") {
            setModoDigitarManual(true);
            setForm((prev) => ({ ...prev, paciente_id: "", paciente_nome: "" }));
            return;
        }
        const pac = pacientes.find((p) => p.id === val || p.nome === val);
        setForm((prev) => ({
            ...prev,
            paciente_id: pac?.id || "",
            paciente_nome: pac ? pac.nome : val,
        }));
    };

    const handleAddItem = () => {
        if (!currentItem.medicamento_id) {
            toast.error("Selecione um medicamento"); return;
        }
        if (filteredLotes.length > 0 && !currentItem.lote_id) {
            toast.error("Selecione um lote disponível"); return;
        }
        if (!currentItem.quantidade || Number(currentItem.quantidade) <= 0) {
            toast.error("Informe uma quantidade válida"); return;
        }

        const med = medicamentos.find(m => m.id === currentItem.medicamento_id);
        const saldoDisponivel = Number(med?.estoque_satelite) || 0;
        const jaAdicionado = form.itens
            .filter(i => i.medicamento_id === currentItem.medicamento_id)
            .reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);
            
        if (Number(currentItem.quantidade) + jaAdicionado > saldoDisponivel) {
            toast.error(`Quantidade informada (${Number(currentItem.quantidade) + jaAdicionado}) excede o saldo da Farmácia Satélite (${saldoDisponivel} un).`);
            return;
        }

        const loteEscolhido = filteredLotes.find(l => l.id === currentItem.lote_id);
        if (loteEscolhido && loteEscolhido.saldoSatelite !== undefined) {
            const jaAdicionadoLote = form.itens
                .filter(i => i.lote_id === currentItem.lote_id)
                .reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);
            if (Number(currentItem.quantidade) + jaAdicionadoLote > loteEscolhido.saldoSatelite) {
                toast.error(`Quantidade informada (${Number(currentItem.quantidade) + jaAdicionadoLote}) excede o saldo deste lote na Farmácia Satélite (${loteEscolhido.saldoSatelite} un).`);
                return;
            }
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
        if (!initialData && currentItem.medicamento_id && (currentItem.lote_id || filteredLotes.length === 0) && Number(currentItem.quantidade) > 0) {
            const med = medicamentos.find(m => m.id === currentItem.medicamento_id);
            const saldoDisponivel = Number(med?.estoque_satelite) || 0;
            const jaAdicionado = finalItens
                .filter(i => i.medicamento_id === currentItem.medicamento_id)
                .reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);
                
            if (Number(currentItem.quantidade) + jaAdicionado > saldoDisponivel) {
                toast.error(`Quantidade informada (${Number(currentItem.quantidade) + jaAdicionado}) excede o saldo da Farmácia Satélite (${saldoDisponivel} un).`);
                return;
            }
            finalItens.push({ ...currentItem, quantidade: Number(currentItem.quantidade) });
        }

        if (finalItens.length === 0) {
            toast.error("Adicione ao menos um medicamento para dar saída");
            return;
        }

        if (!form.ala_id || form.ala_id === "__none__" || !form.ala_nome || !form.ala_nome.trim()) {
            toast.error("Por favor, selecione a Ala / Setor de Destino (obrigatória).");
            return;
        }

        const nomePacienteLimpo = (form.paciente_nome || "").trim();
        if (!nomePacienteLimpo || nomePacienteLimpo === "__nenhum__") {
            toast.error("O Nome do Paciente é obrigatório. Não é permitido dispensar sem vincular o paciente.");
            return;
        }

        // Tentar resolver paciente_id se não estiver preenchido
        let finalPacId = form.paciente_id || "";
        if (!finalPacId && nomePacienteLimpo) {
            const pacEncontrado = pacientes.find(p => p.nome && p.nome.trim().toLowerCase() === nomePacienteLimpo.toLowerCase());
            if (pacEncontrado) finalPacId = pacEncontrado.id;
        }

        onSave({
            id: initialData?.id, // apenas para edição
            itens: finalItens,
            ala_id: form.ala_id,
            ala_nome: form.ala_nome,
            destino: `Paciente: ${nomePacienteLimpo} (${form.ala_nome})`,
            data_saida: form.data_saida,
            paciente_id: finalPacId,
            paciente_nome: nomePacienteLimpo,
            motivo: form.motivo || `Dispensação Paciente: ${nomePacienteLimpo}`,
            observacao: form.observacao
        });
    };

    const selectedMed = medicamentos.find(m => m.id === currentItem.medicamento_id);
    const selectedLote = filteredLotes.find(l => l.id === currentItem.lote_id);

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
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold text-slate-700">Medicamento</Label>
                                        <span 
                                            className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-300 flex items-center gap-1"
                                            title="Exibindo exclusivamente medicamentos com saldo disponível na Farmácia Satélite"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Estoque Satélite ({medsParaExibir.length})
                                        </span>
                                    </div>
                                    <ComboboxMedicamento
                                        medicamentos={medsParaExibir}
                                        value={currentItem.medicamento_id}
                                        onChange={handleMedicamento}
                                        placeholder={medsParaExibir.length === 0 ? "Nenhum medicamento com estoque na Satélite" : "Selecione o medicamento..."}
                                    />
                                    {medsParaExibir.length === 0 && (
                                        <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                                            ⚠️ Nenhum medicamento com saldo disponível na Farmácia Satélite. Solicite itens à Farmácia Central na aba de Pedidos.
                                        </p>
                                    )}
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
                                                        <div className="flex items-center justify-between w-full gap-2">
                                                            <span>{index === 0 ? "⭐ " : ""}{l.numero_lote} (Val: {l.data_validade || "N/I"})</span>
                                                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 ml-2">
                                                                Disp: {l.saldoSatelite} un
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    {selectedLote && (
                                        <div className="mt-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50/90 border border-emerald-200 rounded-md px-2.5 py-1 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Lote: <strong>{selectedLote.numero_lote}</strong>
                                            </span>
                                            <span className="text-emerald-950 font-bold bg-emerald-100/80 px-2 py-0.5 rounded">
                                                Saldo no Lote: {selectedLote.saldoSatelite} un
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-3 items-end pt-1">
                                <div className="flex-1 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold text-slate-700">Quantidade</Label>
                                        {selectedLote ? (
                                            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                Saldo no Lote: <strong className="font-bold">{selectedLote.saldoSatelite} un</strong>
                                            </span>
                                        ) : selectedMed ? (
                                            <span className="text-[10px] text-slate-500">
                                                Disponível na Satélite: <strong className="text-emerald-700 font-bold">{selectedMed.estoque_satelite || 0} un</strong>
                                            </span>
                                        ) : null}
                                    </div>
                                    <Input
                                        type="number"
                                        min="1"
                                        max={selectedLote ? selectedLote.saldoSatelite : (selectedMed ? (selectedMed.estoque_satelite || 0) : undefined)}
                                        placeholder="Qtd a dispensar..."
                                        value={currentItem.quantidade}
                                        onChange={(e) => setCurrentItem({ ...currentItem, quantidade: e.target.value })}
                                        className="text-xs h-9 bg-white"
                                    />
                                    {selectedLote && Number(currentItem.quantidade) > selectedLote.saldoSatelite ? (
                                        <p className="text-[10px] font-bold text-rose-600">
                                            ⚠️ Quantidade excede o saldo disponível deste lote na Satélite ({selectedLote.saldoSatelite} un)
                                        </p>
                                    ) : selectedMed && Number(currentItem.quantidade) > (selectedMed.estoque_satelite || 0) ? (
                                        <p className="text-[10px] font-bold text-rose-600">
                                            ⚠️ Quantidade excede o saldo disponível na Satélite ({selectedMed.estoque_satelite || 0} un)
                                        </p>
                                    ) : null}
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

                        {/* Nome do Paciente (Obrigatório) */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="paciente_nome" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                    Nome do Paciente <span className="text-rose-500 font-bold">*</span>
                                </Label>
                                <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                    Obrigatório
                                </span>
                            </div>
                            
                            {form.ala_id ? (
                                (() => {
                                    const pacientesDaAla = pacientes
                                        .filter(p => (p.alaId === form.ala_id || p.alaNome === form.ala_nome) && p.status === "Ativo");

                                    if (modoDigitarManual || pacientesDaAla.length === 0) {
                                        return (
                                            <div className="space-y-1">
                                                <Input
                                                    id="paciente_nome"
                                                    placeholder={pacientesDaAla.length === 0 ? "Nenhum paciente cadastrado nesta ala. Digite o nome..." : "Digite o nome completo do paciente..."}
                                                    value={form.paciente_nome}
                                                    onChange={(e) => setForm(prev => ({ ...prev, paciente_nome: e.target.value, paciente_id: "" }))}
                                                    className="text-xs h-9 bg-white border-slate-300"
                                                    autoFocus={modoDigitarManual}
                                                />
                                                {pacientesDaAla.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setModoDigitarManual(false); setForm(prev => ({ ...prev, paciente_nome: "", paciente_id: "" })); }}
                                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-semibold"
                                                    >
                                                        ← Selecionar da lista de pacientes da ala
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-1">
                                            <Select 
                                                value={form.paciente_id || form.paciente_nome || ""} 
                                                onValueChange={handlePacienteSelect}
                                            >
                                                <SelectTrigger className="text-xs h-9 bg-white">
                                                    <SelectValue placeholder="Selecione o paciente da ala..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {pacientesDaAla.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            {p.nome} {p.leito ? `(Leito: ${p.leito})` : ""}
                                                        </SelectItem>
                                                    ))}
                                                    <SelectItem value="__manual__" className="text-indigo-600 font-semibold border-t mt-1">
                                                        ✏️ Digitar outro paciente manualmente...
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    );
                                })()
                            ) : (
                                <Input
                                    id="paciente_nome"
                                    placeholder="Selecione a ala de destino primeiro..."
                                    disabled={true}
                                    className="text-xs h-9 bg-slate-50 text-slate-400 cursor-not-allowed"
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
