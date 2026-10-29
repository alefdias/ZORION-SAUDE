import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "./utils";
import { ServerConnectionBadge } from "@/components/ServerConnectionBadge";
import { NotificationBell } from "@/components/NotificationBell";
import { useWelcome } from "@/lib/AppInitializer";
import { TransferenciaAcceptModal } from "@/components/TransferenciaAcceptModal";
import { ZorionChatWidget } from "@/components/chat/ZorionChatWidget";

import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Boxes,
  Building2,
  FileText,
  HandHelping,
  Menu,
  X,
  LogOut,
  User,
  Settings,
  CalendarX2,
  Book,
  Activity,
  Users,
  ChevronDown,
  TrendingUp,
  Palette,
  Clock,
  CreditCard,
  ShoppingCart,
  ShieldCheck,
  ClipboardList,
  ClipboardCheck,
  Calendar,
  PackagePlus,
  RotateCcw,
  PackageMinus,
  UserPlus,
  Plus,
  Printer,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Toaster } from "sonner";

const THEMES_LIST = [
  { id: "theme-ocean", name: "Oceano", color: "#0284c7" },
  { id: "theme-emerald", name: "Esmeralda", color: "#059669" },
  { id: "theme-sunset", name: "Pôr do Sol", color: "#ea580c" },
  { id: "theme-amethyst", name: "Ametista", color: "#9333ea" },
  { id: "theme-rose", name: "Rosa Elegance", color: "#e11d48" },
  { id: "theme-midnight", name: "Meia-noite", color: "#475569" },
];

