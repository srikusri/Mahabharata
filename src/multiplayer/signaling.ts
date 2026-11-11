/**
 * QR-based WebRTC signalling codec.
 *
 * A full pairing is a two-stage exchange: the host shows an OFFER code, the
 * guest scans it and shows an ANSWER code, the host scans that. Scanning the
 * host code alone never completes the connection.
 *
 * Codes are: "MG1." + ("z" deflate | "r" raw) + "." + base64url(JSON).
 * Codes longer than one comfortably scannable QR are split into numbered
 * parts: "MGP.<tag>.<index>.<total>.<chunk>" which the scanner reassembles
 * in any order.
 */

export interface SignalPayload {
  role: 'offer' | 'answer';
  roomId: string;
  /** Slot id linking an answer to the offer it replies to. */
  slot: string;
  sdp: string;
  /** Offer only. */
  hostId?: string;
  hostName?: string;
  /** Answer only: the id the guest will use as senderId. */
  guestId?: string;
}

const PREFIX = 'MG1';
const PART_PREFIX = 'MGP';

/**
 * Drop candidates the other side cannot or should not use, to keep QR codes small:
 * TCP candidates (data channels only need UDP) and IPv6 link-local addresses.
 */
export function slimSdp(sdp: string): string {
  const lines = sdp.split(/\r?\n/).filter((l) => {
    if (!l.startsWith('a=candidate:')) return l.length > 0;
    if (/ tcp /i.test(l)) return false;
    if (/ fe80:/i.test(l)) return false;
    return true;
  });
  return lines.join('\r\n') + '\r\n';
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const hasStreams = () =>
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // Errors surface through the readable side below; swallow the writer-side
  // rejections so a corrupted code is a normal exception, not an unhandled one.
  writer.write(bytes as unknown as BufferSource).catch(() => {});
  writer.close().catch(() => {});
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function encodeSignal(p: SignalPayload): Promise<string> {
  const json = JSON.stringify({ ...p, sdp: slimSdp(p.sdp) });
  const raw = new TextEncoder().encode(json);
  if (hasStreams()) {
    try {
      const z = await pipe(raw, new CompressionStream('deflate'));
      return `${PREFIX}.z.${toBase64Url(z)}`;
    } catch {
      /* fall through to raw */
    }
  }
  return `${PREFIX}.r.${toBase64Url(raw)}`;
}

export async function decodeSignal(code: string): Promise<SignalPayload> {
  const m = /^MG1\.([zr])\.([A-Za-z0-9_-]+)$/.exec(code.trim());
  if (!m) throw new Error('Not a valid pairing code.');
  let bytes = fromBase64Url(m[2]);
  if (m[1] === 'z') {
    if (!hasStreams()) throw new Error('This browser cannot read compressed pairing codes.');
    try {
      bytes = await pipe(bytes, new DecompressionStream('deflate'));
    } catch {
      throw new Error('Pairing code is corrupted or was scanned incompletely. Scan it again.');
    }
  }
  let o: unknown;
  try {
    o = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('Pairing code is corrupted.');
  }
  const s = o as Partial<SignalPayload> | null;
  if (
    !s ||
    (s.role !== 'offer' && s.role !== 'answer') ||
    typeof s.roomId !== 'string' ||
    typeof s.slot !== 'string' ||
    typeof s.sdp !== 'string' ||
    !s.sdp.startsWith('v=0')
  ) {
    throw new Error('Pairing code is incomplete.');
  }
  if (s.role === 'offer' && (typeof s.hostId !== 'string' || typeof s.hostName !== 'string')) {
    throw new Error('Pairing code is incomplete.');
  }
  if (s.role === 'answer' && typeof s.guestId !== 'string') {
    throw new Error('Pairing code is incomplete.');
  }
  return s as SignalPayload;
}

function tagOf(code: string): string {
  let h = 5381;
  for (let i = 0; i < code.length; i++) h = ((h * 33) ^ code.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 5).padStart(5, '0');
}

/** Split a code into QR-sized parts. A short code is returned unchanged (single QR). */
export function splitForQr(code: string, maxLen = 600): string[] {
  if (code.length <= maxLen) return [code];
  const tag = tagOf(code);
  const total = Math.ceil(code.length / maxLen);
  const size = Math.ceil(code.length / total);
  const parts: string[] = [];
  for (let i = 0; i < total; i++) {
    parts.push(`${PART_PREFIX}.${tag}.${i + 1}.${total}.${code.slice(i * size, (i + 1) * size)}`);
  }
  return parts;
}

export interface AssemblerProgress {
  complete: boolean;
  have: number;
  total: number;
  /** Set when complete. */
  code?: string;
  /** Set when the text is not a pairing code at all. */
  ignored?: boolean;
}

/** Collects scanned QR texts (single or multi-part, any order, repeats allowed). */
export class PartAssembler {
  private tag: string | null = null;
  private total = 0;
  private parts = new Map<number, string>();

  reset(): void {
    this.tag = null;
    this.total = 0;
    this.parts.clear();
  }

  add(text: string): AssemblerProgress {
    const t = text.trim();
    if (t.startsWith(`${PREFIX}.`)) {
      this.reset();
      return { complete: true, have: 1, total: 1, code: t };
    }
    const m = /^MGP\.([a-z0-9]{5})\.(\d+)\.(\d+)\.([A-Za-z0-9_.-]+)$/.exec(t);
    if (!m) return { complete: false, have: this.parts.size, total: this.total, ignored: true };
    const [, tag, iStr, nStr, chunk] = m;
    const i = Number(iStr);
    const n = Number(nStr);
    if (n < 2 || n > 20 || i < 1 || i > n) return { complete: false, have: this.parts.size, total: this.total, ignored: true };
    if (this.tag !== tag || this.total !== n) {
      this.reset();
      this.tag = tag;
      this.total = n;
    }
    this.parts.set(i, chunk);
    if (this.parts.size < n) return { complete: false, have: this.parts.size, total: n };
    let code = '';
    for (let k = 1; k <= n; k++) code += this.parts.get(k);
    this.reset();
    return { complete: true, have: n, total: n, code };
  }
}
