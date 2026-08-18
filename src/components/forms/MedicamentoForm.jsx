import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/api/db";

const CATEGORIAS = [
    "CLÍNICOS - ANALGÉSICO, ANTITERMICO",
    "CLÍNICOS - ANESTÉSICO",
    "CLÍNICOS - ANTIAGREGANTE PLAQUETÁRIO E VASODILATADOR",
    "CLÍNICOS - ANTIANEMICO",
    "CLÍNICOS - ANTIARRÍTMICO",
    "CLÍNICOS - ANTIBIÓTICO / ANTIBACTERIANO",
    "CLÍNICOS - ANTIBIÓTICO OCULAR",
    "CLÍNICOS - ANTIBIÓTICO OTOLÓGICO",
    "CLÍNICOS - ANTIBIÓTICO TÓPICO",
    "CLÍNICOS - ANTICOAGULANTE",
    "CLÍNICOS - ANTICONCEPCIONAL",
    "CLÍNICOS - ANTIDIARREICO",
    "CLÍNICOS - ANTIEMÉTICO",
    "CLÍNICOS - ANTIESPASMÓDICO",
    "CLÍNICOS - ANTIFLATULENCIA GASTROINTESTINAL",
    "CLÍNICOS - ANTIFÚNGICO",
    "CLÍNICOS - ANTIFÚNGICO TÓPICO",
    "CLÍNICOS - ANTIGLAUCOMATOSO",
    "CLÍNICOS - ANTIHIPERTENSIVO",
    "CLÍNICOS - ANTIHIPERTENSIVO ESSENCIAL",
    "CLÍNICOS - ANTIHIPERTENSIVO, ANTIARRÍTMICO",
    "CLÍNICOS - ANTIHIPERTENSIVO, VASODILATADOR",
    "CLÍNICOS - ANTIHISTAMINICO",
    "CLÍNICOS - ANTIINFLAMATÓRIO ESTEROIDE",
    "CLÍNICOS - ANTIINFLAMATÓRIO NÃO ESTERÓIDE",
    "CLÍNICOS - ANTIINFLAMATÓRIO, ANTIULCERATIVO ORAL",
    "CLÍNICOS - ANTIINFLAMÁTORIO",
    "CLÍNICOS - ANTINEOPLASICO/ANTIPROSTATICO",
    "CLÍNICOS - ANTINEURÍTICO",
    "CLÍNICOS - ANTIPARASITARIO",
    "CLÍNICOS - ANTIREFLUXO, GASTROCINÉTICO",
    "CLÍNICOS - ANTIULCEROSO",
    "CLÍNICOS - ANTIVARICOSO, ANTI-HEMORROIDÁRIO",
    "CLÍNICOS - ANTIVIRAL",
    "CLÍNICOS - ANTIÁCIDO",
    "CLÍNICOS - BETA BLOQUEADOR",
    "CLÍNICOS - BRONCODILATADOR",
    "CLÍNICOS - CARDIOTÔNICO",
    "CLÍNICOS - CICATRIZANTE TÓPICO",
    "CLÍNICOS - CORTICOSTERÓIDE TÓPICO + ASSOCIAÇÕES",
    "CLÍNICOS - CORTICÓIDE",
    "CLÍNICOS - DISLEPIDEMIA",
    "CLÍNICOS - DIURÉTICO",
    "CLÍNICOS - EMOLIENTE E PROTETOR OFTÁLMICO",
    "CLÍNICOS - ESCABICIDA, PEDICULICIDA",
    "CLÍNICOS - GLICOCORTICÓIDE",
    "CLÍNICOS - HEMOSTÁTICO",
    "CLÍNICOS - HIPERPLASIA PROSTÁTICA BENIGNA",
    "CLÍNICOS - HIPERTENSOR",
    "CLÍNICOS - HIPERTROFIA PROSTÁTICA",
    "CLÍNICOS - HIPOGLICEMIANTE",
    "CLÍNICOS - HIPOLIPEMIANTES",
    "CLÍNICOS - HORMONIO TIREOIDIANO/ANTITIREOIDIANO",
    "CLÍNICOS - INCONTINÊNCIA URINÁRIA",
    "CLÍNICOS - LAXANTE / LAVAGEM INTESTINAL",
    "CLÍNICOS - MIDRIÁTICO, CICLOPLÉGICO, ANTIESPASMÓDICO",
    "CLÍNICOS - MUCOLÍTICO",
    "CLÍNICOS - OSTEORTRITE/OSTEOARTROSE",
    "CLÍNICOS - REEDUCADOR INTESTINAL",
    "CLÍNICOS - REHIDRATANTE",
    "CLÍNICOS - RELAXANTE",
    "CLÍNICOS - REPOSITOR ELETROLÍTICO",
    "CLÍNICOS - SIMPATOMIMETICO",
    "CLÍNICOS - SOLUÇÕES",
    "CLÍNICOS - VASODILATADOR CEREBRAL E PERIFÉRICO",
    "CLÍNICOS - VASODILATADOR SISTÊMICO",
    "CLÍNICOS - VITAMINAS E SAIS MINERAIS",
    "PSICOTRÓPICOS - ALZHEIMER",
    "PSICOTRÓPICOS - ANALGÉSICO DE AÇÃO CENTRAL",
    "PSICOTRÓPICOS - ANSIOLITICO, SEDATIVO",
    "PSICOTRÓPICOS - ANTAGONISTA DE BENZODIAZEPÍNICOS",
    "PSICOTRÓPICOS - ANTICONVULSIVANTE",
    "PSICOTRÓPICOS - ANTIDEPRESSIVO",
    "PSICOTRÓPICOS - ANTIEPILÉTICO",
    "PSICOTRÓPICOS - ANTIPARKINSONIANO",
    "PSICOTRÓPICOS - ANTIPSICÓTICO",
    "PSICOTRÓPICOS - HIPNÓTICO",
    "PSICOTRÓPICOS - NEUROLÉPTICO",
];

