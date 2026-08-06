import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
        nome: "", nome_comercial: "", codigo: "", principio_ativo: "", categoria: "", apresentacao: "",
        unidade_medida: "", estoque_minimo: 0, localizacao: "", observacoes: "", padronizado: false, is_mav: false
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
                unidade_medida: medicamento.unidade_medida || "",
                estoque_minimo: medicamento.estoque_minimo || 0,
                localizacao: medicamento.localizacao || "",
                observacoes: medicamento.observacoes || "",
                padronizado: medicamento.padronizado || false,
                is_mav: medicamento.is_mav !== undefined ? Boolean(medicamento.is_mav) : isMav(medicamento.nome || ""),
            });
        } else {
            setForm({ nome: "", nome_comercial: "", codigo: "", principio_ativo: "", categoria: "", apresentacao: "", unidade_medida: "", estoque_minimo: 0, localizacao: "", observacoes: "", padronizado: false, is_mav: false });
        }
    }, [medicamento, open]);

    const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });
    const handleSelectChange = (field) => (value) => setForm({ ...form, [field]: value });

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!form.nome) {
            toast.error("O nome do medicamento é obrigatório");
            return;
        }
        if (!form.categoria) {
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
            <DialogContent className="max-w-lg">
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
                            <Label>Nome Comercial</Label>
                            <Input value={form.nome_comercial} onChange={handleChange("nome_comercial")} placeholder="Opcional" />
                        </div>
                        <div>
                            <Label>Código (ID)</Label>
                            <Input value={form.codigo} onChange={handleChange("codigo")} placeholder="Ex: MED001" />
                        </div>

                        <div>
                            <Label>Categoria</Label>
                            <Select
                                value={form.categoria}
                                onValueChange={(val) => handleSelectChange("categoria")(val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIAS.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Apresentação</Label>
                            <Select
                                value={APRESENTACAO_MAP_INV[form.apresentacao] || form.apresentacao}
                                onValueChange={(val) => handleSelectChange("apresentacao")(APRESENTACAO_MAP[val] || val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {APRESENTACOES.map(apr => (
                                        <SelectItem key={apr} value={apr}>{apr}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>DOSAGEM</Label>
                            <Input value={form.unidade_medida} onChange={handleChange("unidade_medida")} placeholder="Ex: mg, ml, un" />
                        </div>
                    </div>
                    <div className="flex items-center gap-6 pt-2 pb-2">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="padronizado" 
                                checked={form.padronizado} 
                                onChange={(e) => setForm({ ...form, padronizado: e.target.checked })}
                                className="rounded border-slate-300 w-4 h-4 text-blue-600" 
                            />
                            <Label htmlFor="padronizado" className="cursor-pointer">Medicamento Padronizado</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="is_mav" 
                                checked={form.is_mav} 
                                onChange={(e) => setForm({ ...form, is_mav: e.target.checked })}
                                className="rounded border-red-300 w-4 h-4 text-red-600 focus:ring-red-500" 
                            />
                            <Label htmlFor="is_mav" className="cursor-pointer font-bold text-red-600 dark:text-red-400">
                                MAV (Alta Vigilância)
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
