import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ShieldCheck, MapPin, Phone, Mail, FileText } from "lucide-react";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function FornecedorForm({ open, onClose, onSave, fornecedor, isLoading }) {
  const [form, setForm] = useState({
    nome: "",
    razao_social: "",
    cnpj: "",
    municipio: "",
    uf: "",
    situacao: "ATIVA",
    cnae: "4644-3/01 - Comércio atacadista de medicamentos e drogas de uso humano",
    telefone: "",
    email: "",
    endereco: "",
    contato: "",
  });

  useEffect(() => {
    if (fornecedor) {
      setForm({
        nome: fornecedor.nome || fornecedor.razao_social || "",
        razao_social: fornecedor.razao_social || fornecedor.nome || "",
        cnpj: fornecedor.cnpj || "",
        municipio: fornecedor.municipio || "",
        uf: fornecedor.uf || "",
        situacao: fornecedor.situacao || "ATIVA",
        cnae: fornecedor.cnae || "4644-3/01 - Comércio atacadista de medicamentos e drogas de uso humano",
        telefone: fornecedor.telefone || "",
        email: fornecedor.email || "",
        endereco: fornecedor.endereco || "",
        contato: fornecedor.contato || "",
      });
    } else {
      setForm({
        nome: "",
        razao_social: "",
        cnpj: "",
        municipio: "",
        uf: "",
        situacao: "ATIVA",
        cnae: "4644-3/01 - Comércio atacadista de medicamentos e drogas de uso humano",
        telefone: "",
        email: "",
        endereco: "",
        contato: "",
      });
    }
  }, [fornecedor, open]);

  const handleChange = (field) => (e) => {
    const val = e.target.value;
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      // Se estiver preenchendo Razao Social e Nome Fantasia estiver vazio, copia
      if (field === "razao_social" && !prev.nome) {
        updated.nome = val;
      }
      return updated;
    });
  };

  const handleSelectChange = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalForm = {
      ...form,
      nome: form.nome.trim() || form.razao_social.trim(),
      razao_social: form.razao_social.trim() || form.nome.trim(),
    };
    onSave(finalForm);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Building2 className="w-5 h-5 text-blue-600" />
            {fornecedor ? "Editar Fornecedor" : "Cadastrar Novo Fornecedor"}
          </DialogTitle>
          <DialogDescription>
            {fornecedor 
              ? "Atualize as informações cadastrais e fiscais da distribuidora/fornecedor." 
              : "Preencha os dados da distribuidora ou fornecedor hospitalar para integração ao estoque."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Identificação Principal */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Identificação Empresarial
            </h4>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Razão Social *</Label>
              <Input
                value={form.razao_social}
                onChange={handleChange("razao_social")}
                placeholder="Ex: 085MED DISTRIBUIDORA DE PRODUTOS MEDICOS HOSPITALARES LTDA"
                required
                className="text-sm bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Nome Fantasia / Apelido</Label>
                <Input
                  value={form.nome}
                  onChange={handleChange("nome")}
                  placeholder="Ex: 085Med Hospitalar"
                  className="text-sm bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">CNPJ</Label>
                <Input
                  value={form.cnpj}
                  onChange={handleChange("cnpj")}
                  placeholder="00.000.000/0000-00"
                  className="text-sm bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Situação Cadastral</Label>
                <Select value={form.situacao} onValueChange={(v) => handleSelectChange("situacao", v)}>
                  <SelectTrigger className="bg-white text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVA">ATIVA (Habilitada)</SelectItem>
                    <SelectItem value="SUSPENSA">SUSPENSA</SelectItem>
                    <SelectItem value="INAPTA">INAPTA</SelectItem>
                    <SelectItem value="BAIXADA">BAIXADA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">CNAE Principal</Label>
                <Input
                  value={form.cnae}
                  onChange={handleChange("cnae")}
                  placeholder="4644-3/01 - Comércio atacadista..."
                  className="text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {/* Localização */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              Localização & Endereço
            </h4>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Município / Cidade</Label>
                <Input
                  value={form.municipio}
                  onChange={handleChange("municipio")}
                  placeholder="Ex: Pato Branco"
                  className="text-sm bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">UF (Estado)</Label>
                <Select value={form.uf || "__none__"} onValueChange={(v) => handleSelectChange("uf", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="bg-white text-sm">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent className="max-h-52">
                    <SelectItem value="__none__">Selecione</SelectItem>
                    {UFS.map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Endereço Completo</Label>
              <Input
                value={form.endereco}
                onChange={handleChange("endereco")}
                placeholder="Rua / Av., Número, Bairro, CEP"
                className="text-sm bg-white"
              />
            </div>
          </div>

          {/* Contato & Atendimento */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-600" />
              Canais de Contato
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Telefone / WhatsApp</Label>
                <Input
                  value={form.telefone}
                  onChange={handleChange("telefone")}
                  placeholder="(00) 0000-0000"
                  className="text-sm bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">E-mail Comercial</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={handleChange("email")}
                  placeholder="comercial@distribuidora.com.br"
                  className="text-sm bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Representante / Contato Responsável</Label>
              <Input
                value={form.contato}
                onChange={handleChange("contato")}
                placeholder="Nome do representante de vendas ou consultor"
                className="text-sm bg-white"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20">
              {isLoading ? "Salvando..." : (fornecedor ? "Atualizar Fornecedor" : "Salvar Fornecedor")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
