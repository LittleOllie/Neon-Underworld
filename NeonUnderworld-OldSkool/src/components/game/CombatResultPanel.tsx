import Link from 'next/link';
import { PrimaryButton } from './PrimaryButton';
import { ButtonContent } from './ButtonContent';
import type { CombatResultPresentation } from '@core/lib/game-engine/combat/attack-result-presentation';
import type { GameIconName } from '@local/config/game-icons';

export interface CombatResultAction {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  icon?: GameIconName;
}

function lineClass(tone?: 'positive' | 'negative' | 'neutral' | 'value'): string | undefined {
  if (tone === 'positive') return 'g-result-line--positive';
  if (tone === 'negative') return 'g-result-line--negative';
  if (tone === 'value') return 'g-result-line--value';
  return 'g-result-line--neutral';
}

export function CombatResultPanel({
  presentation,
  primaryActions,
  secondaryActions,
}: {
  presentation: CombatResultPresentation;
  primaryActions?: CombatResultAction[];
  secondaryActions?: CombatResultAction[];
}) {
  return (
    <div className="g-combat-result g-result">
      <h2
        className={`g-combat-result__heading g-combat-result__heading--${presentation.headingVariant}`}
      >
        {presentation.heading}
      </h2>
      <p className="g-combat-result__context">{presentation.contextLine}</p>
      {presentation.subtitle && (
        <p className="g-combat-result__subtitle">{presentation.subtitle}</p>
      )}

      {presentation.sections.map((section) => (
        <div key={section.label} className="g-combat-result__section">
          <p className="g-combat-result__section-label">{section.label}</p>
          <ul className="g-combat-result__lines">
            {section.lines.map((line, index) => (
              <li key={`${section.label}-${index}`} className={lineClass(line.tone)}>
                {line.text}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="g-combat-result__closing">{presentation.closingLine}</p>

      {primaryActions && primaryActions.length > 0 && (
        <div className="g-result-actions">
          {primaryActions.map((action) =>
            action.onClick ? (
              <PrimaryButton
                key={action.label}
                className="g-btn-full"
                icon={action.icon}
                onClick={action.onClick}
              >
                {action.label}
              </PrimaryButton>
            ) : (
              <Link
                key={action.href ?? action.label}
                href={action.href!}
                className="g-btn g-btn-full"
              >
                <ButtonContent icon={action.icon}>{action.label}</ButtonContent>
              </Link>
            ),
          )}
        </div>
      )}

      {secondaryActions && secondaryActions.length > 0 && (
        <p className="g-result-secondary">
          {secondaryActions.map((action, index) => (
            <span key={action.href ?? action.label}>
              {index > 0 ? <span className="g-result-secondary-sep"> · </span> : null}
              {action.onClick ? (
                <button
                  type="button"
                  className="g-result-secondary-link g-combat-result__secondary-btn"
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ) : (
                <Link href={action.href!} className="g-result-secondary-link">
                  {action.label}
                </Link>
              )}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
