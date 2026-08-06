import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export default function AuthDialog({ open, onSuccess }) {
    const [usuario, setUsuario] = useState("");
    const [senha, setSenha] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);

        if (usuario === "clemente" && senha === "lins2026") {
            const timestamp = new Date().getTime();
            localStorage.setItem("pharma_auth_time", timestamp.toString());
            localStorage.setItem("pharma_auth_user", "clemente");
            toast.success("Autenticação realizada com sucesso!");
            setUsuario("");
            setSenha("");
            onSuccess();
        } else {
            toast.error("Usuário ou senha incorretos!");
        }

        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-md" hideClose>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-blue-600" />
                        Autenticação Necessária
                    </DialogTitle>
                    <DialogDescription>
                        Por segurança, confirme suas credenciais para continuar.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="usuario">Usuário</Label>
                        <Input
                            id="usuario"
                            type="text"
                            placeholder="Digite seu usuário"
                            value={usuario}
                            onChange={(e) => setUsuario(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="senha">Senha</Label>
                        <Input
                            id="senha"
                            type="password"
                            placeholder="Digite sua senha"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            required
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        disabled={loading}
                    >
                        {loading ? "Verificando..." : "Autenticar"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}