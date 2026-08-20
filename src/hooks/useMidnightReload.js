import { useEffect } from 'react';

/**
 * Hook para recarregar a página automaticamente na virada do dia (meia-noite).
 * Isso garante que todas as datas calculadas (como "hoje") e os estados iniciais
 * (como filtros de data) sejam atualizados para o dia atual em sistemas que
 * ficam abertos 24h (como os da farmácia).
 */
export function useMidnightReload() {
  useEffect(() => {
    const checkAndReload = () => {
      const now = new Date();
      const nextMidnight = new Date();
      
      // Define para a próxima meia-noite
      nextMidnight.setHours(24, 0, 0, 0); 
      
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      
      // Adiciona 1 segundo de margem para ter certeza de que o dia virou
      const timeoutId = setTimeout(() => {
        window.location.reload();
      }, msUntilMidnight + 1000);
      
      return timeoutId;
    };

    const timerId = checkAndReload();

    return () => clearTimeout(timerId);
  }, []);
}
