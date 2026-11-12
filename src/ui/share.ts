export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Opens the phone's share sheet (WhatsApp, Messages, ...) and falls back to copying the text. */
export async function shareOrCopy(opts: { title: string; text: string; url?: string }): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(opts);
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(opts.url ?? opts.text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
