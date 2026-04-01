import { useEffect, useState } from 'react';
import { fetchPortfolioData } from '../services/portfolioRepository';

const EMPTY = { transactions: [], currentQty: 0, totalEurValue: 0 };

/**
 * Loads portfolio transactions from Supabase.
 *
 * @param {boolean} enabled - Only fetch when the user is authenticated.
 * @returns {{ portfolio: typeof EMPTY, loading: boolean, error: string|null }}
 */
export const usePortfolioData = (enabled = true) => {
  const [portfolio, setPortfolio] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) return () => {};

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPortfolioData();
        if (!cancelled) setPortfolio(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando cartera');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { portfolio, loading, error };
};
