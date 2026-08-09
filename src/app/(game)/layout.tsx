import { GameAppShell } from '@/components/game/GameAppShell';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <GameAppShell>{children}</GameAppShell>;
}
