import type { GuestStatus } from '../../multiplayer/GuestManager';

const TEXT: Record<GuestStatus, string> = {
  connecting: 'Connecting',
  open: 'Connected',
  joining: 'Joining',
  joined: 'In room',
  rejected: 'Removed',
  closed: 'Disconnected',
};

export function ConnectionBadge({ status, rttMs }: { status: GuestStatus | 'host'; rttMs?: number | null }) {
  const bad = status === 'closed' || status === 'rejected';
  const warn = status === 'connecting' || status === 'joining';
  const color = bad ? 'bg-red-400' : warn ? 'bg-yellow-300' : 'bg-green-400';
  return (
    <span className="inline-flex items-center gap-2 text-xs" data-testid="conn-badge">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {status === 'host' ? 'Hosting' : TEXT[status]}
      {rttMs != null && <span className="opacity-70">{rttMs} ms</span>}
    </span>
  );
}
