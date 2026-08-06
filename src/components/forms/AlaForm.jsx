import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AlaForm({ open, onClose, onSave, ala, isLoading }) {
    const [nome, setNome] = useState("");
    const [descricao, setDescricao] = useState("");

    useEffect(() => {
        if (ala) {
            setNome(ala.nome || "");
            setDescricao(ala.descricao || "");
        } else {
            setNome("");
            setDescricao("");
        }
    }, [ala, open]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ nome, descricao });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{ala ? "Editar Ala" : "Nova Ala"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="nome">Nome</Label>
                        <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
                    </div>
                    <div>
                        <Label htmlFor="descricao">Descrição</Label>
                        <Input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
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
