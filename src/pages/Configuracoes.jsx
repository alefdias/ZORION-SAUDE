import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Moon, Settings, Leaf, Waves, Sparkles, Box, Flower2 } from "lucide-react";

export default function Configuracoes() {
    const queryClient = useQueryClient();
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



    // ── BACKUP: usuário escolhe a pasta, nome gerado automaticamente pelo Rust ──
    const handleBackup = async () => {
        try {
            const selectedDir = await openDialog({
                directory: true,
                multiple: false,
                title: "Selecionar pasta para salvar o Backup",
            });

            if (selectedDir) {
                toast.loading("Exportando banco de dados SQLite...");
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

    // ── IMPORTAR: restaura .db via Rust e depois popula o localStorage ──
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
                // Removemos o prompt que perguntava. Agora sempre envia (push = true) tudo pra Nuvem
                const isPush = true;

                toast.loading("Restaurando e enviando banco para a Nuvem...");
                
                // 1. Substitui o pharmacy.db pelo arquivo selecionado
                const finalPath = typeof selected === 'string' ? selected : (selected.path || String(selected));
                await invoke("import_backup", { 
                    backupPath: finalPath, 
                    pushToNuvem: isPush === true 
                });

                // 2. Exporta todos os dados do SQLite restaurado para JSON
                toast.loading("Carregando dados para o sistema...");
                const jsonString = await invoke("export_all_data_as_json");
                const allData = JSON.parse(jsonString);

                // --- Tira o Snapshot ANTES de apagar o LocalStorage ---
                // Isso permite que o botão 'Desfazer Sincronização' reverta a importação!
                const currentSnapshot = localStorage.getItem("farmacia_last_sync_snapshot"); // we don't really have exportDatabaseToJson in scope here, we can just save it or ignore for now, wait, let's just use JSON stringify over all farmacia_ keys
                
                const snap = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith("farmacia_") && !k.includes("last_sync")) {
                        snap[k.replace("farmacia_", "")] = JSON.parse(localStorage.getItem(k));
                    }
                }
                localStorage.setItem("farmacia_last_sync_snapshot", JSON.stringify(snap));
                localStorage.setItem("farmacia_last_sync_time", new Date().toISOString());

                // 3. Limpa o localStorage atual (apenas chaves da farmácia)
                const PREFIX = "farmacia_";
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    // Não exclua o snapshot de segurança que acabamos de salvar!
                    if (key && key.startsWith(PREFIX) && !key.includes("last_sync")) {
                        localStorage.removeItem(key);
                    }
                }

                // 4. Popula o localStorage com os dados do backup
                for (const [entityName, entityMap] of Object.entries(allData)) {
                    if (entityName === "Config") continue; // pula Config
                    const localMap = {};
                    for (const [id, item] of Object.entries(entityMap)) {
                        localMap[id] = {
                            ...item,
                            id,
                            createdAt: item.created_at || item.createdAt || new Date().toISOString(),
                            updatedAt: item.updated_at || item.updatedAt || new Date().toISOString(),
                            _synced: false, // Marca como pendente para sincronizar com a Nuvem
                        };
                    }
                    localStorage.setItem(`${PREFIX}${entityName}`, JSON.stringify(localMap));
                }

                toast.dismiss();
                toast.success(`Backup restaurado! Recarregando...`);
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
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <Settings className="w-8 h-8 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Configurações</h1>
                    <p className="text-slate-500 dark:text-slate-400">Gerencie a aparência e os dados do sistema</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">





            </div>
        </div>
    );
}
