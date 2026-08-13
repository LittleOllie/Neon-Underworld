import { ActionButton } from './ActionButton';

type Props = {
  variant: 'first-move' | 'next-move';
};

export function FirstMoveCard({ variant }: Props) {
  if (variant === 'first-move') {
    return (
      <section className="g-first-move" aria-label="Get started">
        <p className="g-first-move__eyebrow">Get started</p>
        <h2 className="g-first-move__title">Build your crew</h2>
        <p className="g-first-move__body">
          Scout different parts of the city to find Workers and Thugs. Workers make money. Thugs
          protect your empire and fight for you.
        </p>
        <p className="g-first-move__hint">Start with 25 turns.</p>
        <ActionButton href="/scout?turns=25&area=streets" icon="scout">
          Scout 25 turns
        </ActionButton>
      </section>
    );
  }

  return (
    <section className="g-first-move" aria-label="Next step">
      <p className="g-first-move__eyebrow">Next move</p>
      <h2 className="g-first-move__title">Your crew is growing</h2>
      <p className="g-first-move__body">
        Keep scouting, or visit the Shop to arm your Thugs and stock Worker supplies.
      </p>
      <div className="g-first-move__actions">
        <ActionButton href="/scout?turns=25&area=streets" icon="scout">
          Keep scouting
        </ActionButton>
        <ActionButton href="/shop" icon="shop">
          Visit shop
        </ActionButton>
      </div>
    </section>
  );
}
