import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Moon, Sun, Trash2, Save, Upload, HardDrive, Settings, Leaf, Waves, Sparkles, Box, Flower2, CheckCircle2 } from "lucide-react";

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

    const handleResetSystem = async () => {
        try {
            toast.loading("Limpando banco de dados e dados locais...");
            
            // 1. Limpa o backend SQLite
            await invoke("clear_all_data");
            
            // 2. Limpa o localStorage (cache local do frontend)
            const PREFIX = "farmacia_";
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith(PREFIX)) {
                    localStorage.removeItem(key);
                }
            }
            
            await queryClient.invalidateQueries();
            toast.dismiss();
            toast.success("Banco de dados limpo com sucesso!");
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (error) {
            toast.dismiss();
            console.error(error);
            toast.error("Erro ao limpar banco de dados");
        }
    };

    const handleDataCleanup = async () => {
        try {
            toast.loading("Limpando dados antigos (6 meses)...");
            const count = await invoke("bulk_cleanup", { monthsOld: 6 });
            await queryClient.invalidateQueries();
            toast.dismiss();
            toast.success(`Limpeza concluída! ${count} registros apagados.`);
        } catch (error) {
            toast.dismiss();
            console.error(error);
            toast.error("Erro ao realizar limpeza de dados");
        }
    };

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
                // Removemos o prompt que perguntava. Agora sempre envia (push = true) tudo pro Supabase
                const isPush = true;

                toast.loading("Restaurando e enviando banco para o Supabase...");
                
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
                            _synced: false, // Marca como pendente para sincronizar com Supabase
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


                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HardDrive className="w-5 h-5 text-blue-500" />
                            Backup e Restauração
                        </CardTitle>
                        <CardDescription>
                            Salve seus dados (.db) ou restaure um backup anterior
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
                            <div>
                                <p className="font-medium text-slate-800 dark:text-slate-200">Fazer Backup</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Exporta uma cópia do banco de dados SQLite (.db).</p>
                            </div>
                            <Button variant="outline" onClick={handleBackup} className="gap-2">
                                <Save className="w-4 h-4" /> Exportar .db
                            </Button>
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
                            <div>
                                <p className="font-medium text-slate-800 dark:text-slate-200">Restaurar Backup</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Substitui o banco atual por um arquivo .db anterior.</p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="gap-2">
                                        <Upload className="w-4 h-4" /> Importar .db
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Restaurar Backup?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Atenção: Todos os dados atuais serão substituídos pelos dados do arquivo .db selecionado.
                                            Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleImportBackup} className="bg-blue-600 hover:bg-blue-700 text-white border-0">
                                            Confirmar Restauração
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2 border-red-200 dark:border-red-900">
                    <CardHeader className="bg-red-50 dark:bg-red-950/20 rounded-t-lg">
                        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                            <Trash2 className="w-5 h-5" />
                            Gerenciamento de Dados
                        </CardTitle>
                        <CardDescription className="text-red-600 dark:text-red-300">
                            Área de perigo. Ações aqui não podem ser desfeitas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 border border-red-100 dark:border-red-900 rounded-lg bg-white dark:bg-slate-800/50">
                            <div>
                                <p className="font-medium text-slate-800 dark:text-slate-200">Limpar Dados Antigos (+6 meses)</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Apaga registros de mais de 6 meses que estejam com estoque zerado no momento.
                                </p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 w-full sm:w-auto">
                                        Iniciar Limpeza Segura
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Limpar dados antigos?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação irá apagar definitivamente lotes e medicamentos com mais de 6 meses
                                            cujo estoque atual seja 0. Tem certeza?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDataCleanup} className="bg-amber-600 hover:bg-amber-700 text-white border-0">
                                            Confirmar Limpeza
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 border border-red-100 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-900/10">
                            <div>
                                <p className="font-bold text-red-700 dark:text-red-400">Limpar TODO o Banco de Dados</p>
                                <p className="text-sm text-red-600 dark:text-red-300">
                                    Isso irá apagar permanentemente todos os medicamentos, lotes, entradas e saídas.
                                </p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full sm:w-auto gap-2">
                                        <Trash2 className="w-4 h-4" />
                                        Limpar Banco de Dados
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação irá apagar <span className="font-bold underline">permanentemente todos os dados</span> de medicamentos, lotes, entradas, saídas e movimentações.
                                            Isso é recomendado apenas para limpar o sistema de testes antes de usar na produção.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleResetSystem} className="bg-red-600 hover:bg-red-700 text-white border-0">
                                            Confirmar Destruição de Dados
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