const APRESENTACOES = [
    "Comprimido",
    "Cápsula",
    "Gotas",
    "Xarope",
    "Injetável",
    "Pomada",
    "Creme",
    "Spray",
    "Supositório",
    "Envelope",
    "Shampoo",
    "Ampola",
    "Tubo",
    "Frasco",
    "Seringa",
    "Sachê"
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
        origem: "", grupo_terapeutico: "", forma_farmaceutica: "", via_administracao: "", portaria_344: false, antimicrobiano: false, ccih: false
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
                is_mav: medicamento.is_mav !== undefined ? Boolean(medicamento.is_mav) : isMav(medicamento.nome || ""),
                origem: medicamento.origem || "",
                grupo_terapeutico: medicamento.grupo_terapeutico || "",
                forma_farmaceutica: medicamento.forma_farmaceutica || "",
                via_administracao: medicamento.via_administracao || "",
                portaria_344: medicamento.portaria_344 || false,
                antimicrobiano: medicamento.antimicrobiano || false,
                ccih: medicamento.ccih || false,
            });
        } else {
            setForm({ nome: "", nome_comercial: "", codigo: "", principio_ativo: "", grupo_terapeutico: "", apresentacao: "", concentracao: "", unidade_medida: "", estoque_minimo: 0, localizacao: "", observacoes: "", padronizado: false, is_mav: false, origem: "", grupo_terapeutico: "", forma_farmaceutica: "", via_administracao: "", portaria_344: false, antimicrobiano: false, ccih: false });
        }
    }, [medicamento, open]);

    const { data: dbMedicamentos = [] } = useQuery({
        queryKey: ['medicamentos'],
        queryFn: () => db.entities.Medicamento.list(),
    });

    const uniqueApresentacoes = Array.from(
        new Set([
            ...APRESENTACOES.map(a => a.toUpperCase()),
            ...dbMedicamentos.map(m => m.apresentacao?.toUpperCase()).filter(Boolean)
        ])
    ).sort();

    const uniqueCategorias = Array.from(
        new Set([
            ...CATEGORIAS.map(c => c.toUpperCase()),
            ...dbMedicamentos.map(m => m.grupo_terapeutico?.toUpperCase()).filter(Boolean)
        ])
    ).sort();

    const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });
    const handleSelectChange = (field) => (value) => setForm({ ...form, [field]: value });

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
        if (!form.apresentacao) {
            toast.error("Selecione a apresentação");
            return;
        }

        onSave(form);
    };

    return (
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
                            <Label>Grupo Terapêutico</Label>
                            <Input 
                                list="categorias-list" 
                                value={form.grupo_terapeutico} 
                                onChange={(e) => setForm({ ...form, categoria: e.target.value.toUpperCase() })} 
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
    );
}
