import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
import logo from "./assets/logo-tr.png";
import { ServerConnectionBadge } from "@/components/ServerConnectionBadge";
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
  Moon,
  Sun,
  ClipboardCheck,
  Settings,
  CalendarX2,
  Book,
  Stethoscope,
  Activity,
  Users,
  Syringe,
  ChevronDown
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
      { name: "Relatórios", icon: FileText, page: "Relatorios" },
    ]
  },
  {
    id: "satelite",
    name: "Farmácia Satélite",
    icon: Package,
    mainPage: "Satelite",
    menu: [
      { name: "Painel Satélite", icon: LayoutDashboard, page: "Satelite" },
      { name: "Pacientes & Fixa", icon: Users, page: "PacientesMedicao" },
      { name: "Movimentações", icon: ArrowLeftRight, page: "SateliteMovimentacoes" },
      { name: "Folha Reg. Específico", icon: Book, page: "SatelitePortaria" },
      { name: "Estoque Atual", icon: Package, page: "SateliteEstoque" },
      { name: "Evolução", icon: ClipboardCheck, page: "SateliteEvolucao" },
    ]
  },
  {
    id: "rt",
    name: "Responsável Técnico (RT)",
    icon: Building2,
    mainPage: "ResponsavelTecnico",
    menu: [
      { name: "Gestão RT", icon: Users, page: "ResponsavelTecnico" },
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
  },
  {
    id: "clinico",
    name: "Clínico & Recepção",
    icon: Stethoscope,
    mainPage: "Recepcao",
    menu: [
      { name: "Recepção", icon: Users, page: "Recepcao" },
      { name: "Admissões", icon: ClipboardCheck, page: "RecepcaoAdmissoes" },
      { name: "Enfermagem", icon: Syringe, page: "Enfermagem" },
      { name: "Médico", icon: Stethoscope, page: "Medico" },
    ]
  }
];

function getCurrentSection(pageName) {
  if (pageName === "LivroRegistro") {
    return moduleSections.find(sec => sec.id === "satelite");
  }
  for (const sec of moduleSections) {
    if (sec.menu.some(m => m.page === pageName)) {
      return sec;
    }
  }
  return moduleSections[0]; // fallback: estoque
}

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("pharma_dark_mode");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    setUser({ full_name: "Administrador" });
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F11") {
        e.preventDefault();
        navigate(createPageUrl("Movimentacoes") + "?tab=entradas&action=new");
      } else if (e.key === "F12") {
        e.preventDefault();
        navigate(createPageUrl("Movimentacoes") + "?tab=saidas&action=new");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("pharma_dark_mode", JSON.stringify(darkMode));
  }, [darkMode]);

  const { showWelcome } = useWelcome();

  const handleLogout = () => {
    showWelcome();
  };

  const activeSection = getCurrentSection(currentPageName);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors flex flex-col">
      <Toaster position="top-right" richColors />
      <TransferenciaAcceptModal activeSection={activeSection} />

      {/* TOP HEADER NAVIGATION BAR */}
      <header className="sticky top-0 z-50 bg-[#0F172A] text-white shadow-lg border-b border-slate-800 print:hidden">
        <div className="max-w-[1920px] mx-auto px-4 flex items-center justify-between h-14 gap-4">
          
          {/* LEFT: AXION Hospitalar Brand Text Only */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex flex-col justify-center">
              <h1 className="font-extrabold text-[20px] leading-none tracking-tight mb-0.5">
                <span className="text-blue-500">AX</span><span className="text-white">ION</span>
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
          <nav className="hidden lg:flex items-center justify-center gap-1 lg:gap-3 flex-1 min-w-0 overflow-x-auto no-scrollbar px-2 py-1">
            {activeSection.menu.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-2.5 py-1 min-w-[72px] rounded-lg transition-all whitespace-nowrap group shrink-0",
                    isActive
                      ? "bg-blue-600/20 border border-blue-500/30 text-blue-400 shadow-inner"
                      : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-transparent"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 shrink-0 transition-colors",
                    isActive ? "text-blue-400" : "text-slate-500 group-hover:text-cyan-400"
                  )} />
                  <span className="text-[10px] font-bold tracking-wide uppercase">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: Actions (Sync, Dark Mode, Profile) */}
          <div className="flex items-center gap-2 shrink-0 pl-2">
            <ServerConnectionBadge />

            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
              className="w-7 h-7 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800"
              title="Alternar Tema"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </Button>

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
                <DropdownMenuContent align="end" className="w-48 bg-[#0F172A] border-slate-800 text-slate-200">
                  <DropdownMenuLabel className="text-[11px] font-normal text-slate-400">
                    Sessão ativa: <strong className="text-white block font-medium truncate">{user.full_name}</strong>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem
                    onClick={() => setDarkMode(!darkMode)}
                    className="flex items-center gap-2 cursor-pointer text-xs hover:bg-slate-800"
                  >
                    {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                    <span>{darkMode ? "Modo Claro" : "Modo Escuro"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-800" />
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
          <div className="lg:hidden border-t border-slate-800 bg-[#0F172A] px-3 py-2 space-y-2">
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
    </div>
  );
}