import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AppInitializer } from './lib/AppInitializer';
import { Toaster as SonnerToaster } from "sonner";
import { useMidnightReload } from './hooks/useMidnightReload';

import { ErrorBoundary } from './components/ErrorBoundary';

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

  useEffect(() => {
    // Listener via evento Tauri (mantém como complemento)
    let unlisten;
    const setup = async () => {
      try {
        unlisten = await listen('db_update', () => {
          queryClientInstance.invalidateQueries();
        });
      } catch (e) {
        console.warn('Failed to listen to db_update:', e);
      }
    };
    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Limpeza automática de metades do banco de dados (GavetaPaciente e frações)
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

  // Polling silencioso: detecta qualquer mudança no banco a cada 4s
  // Sem piscar, sem interromper — só invalida o cache do React Query em background
  useEffect(() => {
    let lastCount = null;

    const checkForChanges = async () => {
      try {
        const ip = localStorage.getItem('pg_ip');
        const dbName = localStorage.getItem('pg_db');
        const password = localStorage.getItem('pg_pass');
        if (!ip || !password) return;

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
          // Silencioso: só invalida cache, sem nenhum efeito visual
          queryClientInstance.invalidateQueries();
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
