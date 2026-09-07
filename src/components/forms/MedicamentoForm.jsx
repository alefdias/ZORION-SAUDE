import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/api/db";

export function normalizeApresentacao(str) {
    if (!str) return "";
    let s = str.trim().toUpperCase();
    s = s.replace(/\s+/g, ' ');
    // Padroniza vírgula em números decimais (ex: 0.25 -> 0,25)
    s = s.replace(/(\d+)\.(\d+)/g, '$1,$2');
    // Padroniza espaço único entre número e unidade de medida (ex: 10ML -> 10 ML, 1ML -> 1 ML, 20ML -> 20 ML)
    s = s.replace(/(\d+)\s*(ML|MG|G|MCG|L)\b/gi, '$1 $2');
    s = s.replace(/(\d+),(\d+)\s*(ML|MG|G|MCG|L)\b/gi, '$1,$2 $3');
    return s;
}

const CATEGORIAS = [
    "PSICOTRÓPICO / CONTROLADO (PORTARIA 344)",
    "IMUNOSSUPRESSOR (PORTARIA 344 - LISTA C3)",
    "ANTIBIÓTICO / ANTIMICROBIANO",
    "CLÍNICOS - ANALGÉSICO E ANTITERMICO",
    "CLÍNICOS - ANESTÉSICO",
    "CLÍNICOS - ANTIAGREGANTE PLAQUETÁRIO E ANTICOAGULANTE",
    "CLÍNICOS - ANTIARRÍTMICO E CARDIOLÓGICO",
    "CLÍNICOS - ANTIEMÉTICO E GASTROPROTETOR",
    "CLÍNICOS - ANTIHIPERTENSIVO",
    "CLÍNICOS - ANTIHISTAMINICO E ANTIALÉRGICO",
    "CLÍNICOS - ANTIINFLAMATÓRIO",
    "CLÍNICOS - ANTIPARASITÁRIO E ANTIFÚNGICO",
    "CLÍNICOS - ANTIVIRAL",
    "CLÍNICOS - BRONCODILATADOR E RESPIRATÓRIO",
    "CLÍNICOS - MUCOLÍTICO E EXPECTORANTE",
    "CLÍNICOS - CORTICOSTERÓIDE",
    "CLÍNICOS - DIURÉTICO",
    "CLÍNICOS - HORMÔNIO E ENDÓCRINO",
    "CLÍNICOS - SOLUÇÃO PARENTERAL E ELETROLÍTO",
    "VITAMINAS E SUPLEMENTOS",
    "OUTROS"
];

const APRESENTACOES = [
    "COMPRIMIDO",
    "CÁPSULA",
    "AMPOLA",
    "AMPOLA 0,25 ML",
    "AMPOLA 1 ML",
    "AMPOLA 2 ML",
    "AMPOLA 2,5 ML",
    "AMPOLA 5 ML",
    "AMPOLA 10 ML",
    "AMPOLA 20 ML",
    "FRASCO",
    "FRASCO-AMPOLA",
    "FRASCO 5 ML",
    "FRASCO 10 ML",
    "FRASCO 60 ML",
    "FRASCO 100 ML",
    "FRASCO 250 ML",
    "FRASCO 500 ML",
    "BOLSA",
    "BOLSA 100 ML",
    "BOLSA 250 ML",
    "BOLSA 500 ML",
    "BOLSA 1000 ML",
    "SERINGA",
    "SERINGA PREENCHIDA",
    "SACHÊ",
    "TUBO",
    "POMADA",
    "CREME",
    "GEL",
    "GOTAS",
    "XAROPE",
    "SPRAY",
    "SUPOSITÓRIO",
    "ENVELOPE",
    "ADESIVO",
    "COLÍRIO",
    "BLISTER"
];

// Removed CATEGORIA_MAP

const APRESENTACAO_MAP = {
    "Comprimido": "comprimido",
    "Cápsula": "capsula",
    "Gotas": "gotas",
    "Xarope": "xarope",
    "Injetável": "injetavel",
    "Pomada": "pomada",
    "Creme": "creme",
    "Spray": "spray",
    "Supositório": "supositorio",
    "Envelope": "envelope",
    "Shampoo": "shampoo",
    "Ampola": "ampola",
    "Tubo": "tubo",
    "Frasco": "frasco",
    "Seringa": "seringa",
    "Sachê": "sache"
};

// Inversa para preencher o select
// Removed CATEGORIA_MAP_INV
const APRESENTACAO_MAP_INV = Object.fromEntries(Object.entries(APRESENTACAO_MAP).map(([k, v]) => [v, k]));

