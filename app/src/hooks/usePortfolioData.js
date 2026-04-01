import { useEffect, useState } from 'react';
import { portfolioMockData } from '../data/payrollData';
import { fetchPortfolioData } from '../services/portfolioRepository';

const EMPTY = { transactions: [], currentQty: 0, totalEurValue: 0 };

/**
 * Loads portfolio transactions from Supabase, or returns mock data.
 *
 * @param {boolean} enabled - Only fetch when the user is authenticated.
 * @param {boolean} forceMock - Return mock data instead of querying Supabase.
 * @returns {{ portfolio: typeof EMPTY, loading: boolean, error: string|null }}
 */
export const usePortfolioData = (enabled = true, forceMock = false) => {
  const [portfolio, setPortfolio] = useState(forceMock ? portfolioMockData : EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (forceMock) {
      setPortfolio(portfolioMockData);
      return () => {};
    }
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
  }, [enabled, forceMock]);

  return { portfolio, loading, error };
};
