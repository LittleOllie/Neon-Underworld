/**
 * Guards dev-only seed/fixture scripts from running against production by accident.
 */
export function assertDevSeedAllowed(scriptName: string): void {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_SEED !== 'true') {
    console.error(
      `[${scriptName}] Refusing to run in production. Set ALLOW_DEV_SEED=true only for deliberate operator use.`,
    );
    process.exit(1);
  }
}
