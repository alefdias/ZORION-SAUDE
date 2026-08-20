import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchInterval: 500, // Atualiza automaticamente a cada 500 milissegundos
      staleTime: 0,
      retry: 1,
    },
  },
});