export default function MedicamentoForm({ open, onClose, onSave, medicamento, isLoading }) {
    const [form, setForm] = useState({
        nome: "", nome_comercial: "", codigo: "", principio_ativo: "", grupo_terapeutico: "", apresentacao: "",
        concentracao: "", unidade_medida: "", estoque_minimo: 0, localizacao: "", observacoes: "", padronizado: false, is_mav: false,
        origem: "", forma_farmaceutica: "", via_administracao: "", portaria_344: false, antimicrobiano: false, ccih: false,
        is_fracionado: false, medicamento_origem_id: "", fator_fracionamento: 2,
        is_adiantamento: false, nota_fiscal: "", valor_compra: "", fornecedor_nome: ""
    });

    useEffect(() => {
        if (medicamento) {
            setForm({
                nome: medicamento.nome || "",
                nome_comercial: medicamento.nome_comercial || "",
                codigo: medicamento.codigo || "",
                principio_ativo: medicamento.principio_ativo || "",
                categoria: medicamento.categoria || "",
                apresentacao: medicamento.apresentacao || "",
                concentracao: medicamento.concentracao || medicamento.unidade_medida || "",
                unidade_medida: medicamento.unidade_medida || "",
                estoque_minimo: medicamento.estoque_minimo || 0,
                localizacao: medicamento.localizacao || "",
                observacoes: medicamento.observacoes || "",
                padronizado: medicamento.padronizado || false,
                is_mav: medicamento.is_mav !== undefined ? Boolean(medicamento.is_mav) : false,
                origem: medicamento.origem || "",
                grupo_terapeutico: medicamento.grupo_terapeutico || "",
                forma_farmaceutica: medicamento.forma_farmaceutica || "",
                via_administracao: medicamento.via_administracao || "",
                portaria_344: medicamento.portaria_344 || false,
                antimicrobiano: medicamento.antimicrobiano || false,
                ccih: medicamento.ccih || false,
                is_fracionado: Boolean(medicamento.medicamento_origem_id),
                medicamento_origem_id: medicamento.medicamento_origem_id || "",
                fator_fracionamento: medicamento.fator_fracionamento || 2,
                is_adiantamento: Boolean(medicamento.is_adiantamento),
                nota_fiscal: medicamento.nota_fiscal || "",
                valor_compra: medicamento.valor_compra || "",
                fornecedor_nome: medicamento.fornecedor_nome || "",
            });
        } else {
            setForm({ nome: "", nome_comercial: "", codigo: "", principio_ativo: "", grupo_terapeutico: "", apresentacao: "", concentracao: "", unidade_medida: "", estoque_minimo: 0, localizacao: "", observacoes: "", padronizado: false, is_mav: false, origem: "", forma_farmaceutica: "", via_administracao: "", portaria_344: false, antimicrobiano: false, ccih: false, is_fracionado: false, medicamento_origem_id: "", fator_fracionamento: 2, is_adiantamento: false, nota_fiscal: "", valor_compra: "", fornecedor_nome: "" });
        }
    }, [medicamento, open]);

    const { data: dbMedicamentos = [] } = useQuery({
        queryKey: ['medicamentos'],
        queryFn: () => db.entities.Medicamento.list(),
    });

    const uniqueApresentacoes = useMemo(() => {
        const set = new Set();
        APRESENTACOES.forEach(a => {
            const norm = normalizeApresentacao(a);
            if (norm) set.add(norm);
        });
        dbMedicamentos.forEach(m => {
            const norm = normalizeApresentacao(m.apresentacao);
            if (norm) set.add(norm);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
    }, [dbMedicamentos]);

    const uniqueCategorias = useMemo(() => {
        const set = new Set([
            ...CATEGORIAS.map(c => c.toUpperCase()),
            ...dbMedicamentos.map(m => m.grupo_terapeutico?.toUpperCase()).filter(Boolean)
        ]);
        return Array.from(set).sort();
    }, [dbMedicamentos]);

    const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });
    const handleSelectChange = (field) => (value) => setForm({ ...form, [field]: value });

    const [addGrupoOpen, setAddGrupoOpen] = useState(false);
    const [novoGrupo, setNovoGrupo] = useState("");

    const handleAddGrupo = (e) => {
        e.preventDefault();
        if (novoGrupo.trim()) {
            const upper = novoGrupo.trim().toUpperCase();
            setForm({ ...form, grupo_terapeutico: upper });
            setAddGrupoOpen(false);
            setNovoGrupo("");
            toast.success("Grupo selecionado com sucesso!");
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!form.nome) {
            toast.error("O nome do medicamento é obrigatório");
            return;
        }
        if (!form.grupo_terapeutico) {
            toast.error("Selecione uma categoria");
            return;
        }

        // Garante que a apresentação nunca fique vazia nem repetida de forma divergente
        const apresentacaoFinal = normalizeApresentacao(form.apresentacao) || "COMPRIMIDO";

        onSave({
            ...form,
            apresentacao: apresentacaoFinal
        });
    };

    return (
        <>
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{medicamento ? "Editar Medicamento" : "Novo Medicamento"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Nome Genérico</Label>
                            <Input value={form.nome} onChange={handleChange("nome")} required />
                        </div>
                        <div>
                            <Label>Código (ID)</Label>
                            <Input value={form.codigo} onChange={handleChange("codigo")} placeholder="Ex: MED001" />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <Label>Grupo Terapêutico</Label>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    className="h-4 p-0 text-xs text-blue-600 hover:text-blue-700"
                                    onClick={() => setAddGrupoOpen(true)}
                                >
                                    + Adicionar Novo
                                </Button>
                            </div>
                            <Input 
                                list="categorias-list" 
                                value={form.grupo_terapeutico} 
                                onChange={(e) => setForm({ ...form, grupo_terapeutico: e.target.value.toUpperCase() })} 
                                placeholder="Selecione ou digite..." 
                            />
                            <datalist id="categorias-list">
                                {uniqueCategorias.map(cat => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <Label>Apresentação</Label>
                            <Input 
                                list="apresentacoes-list" 
                                value={form.apresentacao} 
                                onChange={(e) => setForm({ ...form, apresentacao: e.target.value.toUpperCase() })} 
                                onBlur={() => {
                                    setForm(f => ({
                                        ...f,
                                        apresentacao: normalizeApresentacao(f.apresentacao) || "COMPRIMIDO"
                                    }));
                                }}
                                placeholder="Ex: COMPRIMIDO, AMPOLA, SACHÊ 5G..." 
                            />
                            <datalist id="apresentacoes-list">
                                {uniqueApresentacoes.map(apr => (
                                    <option key={apr} value={apr} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <Label>CONCENTRAÇÃO</Label>
                            <Input value={form.concentracao} onChange={handleChange("concentracao")} placeholder="Ex: 500mg, 10ml, un" />
                        </div>
                        <div>
                            <Label>Origem</Label>
                            <Input value={form.origem} onChange={handleChange("origem")} placeholder="Ex: Central" />
                        </div>
                        <div>
                            <Label>Forma Farmacêutica</Label>
                            <Input value={form.forma_farmaceutica} onChange={handleChange("forma_farmaceutica")} placeholder="Ex: Sólida" />
                        </div>
                        <div>
                            <Label>Via de Administração</Label>
                            <Input value={form.via_administracao} onChange={(e) => setForm({ ...form, via_administracao: e.target.value.toUpperCase() })} placeholder="Ex: ORAL, IV, IM" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 pb-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="padronizado" 
                                checked={form.padronizado} 
                                onChange={(e) => setForm({ ...form, padronizado: e.target.checked })}
                                className="rounded border-slate-300 w-4 h-4 text-blue-600" 
                            />
                            <Label htmlFor="padronizado" className="cursor-pointer text-sm">Padronizado</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="is_mav" 
                                checked={form.is_mav} 
                                onChange={(e) => setForm({ ...form, is_mav: e.target.checked })}
                                className="rounded border-red-300 w-4 h-4 text-red-600 focus:ring-red-500" 
                            />
                            <Label htmlFor="is_mav" className="cursor-pointer text-sm font-bold text-red-600">
                                MAV (Alto Risco)
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="portaria_344" 
                                checked={form.portaria_344} 
                                onChange={(e) => setForm({ ...form, portaria_344: e.target.checked })}
                                className="rounded border-indigo-300 w-4 h-4 text-indigo-600 focus:ring-indigo-500" 
                            />
                            <Label htmlFor="portaria_344" className="cursor-pointer text-sm font-bold text-indigo-600">
                                Portaria 344
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="antimicrobiano" 
                                checked={form.antimicrobiano} 
                                onChange={(e) => setForm({ ...form, antimicrobiano: e.target.checked })}
                                className="rounded border-emerald-300 w-4 h-4 text-emerald-600 focus:ring-emerald-500" 
                            />
                            <Label htmlFor="antimicrobiano" className="cursor-pointer text-sm font-bold text-emerald-600">
                                Antimicrobiano
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="ccih" 
                                checked={form.ccih} 
                                onChange={(e) => setForm({ ...form, ccih: e.target.checked })}
                                className="rounded border-orange-300 w-4 h-4 text-orange-600 focus:ring-orange-500" 
                            />
                            <Label htmlFor="ccih" className="cursor-pointer text-sm font-bold text-orange-600">
                                CCIH
                            </Label>
                        </div>
                    </div>

                    {/* SEÇÃO DE FRACIONAMENTO */}
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 space-y-3">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="is_fracionado" 
                                checked={form.is_fracionado} 
                                onChange={(e) => setForm({ ...form, is_fracionado: e.target.checked, medicamento_origem_id: e.target.checked ? form.medicamento_origem_id : "", fator_fracionamento: e.target.checked ? (form.fator_fracionamento || 2) : 0 })}
                                className="rounded border-purple-300 w-4 h-4 text-purple-600 focus:ring-purple-500" 
                            />
                            <Label htmlFor="is_fracionado" className="cursor-pointer text-sm font-bold text-purple-700">
                                Este é um medicamento fracionado (Ex: Metadinha)?
                            </Label>
                        </div>
                        
                        {form.is_fracionado && (
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-purple-200">
                                <div>
                                    <Label className="text-purple-700">Medicamento Original (Pai)</Label>
                                    <select 
                                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={form.medicamento_origem_id}
                                        onChange={handleChange("medicamento_origem_id")}
                                        required={form.is_fracionado}
                                    >
                                        <option value="">Selecione o comprimido pai...</option>
                                        {dbMedicamentos.filter(m => !m.medicamento_origem_id).map(med => (
                                            <option key={med.id} value={med.id}>{med.nome} {med.concentracao && `- ${med.concentracao}`}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label className="text-purple-700">Rende quantas partes? (Fator)</Label>
                                    <Input 
                                        type="number" 
                                        min="2" 
                                        value={form.fator_fracionamento} 
                                        onChange={(e) => setForm({ ...form, fator_fracionamento: parseInt(e.target.value) || 2 })}
                                        required={form.is_fracionado}
                                    />
                                    <span className="text-xs text-purple-600 mt-1 block">Ex: 2 (Um comprimido inteiro vira duas metades)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SEÇÃO DE ADIANTAMENTO / CARTÃO DO ESTADO */}
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/40 space-y-3">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="is_adiantamento" 
                                checked={form.is_adiantamento} 
                                onChange={(e) => setForm({ 
                                    ...form, 
                                    is_adiantamento: e.target.checked,
                                    padronizado: e.target.checked ? false : form.padronizado
                                })}
                                className="rounded border-amber-300 w-4 h-4 text-amber-600 focus:ring-amber-500" 
                            />
                            <Label htmlFor="is_adiantamento" className="cursor-pointer text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                                💳 Compra por Adiantamento (Cartão do Estado)
                            </Label>
                        </div>
                        
                        {form.is_adiantamento && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-200 dark:border-amber-900/30">
                                <div>
                                    <Label className="text-amber-900 dark:text-amber-300 text-xs">Nota Fiscal / Cupom</Label>
                                    <Input 
                                        placeholder="Ex: NF-e 4521"
                                        value={form.nota_fiscal} 
                                        onChange={(e) => setForm({ ...form, nota_fiscal: e.target.value })}
                                        className="bg-white"
                                    />
                                </div>
                                <div>
                                    <Label className="text-amber-900 dark:text-amber-300 text-xs">Valor da Compra (R$)</Label>
                                    <Input 
                                        type="number"
                                        step="0.01"
                                        placeholder="0,00"
                                        value={form.valor_compra} 
                                        onChange={(e) => setForm({ ...form, valor_compra: e.target.value })}
                                        className="bg-white"
                                    />
                                </div>
                                <div>
                                    <Label className="text-amber-900 dark:text-amber-300 text-xs">Fornecedor / Farmácia</Label>
                                    <Input 
                                        placeholder="Ex: Drogasil / Distrib."
                                        value={form.fornecedor_nome} 
                                        onChange={(e) => setForm({ ...form, fornecedor_nome: e.target.value })}
                                        className="bg-white"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <Label>Observações</Label>
                        <Input value={form.observacoes} onChange={handleChange("observacoes")} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                            {isLoading ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

        <Dialog open={addGrupoOpen} onOpenChange={setAddGrupoOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Novo Grupo Terapêutico</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddGrupo} className="space-y-4">
                    <div>
                        <Label>Nome do Grupo</Label>
                        <Input 
                            value={novoGrupo} 
                            onChange={(e) => setNovoGrupo(e.target.value)} 
                            placeholder="Digite o nome do novo grupo..."
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setAddGrupoOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Adicionar e Selecionar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
        </>
    );
}
