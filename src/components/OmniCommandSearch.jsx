import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Boxes,
  Building2,
  FileText,
  CalendarX2,
  Book,
  Activity,
  Users,
  ShoppingCart,
  ClipboardCheck,
  UserPlus,
  Plus,
  RotateCcw,
  Sparkles,
  Search,
} from "lucide-react";
import { db } from "@/api/db";

export function OmniCommandSearch({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [medicamentos, setMedicamentos] = useState([]);
  const [loadingMeds, setLoadingMeds] = useState(false);

  // Escuta atalho Ctrl+K / Cmd+K globalmente
  useEffect(() => {
    const down = (e) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  // Carrega medicamentos quando o modal é aberto
  useEffect(() => {
    if (open && medicamentos.length === 0) {
      setLoadingMeds(true);
      db.entities.Medicamento.list()
        .then((data) => {
          if (Array.isArray(data)) {
            setMedicamentos(data.slice(0, 50)); // top 50 para performance instantânea
          }
        })
        .catch((err) => console.warn("Erro ao buscar medicamentos no OmniSearch:", err))
        .finally(() => setLoadingMeds(false));
    }
  }, [open, medicamentos.length]);

  const handleSelect = (callback) => {
    onOpenChange(false);
    callback();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
        <CommandInput
          placeholder="Buscar telas, medicamentos, pacientes ou ações rápidas (Ctrl+K)..."
          className="text-sm py-3 px-4 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
        />
        <CommandList className="max-h-[380px] p-2 space-y-1 overflow-y-auto">
          <CommandEmpty className="py-6 text-center text-xs text-slate-400">
            Nenhum resultado encontrado para esta busca.
          </CommandEmpty>

          {/* Módulos & Telas Principais */}
          <CommandGroup heading="Módulos & Telas">
            <CommandItem
              onSelect={() =>
                handleSelect(() => {
                  sessionStorage.setItem("zorion_active_section", "estoque");
                  navigate("/Dashboard");
                })
              }
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center">
                <LayoutDashboard className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Dashboard Geral — Farmácia Central
              </span>
              <CommandShortcut className="text-[10px] text-slate-400 font-mono">Central</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                handleSelect(() => {
                  sessionStorage.setItem("zorion_active_section", "satelite");
                  navigate("/Satelite");
                })
              }
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <Boxes className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Painel da Farmácia Satélite
              </span>
              <CommandShortcut className="text-[10px] text-slate-400 font-mono">Satélite</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                handleSelect(() => {
                  sessionStorage.setItem("zorion_active_section", "carrinho");
                  navigate("/CarrinhoParada");
                })
              }
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Carrinho de Parada (PCR) — Lacres & Emergência
              </span>
              <CommandShortcut className="text-[10px] text-slate-400 font-mono">PCR</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                handleSelect(() => {
                  sessionStorage.setItem("zorion_active_section", "satelite");
                  navigate("/LivroRegistro");
                })
              }
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
                <Book className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Portaria 344/98 — Livro de Registro Especial
              </span>
              <CommandShortcut className="text-[10px] text-slate-400 font-mono">Anvisa</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="my-1.5 bg-slate-100 dark:bg-slate-800" />

          {/* Ações Rápidas Clínicas */}
          <CommandGroup heading="Ações Rápidas">
            <CommandItem
              onSelect={() =>
                handleSelect(() => {
                  sessionStorage.setItem("zorion_active_section", "satelite");
                  navigate("/PacientesMedicao?action=novo_paciente");
                })
              }
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                <UserPlus className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Cadastrar Novo Paciente / Leito
              </span>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                handleSelect(() => {
                  sessionStorage.setItem("zorion_active_section", "satelite");
                  navigate("/PacientesMedicao?action=nova_presc");
                })
              }
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Nova Prescrição Fixa (Aprazamento 24h)
              </span>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                handleSelect(() => {
                  sessionStorage.setItem("zorion_active_section", "estoque");
                  navigate("/Movimentacoes?tab=entradas");
                })
              }
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <Package className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Dar Entrada em Nota Fiscal / Lote
              </span>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                handleSelect(() => {
                  sessionStorage.setItem("zorion_active_section", "estoque");
                  navigate("/Vencimentos");
                })
              }
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                <CalendarX2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Verificar Alertas de Vencimentos Próximos
              </span>
            </CommandItem>
          </CommandGroup>

          {/* Catálogo Rápido de Medicamentos */}
          {medicamentos.length > 0 && (
            <>
              <CommandSeparator className="my-1.5 bg-slate-100 dark:bg-slate-800" />
              <CommandGroup heading="Medicamentos & Estoque">
                {medicamentos.map((med) => (
                  <CommandItem
                    key={med.id || med.nome}
                    onSelect={() =>
                      handleSelect(() => {
                        sessionStorage.setItem("zorion_active_section", "estoque");
                        navigate(`/Medicamentos?search=${encodeURIComponent(med.nome)}`);
                      })
                    }
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {med.nome} {med.dosagem ? `• ${med.dosagem}` : ""}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                      Estoque: {med.estoque_atual || 0} {med.unidade_medida || "un"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </div>
    </CommandDialog>
  );
}
