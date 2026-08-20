import { useEffect } from 'react';
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

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

function App() {
  useMidnightReload();

  useEffect(() => {
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
