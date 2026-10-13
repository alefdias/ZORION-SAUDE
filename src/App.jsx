import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AppInitializer } from './lib/AppInitializer';
import { toast, Toaster as SonnerToaster } from "sonner";
import { useMidnightReload } from './hooks/useMidnightReload';

import { ErrorBoundary } from './components/ErrorBoundary';

// Gerador sonoro de alerta hospitalar de admissão via Web Audio API (sem dependência de arquivos externos)
export function playAdmissionAlertSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const playTone = (freq, startTime, duration, volume = 0.28) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // Sequência de chime hospitalar nítido e suave (Sol4 -> Dó5 -> Mi5 -> Sol5 -> Dó6)
    playTone(392.00, 0.00, 0.22, 0.22);
    playTone(523.25, 0.12, 0.25, 0.26);
    playTone(659.25, 0.24, 0.28, 0.30);
    playTone(783.99, 0.38, 0.38, 0.35);
    playTone(1046.50, 0.52, 0.65, 0.40);
  } catch (err) {
    console.warn("Falha ao reproduzir sinal sonoro de admissão:", err);
  }
}

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => (
  <ErrorBoundary>
    {Layout ? (
      <Layout currentPageName={currentPageName}>{children}</Layout>
    ) : (
      <>{children}</>
    )}
  </ErrorBoundary>
);