const moduleSections = [
  {
    id: "estoque",
    name: "Farmácia Central",
    icon: Boxes,
    mainPage: "Dashboard",
    menu: [
      { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
      { name: "Medicamentos", icon: Package, page: "Medicamentos" },
      { 
        name: "Movimentações", 
        icon: ArrowLeftRight, 
        page: "Movimentacoes",
        subItems: [
          {
            name: "Entradas",
            desc: "Entrada de notas fiscais e lotes",
            tab: "entradas",
            icon: PackagePlus,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
          },
          {
            name: "Pedidos Satélite",
            desc: "Separação e atendimento aos pedidos",
            tab: "pedidos_satelite",
            icon: ShoppingCart,
            color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
          },
          {
            name: "Transferência",
            desc: "Transferência física entre estoques",
            tab: "transferencia",
            icon: ArrowLeftRight,
            color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40"
          }
        ]
      },
      { name: "Estoque", icon: Boxes, page: "Estoque" },
      { name: "Balanço", icon: ClipboardCheck, page: "Inventario" },
      { name: "Vencimentos", icon: CalendarX2, page: "Vencimentos" },
      { name: "Compras", icon: ShoppingCart, page: "Compras" },
      { name: "Relatórios", icon: FileText, page: "Relatorios" },
    ]
  },
  {
    id: "satelite",
    name: "Farmácia Satélite",
    icon: Package,
    mainPage: "Satelite",
    menu: [
      { name: "Painel", icon: LayoutDashboard, page: "Satelite" },
      { name: "Sazonalidade", icon: TrendingUp, page: "SateliteEvolucao" },
      { 
        name: "Pacientes", 
        icon: Users, 
        page: "PacientesMedicao",
        subItems: [
          {
            name: "Lista de Pacientes",
            desc: "Prescrições ativas e dispensação por leito",
            action: "lista",
            icon: Users,
            color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40"
          },
          {
            name: "Novo Paciente",
            desc: "Cadastrar paciente internado e leito",
            action: "novo_paciente",
            icon: UserPlus,
            color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
          },
          {
            name: "Nova Prescrição Fixa",
            desc: "Prescrever aprazamento contínuo de 24h",
            action: "nova_presc",
            icon: Plus,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
          },
          {
            name: "Transferir de Ala",
            desc: "Transferência física entre enfermarias/alas",
            action: "transferir_ala",
            icon: ArrowLeftRight,
            color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40"
          },
          {
            name: "Imprimir Prescrições",
            desc: "Checklist de aprazamento e dispensação",
            action: "imprimir_presc",
            icon: Printer,
            badge: "A4",
            color: "text-sky-600 bg-sky-50 dark:bg-sky-950/40"
          },
          {
            name: "Troca por Validade (344)",
            desc: "Substituição e descarte com Portaria 344",
            action: "troca_lote",
            icon: RefreshCw,
            color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40"
          },
          {
            name: "Cancelar / Estornar Baixa",
            desc: "Reverter baixas de medicação recentes",
            action: "estornar_baixa",
            icon: RotateCcw,
            color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40"
          }
        ]
      },
      { name: "Adiantamento", icon: CreditCard, page: "SateliteAdiantamento" },
      { 
        name: "Movimentações", 
        icon: ArrowLeftRight, 
        page: "SateliteMovimentacoes",
        subItems: [
          {
            name: "Pedidos à Central",
            desc: "Solicitação avulsa / urgente à Farmácia Central",
            tab: "pedidos_urgencia",
            icon: PackagePlus,
            badge: "Manual",
            color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40"
          },
          {
            name: "Devoluções",
            desc: "Devolução de medicamentos e materiais",
            tab: "devolucoes",
            icon: RotateCcw,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
          },
          {
            name: "Saídas",
            desc: "Dispensação e saídas gerais de estoque",
            tab: "saidas",
            icon: PackageMinus,
            color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40"
          },
          {
            name: "Passagem de Plantão",
            desc: "Registro e conferência de troca de turno",
            tab: "passagem_plantao",
            icon: ClipboardList,
            color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40"
          },
          {
            name: "Mapa Mensal de Dispensação",
            desc: "Relatório impresso A4 por leito/paciente",
            tab: "mapa_mensal",
            icon: Calendar,
            badge: "A4",
            color: "text-sky-600 bg-sky-50 dark:bg-sky-950/40"
          }
        ]
      },
      { name: "Portaria 344", icon: Book, page: "LivroRegistro" },
      { name: "Estoque", icon: Package, page: "SateliteEstoque" },
      { name: "Balanço", icon: ClipboardCheck, page: "SateliteInventario" },
      { name: "Mapa de Dispensação", icon: Calendar, page: "MapaDispensacao" },
    ]
  },
  {
    id: "rt",
    name: "Responsável Técnico (RT)",
    icon: Building2,
    mainPage: "ResponsavelTecnico",
    menu: [
      { name: "Gestão RT", icon: Users, page: "ResponsavelTecnico" },
      { name: "Portaria 344", icon: Book, page: "LivroRegistro" },
      { name: "Cadastros", icon: Building2, page: "Cadastros" },
      { name: "Empréstimos", icon: HandHelping, page: "Emprestimos" },
      { name: "Configurações", icon: Settings, page: "Configuracoes" },
    ]
  },
  {
    id: "carrinho",
    name: "Carrinho de Parada",
    icon: Activity,
    mainPage: "CarrinhoParada",
    menu: [
      { name: "Carrinho de Parada", icon: Activity, page: "CarrinhoParada" },
    ]
  }
];

function getCurrentSection(pageName) {
  let savedSectionId = null;
  try {
    savedSectionId = sessionStorage.getItem("zorion_active_section");
  } catch (e) {
    // ignore
  }

  // Se a seção ativa previamente salva já contiver esta página em seu menu, mantém a mesma seção!
  // Isso impede que o módulo Responsável Técnico (RT) pule para a Farmácia Satélite ao clicar em "Portaria 344".
  if (savedSectionId) {
    const matchedSaved = moduleSections.find(sec => sec.id === savedSectionId);
    if (matchedSaved && matchedSaved.menu.some(m => m.page === pageName)) {
      return matchedSaved;
    }
  }

  // Páginas exclusivas do RT
  if (pageName === "ResponsavelTecnico" || pageName === "Cadastros" || pageName === "Emprestimos" || pageName === "Configuracoes") {
    try { sessionStorage.setItem("zorion_active_section", "rt"); } catch (e) {}
    return moduleSections.find(sec => sec.id === "rt");
  }

  // Páginas exclusivas da Farmácia Satélite
  if (pageName === "Satelite" || pageName === "SateliteEvolucao" || pageName === "PacientesMedicao" || pageName === "SateliteAdiantamento" || pageName === "SateliteMovimentacoes" || pageName === "PassagemPlantao" || pageName === "SateliteEstoque" || pageName === "SatelitePortaria" || pageName === "SateliteInventario" || pageName === "MapaDispensacao") {
    try { sessionStorage.setItem("zorion_active_section", "satelite"); } catch (e) {}
    return moduleSections.find(sec => sec.id === "satelite");
  }

  // Se for LivroRegistro sem histórico prévio, verifica se há preferência salva ou fallback para satélite
  if (pageName === "LivroRegistro") {
    if (savedSectionId === "rt") {
      return moduleSections.find(sec => sec.id === "rt");
    }
    const sat = moduleSections.find(sec => sec.id === "satelite");
    return sat || moduleSections[0];
  }

  // Busca geral nas seções configuradas
  for (const sec of moduleSections) {
    if (sec.menu.some(m => m.page === pageName)) {
      try { sessionStorage.setItem("zorion_active_section", sec.id); } catch (e) {}
      return sec;
    }
  }

  return moduleSections[0]; // fallback: estoque
}

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short'
  }).replace('.', '');

  const timeStr = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed bottom-3 left-4 z-50 flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/90 text-slate-200 border border-slate-700/80 rounded-full shadow-xl backdrop-blur-md text-xs font-mono select-none hover:bg-slate-900 transition-all pointer-events-none print:hidden no-print">
      <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
      <span className="capitalize text-slate-300 font-medium">{dateStr}</span>
      <span className="font-bold text-cyan-300 tracking-wide">{timeStr}</span>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentTab = new URLSearchParams(location.search).get("tab");
  const currentAction = new URLSearchParams(location.search).get("action");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try {
      const stored = sessionStorage.getItem("axion_active_user") || localStorage.getItem("pharma_user");
      if (stored) {
        const u = JSON.parse(stored);
        let uMods = u.modules || u.modulos || [];
        if (typeof uMods === 'string') {
          try { uMods = JSON.parse(uMods); } catch { uMods = uMods.split(','); }
        }
        setUser({
          ...u,
          id: u.id || u.login || u.username || "admin",
          login: u.login || u.username || "admin",
          full_name: u.nome || u.username || u.login || "Administrador",
          cargo: u.cargo || u.perfil || "Administrador",
          modules: Array.isArray(uMods) ? uMods : []
        });
        return;
      }
    } catch (e) {
      console.warn("Erro ao ler usuário no Layout:", e);
    }
    setUser({ full_name: "Administrador", cargo: "Administrador", modules: [] });
  }, []);

  const [themeColor, setThemeColorState] = useState(() => {
    return localStorage.getItem("zorion_theme") || "theme-ocean";
  });

  const setThemeColor = (newTheme) => {
    document.documentElement.classList.remove(themeColor);
    document.documentElement.classList.add(newTheme);
    localStorage.setItem("zorion_theme", newTheme);
    setThemeColorState(newTheme);
  };

  useEffect(() => {
    document.documentElement.classList.add(themeColor);
  }, []);

  const { showWelcome } = useWelcome();

  const handleLogout = () => {
    showWelcome();
  };

  const isAuxiliar = (user?.cargo || user?.perfil || "").toLowerCase().includes("auxiliar");
  const isMedico = (user?.cargo || user?.perfil || "").toLowerCase() === "medico";

  const rawSection = getCurrentSection(currentPageName);
  const activeSection = rawSection;

  const userModules = useMemo(() => {
    let mods = user?.modules || user?.modulos || [];
    if (typeof mods === 'string') {
      try { mods = JSON.parse(mods); } catch { mods = mods.split(','); }
    }
    return Array.isArray(mods) ? mods : [];
  }, [user]);

  const hasCentral = userModules.includes("estoque_farmacia") || (userModules.length === 0 && isAuxiliar);
  const hasSatelite = userModules.includes("farmacia_satelite") || (userModules.length === 0 && isAuxiliar);

  const centralPages = ["Dashboard", "Medicamentos", "Movimentacoes", "Estoque", "Vencimentos", "Compras", "Relatorios", "Inventario"];
  const satelitePages = ["Satelite", "SateliteEvolucao", "PacientesMedicao", "SateliteAdiantamento", "SateliteMovimentacoes", "LivroRegistro", "SateliteEstoque", "SateliteInventario", "MapaDispensacao", "PassagemPlantao", "SatelitePortaria"];

  useEffect(() => {
    if (isAuxiliar && user) {
      const allowedPages = [
        ...(hasCentral ? centralPages : []),
        ...(hasSatelite ? satelitePages : [])
      ];
      if (allowedPages.length > 0 && !allowedPages.includes(currentPageName)) {
        if (hasSatelite && !hasCentral) {
          navigate("/Satelite");
        } else {
          navigate("/Dashboard");
        }
      }
    }
  }, [isAuxiliar, user, currentPageName, navigate, hasCentral, hasSatelite]);

  useEffect(() => {
    if (isMedico && user) {
      toast.error("Médicos possuem acesso restrito exclusivamente ao Módulo Médico (ZORION-MEDICO).");
      handleLogout();
    }
  }, [isMedico, user]);

  return (
    <div className="min-h-screen bg-slate-100 transition-colors flex flex-col">
      <Toaster position="top-right" richColors />
      <TransferenciaAcceptModal activeSection={activeSection} />

      {/* TOP HEADER NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs px-4 sm:px-6 py-2.5 print:hidden transition-colors">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">

          {/* LEFT: ZORION Hospitalar Brand Text Only */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex flex-col justify-center">
              <h1 className="font-extrabold text-[22px] leading-none tracking-tight mb-0.5">
                <span className="text-sky-600">ZOR</span><span className="text-slate-900">ION</span>
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] leading-none text-slate-400 font-semibold">Hospitalar</span>
                <span className="w-1 h-1 rounded-full bg-sky-500"></span>
                <button
                  type="button"
                  title="Clique para alternar entre Farmácia Central e Satélite"
                  onClick={() => {
                    if (isAuxiliar && (!hasCentral || !hasSatelite)) return;
                    const nextTarget = activeSection.id === "satelite" ? "/Dashboard" : "/Satelite";
                    const nextSecId = activeSection.id === "satelite" ? "estoque" : "satelite";
                    try { sessionStorage.setItem("zorion_active_section", nextSecId); } catch (e) {}
                    navigate(nextTarget);
                  }}
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold text-sky-600 hover:text-sky-700 hover:underline leading-none cursor-pointer group"
                >
                  <span>{activeSection.name}</span>
                  {(!isAuxiliar || (hasCentral && hasSatelite)) && (
                    <ArrowLeftRight className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* CENTER: Clean Light Navigation Items (Vertical/Compact to save horizontal space) */}
          <nav className="hidden lg:flex items-center justify-center gap-0.5 xl:gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60 overflow-visible">
            {activeSection.menu.map((item) => {
              const isActive = currentPageName === item.page;
              const hasSubItems = item.subItems && item.subItems.length > 0;

              return (
                <div key={item.page} className="relative group">
                  <Link
                    to={createPageUrl(item.page)}
                    onClick={() => {
                      try {
                        sessionStorage.setItem("zorion_active_section", activeSection.id);
                      } catch (e) {}
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 px-2.5 xl:px-3 py-1 min-w-[54px] xl:min-w-[62px] rounded-xl transition-all whitespace-nowrap cursor-pointer",
                      isActive
                        ? "bg-white text-sky-700 shadow-sm font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <item.icon className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        isActive ? "text-sky-600" : "text-slate-500"
                      )} />
                      {hasSubItems && (
                        <ChevronDown className="w-2.5 h-2.5 opacity-40 group-hover:opacity-90 group-hover:rotate-180 transition-transform duration-200" />
                      )}
                    </div>
                    <span className="text-[10px] leading-tight tracking-tight">{item.name}</span>
                  </Link>

                  {/* Dropdown Popover ao passar o mouse */}
                  {hasSubItems && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1.5 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 ease-out z-50">
                      <div className="w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-1.5 space-y-0.5">
                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100/90 mb-1 flex items-center justify-between">
                          <span>{item.name}</span>
                          <span className="text-[9px] font-medium text-slate-400 lowercase">atalhos rápidos</span>
                        </div>
                        {item.subItems.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = isActive && (
                            (sub.tab && currentTab === sub.tab) ||
                            (sub.action && currentAction === sub.action)
                          );
                          const targetUrl = sub.page
                            ? createPageUrl(sub.page)
                            : (sub.tab
                                ? `${createPageUrl(item.page)}?tab=${sub.tab}`
                                : `${createPageUrl(item.page)}?action=${sub.action || ''}`);
                          return (
                            <Link
                              key={sub.tab || sub.action || sub.name}
                              to={targetUrl}
                              onClick={() => {
                                try {
                                  sessionStorage.setItem("zorion_active_section", activeSection.id);
                                } catch (e) {}
                              }}
                              className={cn(
                                "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer group/sub",
                                isSubActive
                                  ? "bg-sky-50 text-sky-900 font-semibold border border-sky-100"
                                  : "hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-transparent"
                              )}
                            >
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover/sub:scale-110 shadow-xs", sub.color)}>
                                <SubIcon className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-semibold leading-tight truncate">
                                    {sub.name}
                                  </span>
                                  {sub.badge && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                      {sub.badge}
                                    </span>
                                  )}
                                </div>
                                <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                                  {sub.desc}
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-2.5 shrink-0 pl-2">
            {/* Theme Selector Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-slate-100 border border-slate-200/80 transition-colors text-slate-600 hover:text-slate-900 cursor-pointer"
                  title="Alterar Tema Visual"
                >
                  <Palette className="w-4 h-4 text-sky-600" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-white border-slate-200 text-slate-800 shadow-xl rounded-2xl p-1.5 z-50">
                <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Temas do Sistema
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />
                {THEMES_LIST.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => setThemeColor(t.id)}
                    className={cn(
                      "flex items-center justify-between text-xs font-medium rounded-xl px-2.5 py-1.5 cursor-pointer transition-colors",
                      themeColor === t.id ? "bg-slate-100 font-bold text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: t.color }} />
                      <span>{t.name}</span>
                    </div>
                    {themeColor === t.id && <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <NotificationBell activeSection={activeSection} />
            <ServerConnectionBadge />

            {/* User Profile / Logout Dropdown */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 border border-slate-200/80 transition-colors cursor-pointer">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="text-left leading-tight hidden md:block pr-1">
                      <div className="font-bold text-slate-800 text-xs truncate max-w-[130px]" title={user.full_name}>
                        {user.full_name}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize">
                        {user.cargo || "Farmácia"}
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200 text-slate-800 shadow-xl rounded-2xl p-2">
                  <DropdownMenuLabel className="text-xs font-normal text-slate-500 pb-1.5">
                    Sessão ativa: <strong className="text-slate-900 block font-bold text-sm truncate">{user.full_name}</strong>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-100" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 rounded-xl px-2.5 py-2 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-slate-500" />
                    <span>Trocar de Módulo / Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-8 h-8 text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* MOBILE HORIZONTAL NAVIGATION MENU SLIDE-DOWN */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200/80 bg-white px-3 py-2 space-y-2 mt-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Navegação: {activeSection.name}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {activeSection.menu.map((item) => {
                  const isActive = currentPageName === item.page;
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  return (
                    <div key={item.page} className={hasSubItems ? "col-span-2 space-y-1" : ""}>
                      <Link
                        to={createPageUrl(item.page)}
                        onClick={() => {
                          try {
                            sessionStorage.setItem("zorion_active_section", activeSection.id);
                          } catch (e) {}
                          if (!hasSubItems) setMobileMenuOpen(false);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                          isActive
                            ? "bg-sky-50 text-sky-700 border border-sky-200"
                            : "text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        <item.icon className={cn(
                          "w-4 h-4",
                          isActive ? "text-sky-600" : "text-slate-400"
                        )} />
                        <span className="truncate">{item.name}</span>
                        {hasSubItems && (
                          <ChevronDown className="w-3 h-3 text-slate-400 ml-auto" />
                        )}
                      </Link>

                      {hasSubItems && (
                        <div className="grid grid-cols-2 gap-1 pl-3 pt-0.5">
                          {item.subItems.map((sub) => {
                            const SubIcon = sub.icon;
                            const isSubActive = isActive && (
                              (sub.tab && currentTab === sub.tab) ||
                              (sub.action && currentAction === sub.action)
                            );
                            const targetUrl = sub.page
                              ? createPageUrl(sub.page)
                              : (sub.tab
                                  ? `${createPageUrl(item.page)}?tab=${sub.tab}`
                                  : `${createPageUrl(item.page)}?action=${sub.action || ''}`);
                            return (
                              <Link
                                key={sub.tab || sub.action || sub.name}
                                to={targetUrl}
                                onClick={() => {
                                  try {
                                    sessionStorage.setItem("zorion_active_section", activeSection.id);
                                  } catch (e) {}
                                  setMobileMenuOpen(false);
                                }}
                                className={cn(
                                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border",
                                  isSubActive
                                    ? "bg-sky-100 text-sky-800 border-sky-200 font-bold"
                                    : "bg-slate-50 text-slate-600 hover:bg-sky-50 hover:text-sky-700 border-slate-100"
                                )}
                              >
                                <SubIcon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                <span className="truncate">{sub.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT AREA - TAKES 100% WIDTH */}
      <main className="flex-1 w-full p-4 md:p-6 print:p-0">
        {children}
      </main>

      {/* Relógio Flutuante no Canto Inferior Esquerdo */}
      <LiveClock />

      {/* Chat Zorion Flutuante no Canto Inferior Direito */}
      <ZorionChatWidget activeSection={activeSection} currentUser={user} />
    </div>
  );
}