import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Server, ServerOff, CheckCircle2, XCircle, Settings2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function ServerConnectionBadge() {
  const [status, setStatus] = useState("checking"); // 'checking', 'on', 'off'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const [ip, setIp] = useState(() => {
    const saved = localStorage.getItem("pg_ip");
    return (saved && saved !== "localhost") ? saved : "127.0.0.1";
  });
  const [dbName, setDbName] = useState(localStorage.getItem("pg_db") || "axion");
  const [password, setPassword] = useState(localStorage.getItem("pg_pass") || "");

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const savedIp = localStorage.getItem("pg_ip");
    const savedDb = localStorage.getItem("pg_db");
    const savedPass = localStorage.getItem("pg_pass");

    if (!savedIp || !savedPass) {
      setStatus("off");
      return;
    }

    try {
      await invoke("test_postgres_connection", {
        ip: savedIp,
        dbName: savedDb,
        password: savedPass
      });
      setStatus("on");
    } catch (e) {
      setStatus("off");
    }
  };

  const handleTestAndSave = async () => {
    if (!ip || !dbName || !password) {
      toast.error("Preencha todos os campos do servidor.");
      return;
    }

    setIsTesting(true);
    try {
      const msg = await invoke("test_postgres_connection", {
        ip,
        dbName,
        password
      });
      toast.success(msg);
      
      localStorage.setItem("pg_ip", ip);
      localStorage.setItem("pg_db", dbName);
      localStorage.setItem("pg_pass", password);
      
      setStatus("on");
      setIsModalOpen(false);
    } catch (e) {
      toast.error(e);
      setStatus("off");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 transition-colors ${
          status === "checking" 
            ? "text-slate-600 bg-slate-50 border border-slate-200"
            : status === "on"
            ? "text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100"
            : "text-red-700 bg-red-50 border border-red-200 hover:bg-red-100"
        }`}
      >
        {status === "checking" && <Loader2 className="w-3 h-3 animate-spin" />}
        {status === "on" && <Server className="w-3 h-3" />}
        {status === "off" && <ServerOff className="w-3 h-3" />}
        
        <span>
          {status === "checking" ? "Verificando Servidor..." : status === "on" ? "Servidor ON" : "Servidor OFF"}
        </span>
      </button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-600" />
              Conexão com Servidor Central (PostgreSQL)
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Endereço IP do Servidor</Label>
              <Input 
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="Ex: 127.0.0.1 ou 192.168.0.10"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Nome do Banco de Dados</Label>
              <Input 
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                placeholder="Ex: axion"
              />
            </div>

            <div className="space-y-2">
              <Label>Senha do Postgres</Label>
              <Input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha (admin123)"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleTestAndSave} disabled={isTesting}>
              {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Testar e Salvar Conexão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
