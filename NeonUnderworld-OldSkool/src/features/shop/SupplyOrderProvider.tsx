'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  estimateSupplyOrderTotal,
  estimateSupplyOrderUnits,
  mergeSupplyOrderLines,
  type SupplyOrderLine,
} from './supply-order';

const STORAGE_KEY = 'nu-supply-order-v1';

type SupplyOrderContextValue = {
  lines: SupplyOrderLine[];
  itemTypeCount: number;
  totalUnits: number;
  estimatedTotal: number;
  reviewOpen: boolean;
  hasItems: boolean;
  addLine: (itemId: SupplyOrderLine['itemId'], quantity: number) => void;
  updateLineQuantity: (itemId: SupplyOrderLine['itemId'], quantity: number) => void;
  removeLine: (itemId: SupplyOrderLine['itemId']) => void;
  clearOrder: () => void;
  openReview: () => void;
  closeReview: () => void;
};

const SupplyOrderContext = createContext<SupplyOrderContextValue | null>(null);

function readStoredLines(): SupplyOrderLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return mergeSupplyOrderLines(
      parsed.filter(
        (line): line is SupplyOrderLine =>
          line != null &&
          typeof line === 'object' &&
          typeof (line as SupplyOrderLine).itemId === 'string' &&
          Number.isInteger((line as SupplyOrderLine).quantity) &&
          (line as SupplyOrderLine).quantity > 0,
      ),
    );
  } catch {
    return [];
  }
}

export function SupplyOrderProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<SupplyOrderLine[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLines(readStoredLines());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (lines.length === 0) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const mergedLines = useMemo(() => mergeSupplyOrderLines(lines), [lines]);
  const itemTypeCount = mergedLines.length;
  const totalUnits = useMemo(() => estimateSupplyOrderUnits(mergedLines), [mergedLines]);
  const estimatedTotal = useMemo(() => estimateSupplyOrderTotal(mergedLines), [mergedLines]);

  const addLine = useCallback((itemId: SupplyOrderLine['itemId'], quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    setLines((prev) => mergeSupplyOrderLines([...prev, { itemId, quantity }]));
  }, []);

  const updateLineQuantity = useCallback((itemId: SupplyOrderLine['itemId'], quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1) {
      setLines((prev) => prev.filter((line) => line.itemId !== itemId));
      return;
    }
    setLines((prev) =>
      mergeSupplyOrderLines(
        prev.map((line) => (line.itemId === itemId ? { ...line, quantity } : line)),
      ),
    );
  }, []);

  const removeLine = useCallback((itemId: SupplyOrderLine['itemId']) => {
    setLines((prev) => prev.filter((line) => line.itemId !== itemId));
  }, []);

  const clearOrder = useCallback(() => {
    setLines([]);
    setReviewOpen(false);
  }, []);

  const openReview = useCallback(() => {
    if (mergedLines.length > 0) setReviewOpen(true);
  }, [mergedLines.length]);

  const closeReview = useCallback(() => {
    setReviewOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      lines: mergedLines,
      itemTypeCount,
      totalUnits,
      estimatedTotal,
      reviewOpen,
      hasItems: itemTypeCount > 0,
      addLine,
      updateLineQuantity,
      removeLine,
      clearOrder,
      openReview,
      closeReview,
    }),
    [
      mergedLines,
      itemTypeCount,
      totalUnits,
      estimatedTotal,
      reviewOpen,
      addLine,
      updateLineQuantity,
      removeLine,
      clearOrder,
      openReview,
      closeReview,
    ],
  );

  return <SupplyOrderContext.Provider value={value}>{children}</SupplyOrderContext.Provider>;
}

export function useSupplyOrder(): SupplyOrderContextValue {
  const ctx = useContext(SupplyOrderContext);
  if (!ctx) {
    throw new Error('useSupplyOrder must be used within SupplyOrderProvider');
  }
  return ctx;
}

export type SupplyOrderState = SupplyOrderContextValue;
