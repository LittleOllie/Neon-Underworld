'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { parseWireCommand } from '@local/lib/wire/command-parser';
import {
  resolveWirePanelPhase,
  type WirePanelPhase,
  WIRE_UNKNOWN_HELP,
  WIRE_HIRE_THUGS_MESSAGE,
} from '@local/lib/wire/panel-state';
import type { WireExecutorStats } from '@local/lib/wire/stat-display';
import { shopPurchaseAction } from '@local/server/actions/shop.actions';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';

export function useWirePanel(stats: WireExecutorStats) {
  const router = useRouter();
  const reconcile = useGameplayReconcile();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [panelPhase, setPanelPhase] = useState<WirePanelPhase>({ phase: 'idle' });

  const statsRef = useRef(stats);
  statsRef.current = stats;

  const close = useCallback(() => {
    setOpen(false);
    setPanelPhase({ phase: 'idle' });
    setInput('');
  }, []);

  const openPanel = useCallback(() => {
    setOpen(true);
    setPanelPhase({ phase: 'idle' });
  }, []);

  const submitCommand = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      const parsed = parseWireCommand(trimmed);

      if (parsed.kind === 'NAV') {
        router.push(parsed.href);
        close();
        return;
      }

      setPanelPhase(resolveWirePanelPhase(trimmed, parsed, statsRef.current));
      setInput('');
    },
    [router, close],
  );

  const confirmPurchase = useCallback(async () => {
    const current = panelPhase;
    if (current.phase !== 'confirm') return;

    const { command, preview } = current;
    setPanelPhase({ phase: 'pending', command });

    const response = await shopPurchaseAction(preview.itemKey, preview.quantity, uuidv4());

    if (!response.success) {
      setPanelPhase({ phase: 'error', command, message: response.error });
      return;
    }

    reconcile(response.data.shell);
    setPanelPhase({
      phase: 'success',
      command,
      displayName: preview.displayName,
      quantity: response.data.quantity,
      totalCost: response.data.totalCost,
      remainingCash: response.data.newCash,
    });
  }, [panelPhase, reconcile]);

  const cancelConfirm = useCallback(() => {
    setPanelPhase({ phase: 'idle' });
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  return {
    open,
    input,
    setInput,
    panelPhase,
    openPanel,
    close,
    submitCommand,
    confirmPurchase,
    cancelConfirm,
    helpExamples: WIRE_UNKNOWN_HELP,
    hireSoonMessage: WIRE_HIRE_THUGS_MESSAGE,
  };
}

export type WirePanelController = ReturnType<typeof useWirePanel>;
