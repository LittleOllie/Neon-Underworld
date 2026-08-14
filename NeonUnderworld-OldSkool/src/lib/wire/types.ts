import type { ShopItemKey } from '@core/config/game/shop-rules';

export type WireStatKind = 'cash' | 'netWorth' | 'rank' | 'turns' | 'workers' | 'thugs';

export type WireBuyMode = 'fixed' | 'max';

export type WireCommand =
  | { kind: 'NAV'; href: string }
  | { kind: 'STAT'; stat: WireStatKind }
  | { kind: 'BUY'; itemKey: ShopItemKey; mode: 'fixed'; quantity: number }
  | { kind: 'BUY'; itemKey: ShopItemKey; mode: 'max' }
  | { kind: 'HIRE_THUGS'; mode: 'fixed'; quantity: number }
  | { kind: 'HIRE_THUGS'; mode: 'max' }
  | { kind: 'UNKNOWN'; reason?: string };

export function isWireNavCommand(cmd: WireCommand): cmd is Extract<WireCommand, { kind: 'NAV' }> {
  return cmd.kind === 'NAV';
}

export function isWireStatCommand(cmd: WireCommand): cmd is Extract<WireCommand, { kind: 'STAT' }> {
  return cmd.kind === 'STAT';
}

export function isWireBuyCommand(cmd: WireCommand): cmd is Extract<WireCommand, { kind: 'BUY' }> {
  return cmd.kind === 'BUY';
}

export function isWireHireThugsCommand(
  cmd: WireCommand,
): cmd is Extract<WireCommand, { kind: 'HIRE_THUGS' }> {
  return cmd.kind === 'HIRE_THUGS';
}
