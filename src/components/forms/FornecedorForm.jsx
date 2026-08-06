import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function FornecedorForm({ open, onClose, onSave, fornecedor, isLoading }) {
    const [form, setForm] = useState({
        nome: "", cnpj: "", telefone: "", email: "", endereco: "", contato: "",
    });

    useEffect(() => {
        if (fornecedor) {
            setForm({
                nome: fornecedor.nome || "",
                cnpj: fornecedor.cnpj || "",
                telefone: fornecedor.telefone || "",
                email: fornecedor.email || "",
                endereco: fornecedor.endereco || "",
                contato: fornecedor.contato || "",
            });
        } else {
            setForm({ nome: "", cnpj: "", telefone: "", email: "", endereco: "", contato: "" });
        }
    }, [fornecedor, open]);

    const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{fornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Nome</Label>
                            <Input value={form.nome} onChange={handleChange("nome")} required />
                        </div>
                        <div>
                            <Label>CNPJ</Label>
                            <Input value={form.cnpj} onChange={handleChange("cnpj")} />
                        </div>
                        <div>
                            <Label>Telefone</Label>
                            <Input value={form.telefone} onChange={handleChange("telefone")} />
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input type="email" value={form.email} onChange={handleChange("email")} />
                        </div>
                    </div>
                    <div>
                        <Label>Endereço</Label>
                        <Input value={form.endereco} onChange={handleChange("endereco")} />
                    </div>
                    <div>
                        <Label>Contato</Label>
                        <Input value={form.contato} onChange={handleChange("contato")} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" disabled={isLoading}>{isLoading ? "Salvando..." : "Salvar"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
