import type { WireCommand } from './types';
import { formatWireStat, WIRE_HIRE_THUGS_MESSAGE, WIRE_UNKNOWN_HELP, type WireExecutorStats } from './stat-display';
import { buildWirePurchasePreview, type WirePurchasePreview } from './purchase-preview';

export type WirePanelPhase =
  | { phase: 'idle' }
  | { phase: 'stat'; command: string; label: string; value: string }
  | { phase: 'confirm'; command: string; preview: WirePurchasePreview }
  | { phase: 'insufficient'; command: string; title: string; message: string; maxAffordable?: number; displayName?: string; unitPrice?: number }
  | { phase: 'hire_soon'; command: string }
  | { phase: 'unknown'; command: string; reason?: string }
  | { phase: 'success'; command: string; displayName: string; quantity: number; totalCost: number; remainingCash: number }
  | { phase: 'error'; command: string; message: string }
  | { phase: 'pending'; command: string };

/** Pure mapping from parsed command + live stats → panel phase (no I/O). */
export function resolveWirePanelPhase(
  commandText: string,
  parsed: WireCommand,
  stats: WireExecutorStats,
): WirePanelPhase {
  const command = commandText.trim();

  if (parsed.kind === 'STAT') {
    const display = formatWireStat(parsed.stat, stats);
    return { phase: 'stat', command, label: display.label, value: display.value };
  }

  if (parsed.kind === 'HIRE_THUGS') {
    return { phase: 'hire_soon', command };
  }

  if (parsed.kind === 'BUY') {
    const result = buildWirePurchasePreview(parsed, stats.cash);
    if (!result.ok) {
      if (result.reason === 'insufficient') {
        const maxHint =
          result.maxAffordable != null && result.maxAffordable > 0 && result.displayName
            ? `You can afford a maximum of ${result.maxAffordable.toLocaleString()} ${result.displayName}${result.maxAffordable === 1 ? '' : 's'}.`
            : result.message;
        return {
          phase: 'insufficient',
          command,
          title: 'INSUFFICIENT CASH',
          message: maxHint,
          maxAffordable: result.maxAffordable,
          displayName: result.displayName,
          unitPrice: result.unitPrice,
        };
      }
      return {
        phase: 'insufficient',
        command,
        title: 'INSUFFICIENT CASH',
        message: result.message,
        displayName: result.displayName,
        unitPrice: result.unitPrice,
      };
    }
    return { phase: 'confirm', command, preview: result.preview };
  }

  if (parsed.kind === 'UNKNOWN') {
    return { phase: 'unknown', command, reason: parsed.reason };
  }

  return { phase: 'unknown', command, reason: 'Unrecognized command.' };
}

export { WIRE_HIRE_THUGS_MESSAGE, WIRE_UNKNOWN_HELP, WIRE_EXAMPLE_COMMANDS } from './stat-display';
