import { RouteLoadingState } from '@local/components/game/RouteLoadingState';

/** Content-area placeholder while route data loads — shell stays mounted in parent layout. */
export default function GameRouteLoading() {
  return <RouteLoadingState />;
}
