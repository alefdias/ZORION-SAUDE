import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
import { ServerConnectionBadge } from "@/components/ServerConnectionBadge";
import { NotificationBell } from "@/components/NotificationBell";
import { useWelcome } from "@/lib/AppInitializer";
import { TransferenciaAcceptModal } from "@/components/TransferenciaAcceptModal";

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
  ShieldCheck
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

const moduleSections = [
  {
    id: "estoque",
    name: "Estoque Central",
    icon: Boxes,
    mainPage: "Dashboard",
    menu: [
      { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
      { name: "Medicamentos", icon: Package, page: "Medicamentos" },
      { name: "Movimentações", icon: ArrowLeftRight, page: "Movimentacoes" },
      { name: "Estoque", icon: Boxes, page: "Estoque" },
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
      { name: "Pacientes", icon: Users, page: "PacientesMedicao" },
      { name: "Adiantamento", icon: CreditCard, page: "SateliteAdiantamento" },
      { name: "Movimentações", icon: ArrowLeftRight, page: "SateliteMovimentacoes" },
      { name: "Portaria 344", icon: Book, page: "LivroRegistro" },
      { name: "Estoque", icon: Package, page: "SateliteEstoque" },
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
  if (pageName === "LivroRegistro" || pageName === "SateliteAdiantamento" || pageName === "SatelitePortaria") {
    return moduleSections.find(sec => sec.id === "satelite");
  }
  for (const sec of moduleSections) {
    if (sec.menu.some(m => m.page === pageName)) {
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
    <div className="fixed bottom-3 right-4 z-50 flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/90 text-slate-200 border border-slate-700/80 rounded-full shadow-xl backdrop-blur-md text-xs font-mono select-none hover:bg-slate-900 transition-all pointer-events-none">
      <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
      <span className="capitalize text-slate-300 font-medium">{dateStr}</span>
      <span className="font-bold text-cyan-300 tracking-wide">{timeStr}</span>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    setUser({ full_name: "Administrador" });
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


  useEffect(() => {
    setUser({ full_name: "Administrador" });
  }, []);

  const { showWelcome } = useWelcome();

  const handleLogout = () => {
    showWelcome();
  };

  const activeSection = getCurrentSection(currentPageName);

  return (
    <div className="min-h-screen bg-slate-100 transition-colors flex flex-col">
      <Toaster position="top-right" richColors />
      <TransferenciaAcceptModal activeSection={activeSection} />

      {/* TOP HEADER NAVIGATION BAR */}
      <header className="sticky top-0 z-50 bg-blue-950 border-blue-900 text-white shadow-lg border-b print:hidden transition-colors">
        <div className="max-w-[1920px] mx-auto px-4 flex items-center justify-between h-14 gap-4">

          {/* LEFT: ZORION Hospitalar Brand Text Only */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex flex-col justify-center">
              <h1 className="font-extrabold text-[20px] leading-none tracking-tight mb-0.5">
                <span className="text-blue-500">ZOR</span><span className="text-white">ION</span>
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] leading-none text-slate-400 font-medium">Hospitalar</span>
                <span className="w-1 h-1 rounded-full bg-cyan-500"></span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-400 leading-none">
                  {activeSection.name}
                </span>
              </div>
            </div>
          </div>

          {/* CENTER: Delphi/POS Style Vertical Navigation Items */}
          <nav className="hidden lg:flex items-center justify-center gap-1 xl:gap-2 flex-1 min-w-0 overflow-x-auto no-scrollbar px-1 py-1">
            {activeSection.menu.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 px-2 xl:px-2.5 py-1 min-w-[58px] xl:min-w-[68px] rounded-lg transition-all whitespace-nowrap group shrink-0",
                    isActive
                      ? "bg-blue-600/20 border border-blue-500/30 text-blue-400 shadow-inner"
                      : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-transparent"
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4 xl:w-4.5 xl:h-4.5 shrink-0 transition-colors",
                    isActive ? "text-blue-400" : "text-slate-500 group-hover:text-cyan-400"
                  )} />
                  <span className="text-[10px] font-bold tracking-tight uppercase">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: Actions (Sync, Notifications, Dark Mode, Profile) */}
          <div className="flex items-center gap-2 shrink-0 pl-2">
            <LiveClock />
            <NotificationBell />
            <ServerConnectionBadge />

            {/* User Profile / Logout Dropdown */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-slate-800 transition-colors">
                    <div className="w-6 h-6 rounded-full bg-blue-600/20 ring-1 ring-blue-500/40 flex items-center justify-center shrink-0">
                      <User className="w-3 h-3 text-blue-400" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-200 hidden md:inline truncate max-w-[150px]">
                      {user.full_name}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400 hidden md:inline" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-blue-950 border-blue-900 text-slate-200">
                  <DropdownMenuLabel className="text-[11px] font-normal text-slate-400">
                    Sessão ativa: <strong className="text-white block font-medium truncate">{user.full_name}</strong>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-blue-900/50" />
                  <DropdownMenuSeparator className="bg-blue-900/50" />

                  <div className="px-2 py-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-2 px-1">
                      <Palette className="w-3.5 h-3.5" />
                      <span>Cor do Sistema</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 px-1 pb-1">
                      {[
                        { id: "theme-ocean", name: "Oceano", colors: ["bg-blue-600", "bg-blue-900", "bg-slate-100", "bg-white"] },
                        { id: "theme-emerald", name: "Esmeralda", colors: ["bg-emerald-600", "bg-[#064e3b]", "bg-[#f0fdf4]", "bg-white"] },
                        { id: "theme-midnight", name: "Meia-noite", colors: ["bg-slate-500", "bg-slate-900", "bg-[#020617]", "bg-slate-800"] },
                        { id: "theme-sunset", name: "Pôr do Sol", colors: ["bg-orange-500", "bg-[#431407]", "bg-orange-50", "bg-white"] },
                        { id: "theme-amethyst", name: "Ametista", colors: ["bg-purple-500", "bg-[#3b0764]", "bg-purple-50", "bg-white"] },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setThemeColor(t.id)}
                          className={cn(
                            "flex items-center gap-3 p-1.5 rounded-lg transition-colors border text-left",
                            themeColor === t.id ? "bg-blue-900/50 border-blue-500/50" : "hover:bg-blue-900/30 border-transparent"
                          )}
                        >
                          <div className="flex -space-x-1 shrink-0">
                            {t.colors.map((c, i) => <div key={i} className={cn("w-4 h-4 rounded-full ring-2 ring-blue-950", c)} />)}
                          </div>
                          <span className={cn("text-[11px] font-medium transition-colors", themeColor === t.id ? "text-white" : "text-slate-300")}>{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-blue-900/50" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2 cursor-pointer text-xs text-red-400 hover:bg-red-500/10 focus:text-red-300"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair da Conta</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-7 h-7 text-slate-300 hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* MOBILE HORIZONTAL NAVIGATION MENU SLIDE-DOWN */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-blue-900 bg-blue-950 px-3 py-2 space-y-2">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Navegação: {activeSection.name}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {activeSection.menu.map((item) => {
                  const isActive = currentPageName === item.page;
                  return (
                    <Link
                      key={item.page}
                      to={createPageUrl(item.page)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all",
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-slate-300 bg-slate-800/60 hover:bg-slate-800"
                      )}
                    >
                      <item.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
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

      {/* Relógio Flutuante no Canto Inferior Direito */}
      <LiveClock />
    </div>
  );
}