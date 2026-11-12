import { describe, expect, it } from 'vitest';
import { PartAssembler, splitForQr, extractCode, inviteLink, parseInviteHash } from './signaling';

const CODE = 'MG1.z.abcDEF_-123';

describe('invite links', () => {
  it('round-trips a code through a link hash', () => {
    const link = inviteLink(CODE, 'https://x.github.io/Mahabharata/#old');
    expect(link).toBe(`https://x.github.io/Mahabharata/#join=${CODE}`);
    expect(parseInviteHash(new URL(link).hash)).toBe(CODE);
  });
  it('ignores unrelated hashes', () => {
    expect(parseInviteHash('#board-preview')).toBeNull();
    expect(parseInviteHash('#join=garbage')).toBeNull();
  });
  it('finds a code inside a chat message or link', () => {
    expect(extractCode(`Hi! My reply code:\n${CODE}\nthanks`)).toBe(CODE);
    expect(extractCode(`https://a.b/#join=${CODE}`)).toBe(CODE);
    expect(extractCode('nothing here')).toBeNull();
  });
  it('a QR part that contains a code prefix is not mistaken for a whole code', () => {
    const parts = splitForQr('MG1.z.' + 'A'.repeat(1500), 600);
    const a = new PartAssembler();
    const r = a.add(parts[0]);
    expect(r.complete).toBe(false);
    for (const p of parts) var last = a.add(p);
    expect(last!.complete).toBe(true);
    expect(last!.code).toBe('MG1.z.' + 'A'.repeat(1500));
  });
  it('the assembler accepts a pasted message', () => {
    const r = new PartAssembler().add(`my code: ${CODE} ok`);
    expect(r.complete).toBe(true);
    expect(r.code).toBe(CODE);
  });
});
