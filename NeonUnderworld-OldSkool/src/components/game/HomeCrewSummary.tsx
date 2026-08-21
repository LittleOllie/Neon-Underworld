import { StatusBar } from './StatusBar';
import { OS_TERMS } from '@local/config/terminology';

export function HomeCrewSummary({
  workers,
  thugs,
  workerHappiness,
  thugHappiness,
}: {
  workers: number;
  thugs: number;
  workerHappiness: number;
  thugHappiness: number;
}) {
  return (
    <section className="g-crew-summary" aria-label="Crew status">
      <div className="g-crew-summary__col">
        <p className="g-crew-summary__label">{OS_TERMS.workers}</p>
        <p className="g-crew-summary__count">{workers.toLocaleString()}</p>
        <StatusBar label="Morale" percent={workerHappiness} />
      </div>
      <div className="g-crew-summary__col">
        <p className="g-crew-summary__label">{OS_TERMS.thugs}</p>
        <p className="g-crew-summary__count">{thugs.toLocaleString()}</p>
        <StatusBar label="Morale" percent={thugHappiness} />
      </div>
    </section>
  );
}
