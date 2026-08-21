'use client';

import { NU_DEFAULT_THEME, NU_THEME_PRESETS } from '@core/config/game/nu-default-theme';
import { clampAccentHex, isValidHexColor } from '@core/lib/game-engine/theme-safety';

export function ThemeColorControls({
  primary,
  secondary,
  customizing,
  onPrimaryChange,
  onSecondaryChange,
  onUseSuggested,
  onCustomize,
  onResetDefault,
  disabled = false,
}: {
  primary: string;
  secondary: string;
  customizing: boolean;
  onPrimaryChange: (hex: string) => void;
  onSecondaryChange: (hex: string) => void;
  onUseSuggested: () => void;
  onCustomize: () => void;
  onResetDefault: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="g-identity-theme" aria-label="Your colours">
      <h2 className="g-identity-theme__title">Your Colours</h2>
      <p className="g-identity-select__palette">Suggested theme</p>
      <div className="g-identity-theme__swatches" aria-hidden>
        <span className="g-identity-theme__swatch" style={{ background: primary }} title="Primary" />
        <span className="g-identity-theme__swatch" style={{ background: secondary }} title="Secondary" />
      </div>
      <p className="g-note g-identity-theme__labels">
        Primary: <strong>{primary}</strong> · Secondary: <strong>{secondary}</strong>
      </p>

      <div className="g-btn-row g-identity-theme__actions">
        <button
          type="button"
          className="g-btn g-btn-secondary"
          disabled={disabled}
          onClick={onUseSuggested}
        >
          Use suggested colours
        </button>
        <button
          type="button"
          className="g-btn g-btn-secondary"
          disabled={disabled}
          onClick={onCustomize}
        >
          {customizing ? 'Using custom colours' : 'Customize colours'}
        </button>
        <button
          type="button"
          className="g-btn g-btn-secondary"
          disabled={disabled}
          onClick={onResetDefault}
        >
          Reset to NU default
        </button>
      </div>

      {customizing ? (
        <div className="g-identity-theme__custom">
          <label className="g-field-label">
            Primary accent
            <input
              type="color"
              value={primary}
              disabled={disabled}
              onChange={(e) => onPrimaryChange(e.target.value)}
              aria-label="Primary accent colour"
            />
          </label>
          <label className="g-field-label">
            Secondary accent
            <input
              type="color"
              value={secondary}
              disabled={disabled}
              onChange={(e) => onSecondaryChange(e.target.value)}
              aria-label="Secondary accent colour"
            />
          </label>
          <div className="g-identity-theme__presets" role="group" aria-label="Theme presets">
            {NU_THEME_PRESETS.map((preset) => (
              <button
                key={preset.primary}
                type="button"
                className="g-identity-theme__preset"
                disabled={disabled}
                title="Apply preset"
                onClick={() => {
                  onPrimaryChange(preset.primary);
                  onSecondaryChange(preset.secondary);
                }}
              >
                <span style={{ background: preset.primary }} />
                <span style={{ background: preset.secondary }} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function sanitizeThemeInput(primary: string, secondary: string): { primary: string; secondary: string } | null {
  if (!isValidHexColor(primary) || !isValidHexColor(secondary)) return null;
  return {
    primary: clampAccentHex(primary, 'primary'),
    secondary: clampAccentHex(secondary, 'secondary'),
  };
}

export { NU_DEFAULT_THEME };