function App() {
  useMidnightReload();
  const alertedAdmissionsRef = useRef(new Set());
  const isInitializedRef = useRef(false);

  // Disparo de notificação visual + alerta sonoro
  const triggerAdmissionAlert = (data) => {
    let nome = "Novo Paciente";
    let alaNome = "";
    let leito = "";
    if (typeof data === "string") {
      const parts = data.split("|");
      nome = parts[0] || nome;
      alaNome = parts[1] || "";
      leito = parts[2] || "";
    } else if (data && typeof data === "object") {
      nome = data.nome || nome;
      alaNome = data.alaNome || data.ala_nome || "";
      leito = data.leito || "";
    }

    // Toca alerta sonoro hospitalar
    playAdmissionAlertSound();

    // Atualiza caches para listar o novo paciente
    queryClientInstance.invalidateQueries({ queryKey: ['pacientes'] });
    queryClientInstance.invalidateQueries({ queryKey: ['prescricoes_paciente'] });

    // Exibe toast proeminente
    toast.custom((t) => (
      <div className="bg-white dark:bg-slate-900 border-2 border-sky-500 rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 max-w-md w-full animate-in slide-in-from-top-4 duration-300">
        <div className="p-2.5 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-xl shrink-0">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-600"></span>
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Nova Admissão na Recepção
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Agora</span>
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
            {nome}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            {alaNome ? `Ala: ${alaNome}` : "Ala não informada"} {leito ? `• Leito: ${leito}` : ""}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={() => {
                window.location.hash = "#/PacientesMedicao";
                toast.dismiss(t);
              }}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Acessar Prontuário
            </button>
            <button
              onClick={() => toast.dismiss(t)}
              className="px-2.5 py-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 text-xs font-medium cursor-pointer"
            >
              Dispensar
            </button>
          </div>
        </div>
      </div>
    ), {
      duration: 12000,
      id: `admissao-${nome}-${alaNome}-${leito}-${Date.now()}`
    });
  };

  useEffect(() => {
    // Listeners via evento Tauri
    let unlistenDb;
    let unlistenAdmissao;
    let dbUpdateTimer = null;

    const setup = async () => {
      try {
        unlistenDb = await listen('db_update', () => {
          if (dbUpdateTimer) clearTimeout(dbUpdateTimer);
          dbUpdateTimer = setTimeout(() => {
            queryClientInstance.invalidateQueries();
          }, 800);
        });
      } catch (e) {
        console.warn('Failed to listen to db_update:', e);
      }

      try {
        unlistenAdmissao = await listen('nova_admissao', (event) => {
          const payload = event.payload;
          if (payload) {
            const sig = String(payload).trim();
            if (!alertedAdmissionsRef.current.has(sig)) {
              alertedAdmissionsRef.current.add(sig);
              triggerAdmissionAlert(payload);
            }
          }
        });
      } catch (e) {
        console.warn('Failed to listen to nova_admissao:', e);
      }
    };
    setup();

    return () => {
      if (unlistenDb) unlistenDb();
      if (unlistenAdmissao) unlistenAdmissao();
    };
  }, []);

  // Limpeza automática e garantia estrutural de tabelas
  useEffect(() => {
    const cleanMetades = async () => {
      try {
        const ip = localStorage.getItem('pg_ip');
        const dbName = localStorage.getItem('pg_db');
        const password = localStorage.getItem('pg_pass');
        if (!ip || !password) return;

        await invoke('execute_postgres', {
          ip, dbName, password,
          query: `
            ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "isMetade08" BOOLEAN DEFAULT false;
            ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "isMetade14" BOOLEAN DEFAULT false;
            ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "isMetade22" BOOLEAN DEFAULT false;
            ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "isMetade06" BOOLEAN DEFAULT false;
            ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "viaAdministracao" TEXT;
            ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "via_administracao" TEXT;
            ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Ativa';
            ALTER TABLE "Ala" ADD COLUMN IF NOT EXISTS "leitos" INTEGER DEFAULT 10;
            DELETE FROM "GavetaPaciente";
            UPDATE "PrescricaoPaciente" 
            SET "totalDiario" = ROUND("totalDiario") 
            WHERE "totalDiario" IS NOT NULL AND ("totalDiario"::numeric % 1) != 0;
          `,
        });
        queryClientInstance.invalidateQueries();
      } catch (_) { /* silencioso */ }
    };
    cleanMetades();
  }, []);

  // Polling silencioso: detecta mudanças nas tabelas e novas admissões na recepção a cada 2.5s
  useEffect(() => {
    let lastCount = null;

    const checkForChanges = async () => {
      try {
        const ip = localStorage.getItem('pg_ip');
        const dbName = localStorage.getItem('pg_db');
        const password = localStorage.getItem('pg_pass');
        if (!ip || !password) return;

        // 1. Mudança global nas tabelas
        const raw = await invoke('query_postgres', {
          ip,
          dbName,
          password,
          query: `SELECT (n_tup_ins + n_tup_upd + n_tup_del + n_tup_hot_upd)::text as cnt
                  FROM pg_stat_user_tables
                  WHERE relname IN ('Medicamento','Paciente','PrescricaoPaciente','Lote','Saida','Entrada','PedidoSatelite','TransferenciaPendente')
                  ORDER BY relname`,
        });
        const rows = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
        const current = rows.map(r => r.cnt).join('-');

        if (lastCount === null) {
          lastCount = current;
        } else if (current !== lastCount) {
          lastCount = current;
          queryClientInstance.invalidateQueries();
        }

        // 2. Monitoramento de novas admissões de pacientes da recepção
        const rawPacientes = await invoke('query_postgres', {
          ip,
          dbName,
          password,
          query: `SELECT id, nome, "alaNome", leito, created_at 
                  FROM "Paciente" 
                  WHERE (status IS NULL OR status = 'Ativo') AND deleted_at IS NULL 
                  ORDER BY created_at DESC LIMIT 8`,
        });
        const pacientesList = Array.isArray(rawPacientes) ? rawPacientes : (typeof rawPacientes === 'string' ? JSON.parse(rawPacientes) : []);

        if (!isInitializedRef.current) {
          // Inicializa conhecidos para não alertar pacientes já existentes ao abrir o app
          pacientesList.forEach(p => {
            const sig = `${p.nome || ''}|${p.alaNome || ''}|${p.leito || ''}`.trim();
            if (p.id) alertedAdmissionsRef.current.add(p.id);
            if (sig) alertedAdmissionsRef.current.add(sig);
          });
          isInitializedRef.current = true;
        } else {
          // Verifica se há novas admissões
          pacientesList.forEach(p => {
            const sig = `${p.nome || ''}|${p.alaNome || ''}|${p.leito || ''}`.trim();
            if (p.id && !alertedAdmissionsRef.current.has(p.id) && !alertedAdmissionsRef.current.has(sig)) {
              alertedAdmissionsRef.current.add(p.id);
              if (sig) alertedAdmissionsRef.current.add(sig);
              triggerAdmissionAlert(p);
            }
          });
        }
      } catch (_) { /* silencioso */ }
    };

    const interval = setInterval(checkForChanges, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <QueryClientProvider client={queryClientInstance}>
      <AppInitializer>
        <Router>
          <Routes>
            <Route path="/" element={
              <LayoutWrapper currentPageName={mainPageKey}>
                <MainPage />
              </LayoutWrapper>
            } />
            {Object.entries(Pages).map(([path, Page]) => (
              <Route
                key={path}
                path={`/${path}`}
                element={
                  <LayoutWrapper currentPageName={path}>
                    <Page />
                  </LayoutWrapper>
                }
              />
            ))}
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
        <SonnerToaster position="top-right" richColors />
      </AppInitializer>
    </QueryClientProvider>
  )
}

export default App
