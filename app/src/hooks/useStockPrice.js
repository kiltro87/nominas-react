import { useEffect, useState } from 'react';

export const useStockPrice = (symbol) => {
  const [price, setPrice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!symbol || import.meta.env.MODE === 'test') return () => {};

    const load = async () => {
      try {
        let json = null;
        const direct = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`);
        if (direct.ok) {
          json = await direct.json();
        } else {
          const proxy = await fetch(
            `https://api.allorigins.win/raw?url=${encodeURIComponent(
              `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
            )}`,
          );
          if (!proxy.ok) throw new Error(`HTTP ${proxy.status}`);
          json = await proxy.json();
        }
        const value = json?.quoteResponse?.result?.[0]?.regularMarketPrice;
        if (!cancelled && Number.isFinite(value)) {
          setPrice(Number(value));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'stock price error');
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return { price, error };
};
