import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Moon, 
  Settings, 
  Leaf, 
  Waves, 
  Sparkles, 
  Box, 
  Flower2, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Save, 
  HardDrive, 
  Download, 
  Upload,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { db } from "@/api/db";

export default function Configuracoes() {
  const queryClient = useQueryClient();

  // Usuário logado
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("pharma_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Campos do Perfil
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setNome(currentUser.nome || "");
      setEmail(currentUser.email || "");
      setTelefone(currentUser.telefone || "");

      // Busca dados mais recentes do PostgreSQL
      if (currentUser.id) {
        db.entities.Usuario.get(currentUser.id)
          .then(u => {
            if (u) {
              setNome(u.nome || "");
              setEmail(u.email || "");
              setTelefone(u.telefone || "");
            }
          })
          .catch(() => {});
      }
    }
  }, [currentUser]);

  // Temas
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem("pharma_theme");
    if (saved) return saved;
    const savedDark = localStorage.getItem("pharma_dark_mode");
    if (savedDark === "true") return "dark";
    return "azul";
  });

  useEffect(() => {
    const isDark = currentTheme === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const themes = ["theme-verde", "theme-azul", "theme-roxo", "theme-ardosia", "theme-rosa"];
    themes.forEach(t => document.documentElement.classList.remove(t));

    if (!isDark && currentTheme !== "azul") {
      document.documentElement.classList.add(`theme-${currentTheme}`);
    }

    localStorage.setItem("pharma_theme", currentTheme);
    localStorage.setItem("pharma_dark_mode", JSON.stringify(isDark));
    window.dispatchEvent(new Event("storage"));
  }, [currentTheme]);

  const themeOptions = [
    { id: "verde", name: "Verde Suave", icon: Leaf, iconColor: "text-green-500", bgPreview: "bg-green-600", lightPreview: "bg-green-50" },
    { id: "azul", name: "Azul Oceano", icon: Waves, iconColor: "text-[#3b82f6]", bgPreview: "bg-[#2563eb]", lightPreview: "bg-[#eff6ff]" },
    { id: "roxo", name: "Roxo Elegante", icon: Sparkles, iconColor: "text-purple-500", bgPreview: "bg-purple-600", lightPreview: "bg-purple-50" },
    { id: "ardosia", name: "Ardósia", icon: Box, iconColor: "text-slate-500", bgPreview: "bg-slate-600", lightPreview: "bg-slate-50" },
    { id: "rosa", name: "Rosa", icon: Flower2, iconColor: "text-pink-500", bgPreview: "bg-pink-600", lightPreview: "bg-pink-50" },
    { id: "dark", name: "Dark Mode", icon: Moon, iconColor: "text-indigo-400", bgPreview: "bg-slate-900", lightPreview: "bg-slate-800" },
  ];

  // Salvar alterações no perfil do usuário
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (novaSenha && novaSenha !== confirmaSenha) {
      toast.error("A nova senha e a confirmação de senha não coincidem.");
      return;
    }

    setSavingProfile(true);
    try {
      const updateData = {
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim()
      };
      if (novaSenha) {
        updateData.senha = novaSenha;
      }

      if (currentUser?.id) {
        await db.entities.Usuario.update(currentUser.id, updateData);
      }

      const updatedUser = {
        ...currentUser,
        ...updateData
      };
      localStorage.setItem("pharma_user", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);

      toast.success("Dados do perfil atualizados com sucesso!");
      setNovaSenha("");
      setConfirmaSenha("");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar alterações no perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── BACKUP: usuário escolhe a pasta ──
  const handleBackup = async () => {
    try {
      const selectedDir = await openDialog({
        directory: true,
        multiple: false,
        title: "Selecionar pasta para salvar o Backup",
      });

      if (selectedDir) {
        toast.loading("Exportando banco de dados...");
        const savedPath = await invoke("backup_database", { destPath: selectedDir });
        toast.dismiss();
        toast.success(`Backup salvo em: ${savedPath}`);
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error(`Erro ao salvar backup: ${error.message || String(error)}`);
    }
  };

  // ── IMPORTAR: restaura .db ──
  const handleImportBackup = async () => {
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        title: "Selecionar arquivo de Backup (.db)",
        filters: [{
          name: 'Backup SQLite',
          extensions: ['db', 'sqlite']
        }]
      });

      if (selected) {
        toast.loading("Restaurando banco de dados...");
        const finalPath = typeof selected === 'string' ? selected : (selected.path || String(selected));
        await invoke("import_backup", { 
          backupPath: finalPath, 
          pushToNuvem: true 
        });

        toast.dismiss();
        toast.success(`Backup restaurado! Recarregando sistema...`);
        await queryClient.invalidateQueries();
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error(`Erro ao restaurar backup: ${error.message || String(error)}`);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 rounded-2xl">
          <Settings className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">
            Configurações do Sistema
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerencie seu perfil de acesso, aparência visual e segurança de dados do Zorion Saúde
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ================================================================= */}
        {/* COLUNA 1 & 2: MEU PERFIL & DADOS DO USUÁRIO */}
        {/* ================================================================= */}
        <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl">
                <User className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Meu Perfil & Credenciais de Acesso
                </CardTitle>
                <CardDescription className="text-xs">
                  Atualize suas informações cadastrais, e-mail de contato e senha de acesso
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nome Completo
                  </Label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome completo"
                      className="pl-9 h-9 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    E-mail Institucional ou Pessoal
                  </Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@hospital.com.br"
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Telefone / Celular
                  </Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Login / Usuário (Identificador)
                  </Label>
                  <Input
                    value={currentUser?.login || "—"}
                    disabled
                    className="h-9 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Cargo / Função
                  </Label>
                  <Input
                    value={currentUser?.cargo || currentUser?.perfil || "Farmácia Satélite"}
                    disabled
                    className="h-9 text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed capitalize"
                  />
                </div>
              </div>

              {/* Alterar Senha */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Lock className="w-4 h-4 text-blue-600" />
                  Alterar Senha de Acesso
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500">Nova Senha</Label>
                    <Input
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Deixe em branco para manter a atual"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500">Confirmar Nova Senha</Label>
                    <Input
                      type="password"
                      value={confirmaSenha}
                      onChange={(e) => setConfirmaSenha(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-5 rounded-xl gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {savingProfile ? "Salvando..." : "Salvar Alterações do Perfil"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ================================================================= */}
        {/* COLUNA 3: TEMAS VISUAIS & BACKUP */}
        {/* ================================================================= */}
        <div className="space-y-6">
          {/* Card de Temas */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-4">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Aparência & Tema
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {themeOptions.map((th) => {
                const Icon = th.icon;
                const isSelected = currentTheme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setCurrentTheme(th.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs font-bold cursor-pointer ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${th.iconColor}`} />
                      <span>{th.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full ${th.bgPreview}`}></div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 ml-1" />}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Card de Backup */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-4">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-600" />
                Segurança & Backup
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gere uma cópia segura dos dados locais ou restaure um backup em caso de manutenção.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackup}
                  className="w-full text-xs font-bold gap-2 h-9 rounded-xl border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  Salvar Backup Local
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImportBackup}
                  className="w-full text-xs font-bold gap-2 h-9 rounded-xl border-slate-200 dark:border-slate-800 cursor-pointer text-slate-600"
                >
                  <Upload className="w-4 h-4 text-sky-600" />
                  Restaurar de Arquivo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
