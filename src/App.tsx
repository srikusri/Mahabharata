import { Board } from './components/Board/Board';
import { GuestLobby } from './screens/GuestLobby';
import { Home } from './screens/Home';
import { HostLobby } from './screens/HostLobby';
import { HostSetup } from './screens/HostSetup';
import { JoinFlow } from './screens/JoinFlow';
import { PlayScreen } from './screens/PlayScreen';
import { useStore } from './state/connectionStore';

/** Dev aid: open the app at #board-preview to see the board with sample tokens, without pairing. */
function BoardPreview() {
  const tokens = (['crown', 'chariot', 'horse', 'elephant', 'conch', 'bow'] as const).map((tokenId, i) => ({
    id: tokenId,
    tokenId,
    position: [0, 0, 5, 12, 23, 39][i],
    name: tokenId,
  }));
  return (
    <main className="mx-auto max-w-3xl p-3">
      <Board tokens={tokens} activeIndex={12} />
    </main>
  );
}

export default function App() {
  const screen = useStore((s) => s.screen);
  if (typeof location !== 'undefined' && location.hash === '#board-preview') return <BoardPreview />;
  switch (screen) {
    case 'host-setup':
      return <HostSetup />;
    case 'host-lobby':
      return <HostLobby />;
    case 'join':
      return <JoinFlow />;
    case 'guest-lobby':
      return <GuestLobby />;
    case 'play':
      return <PlayScreen />;
    default:
      return <Home />;
  }
}
