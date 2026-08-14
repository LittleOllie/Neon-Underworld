import Link from 'next/link';
import { PrimaryButton } from './PrimaryButton';
import { ActionButton } from './ActionButton';
import { ButtonContent } from './ButtonContent';
import type { GameIconName } from '@local/config/game-icons';

export interface ActionResultLine {
  text: string;
  tone?: 'positive' | 'negative' | 'neutral' | 'value';
}

export interface ActionResultAction {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  icon?: GameIconName;
}

function lineClass(tone?: ActionResultLine['tone']): string | undefined {
  if (tone === 'positive') return 'g-result-line--positive';
  if (tone === 'negative') return 'g-result-line--negative';
  if (tone === 'value') return 'g-result-line--value';
  return undefined;
}

export function ActionResult({
  title,
  lines,
  actions,
  secondaryActions,
}: {
  title: string;
  lines: ActionResultLine[];
  actions?: ActionResultAction[];
  /** Compact inline links below primary actions (e.g. Shop · Produce · Home). */
  secondaryActions?: ActionResultAction[];
}) {
  const primaryActions = actions?.filter((a) => a.primary !== false) ?? [];
  const inlineSecondary =
    secondaryActions ??
    actions?.filter((a) => a.primary === false && a.href) ??
    [];

  return (
    <div className="g-result">
      <h2 className="g-result-title">{title}</h2>
      <ul className="g-result-lines">
        {lines.map((line, i) => (
          <li key={i} className={lineClass(line.tone)}>
            {line.text}
          </li>
        ))}
      </ul>
      {primaryActions.length > 0 && (
        <div className="g-result-actions">
          {primaryActions.map((a) =>
            a.onClick ? (
              <PrimaryButton
                key={a.label}
                className="g-btn-full"
                icon={a.icon}
                onClick={a.onClick}
              >
                {a.label}
              </PrimaryButton>
            ) : (
              <Link
                key={a.href ?? a.label}
                href={a.href!}
                className="g-btn g-btn-full"
              >
                <ButtonContent icon={a.icon}>{a.label}</ButtonContent>
              </Link>
            ),
          )}
        </div>
      )}
      {inlineSecondary.length > 0 && (
        <p className="g-result-secondary">
          {inlineSecondary.map((a, index) => (
            <span key={a.href ?? a.label}>
              {index > 0 ? <span className="g-result-secondary-sep"> · </span> : null}
              <Link href={a.href!} className="g-result-secondary-link">
                {a.label}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
