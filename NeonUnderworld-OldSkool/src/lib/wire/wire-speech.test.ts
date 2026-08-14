import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WireSpeechSession,
  detectWireSpeechSupport,
  getSpeechRecognitionConstructor,
  mapSpeechRecognitionError,
  parseSpeechResultEvent,
  resolveSpeechLanguage,
  type WireSpeechRecognitionLike,
  type WireSpeechResultEvent,
} from './wire-speech';

function createMockRecognition(): WireSpeechRecognitionLike & {
  emitResult: (event: WireSpeechResultEvent) => void;
  emitError: (error: string) => void;
  emitEnd: () => void;
} {
  const rec = {
    continuous: false,
    interimResults: true,
    lang: 'en-AU',
    onresult: null as WireSpeechRecognitionLike['onresult'],
    onerror: null as WireSpeechRecognitionLike['onerror'],
    onend: null as WireSpeechRecognitionLike['onend'],
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    emitResult(event: WireSpeechResultEvent) {
      rec.onresult?.(event);
    },
    emitError(error: string) {
      rec.onerror?.({ error });
    },
    emitEnd() {
      rec.onend?.();
    },
  };
  return rec;
}

function finalEvent(transcript: string): WireSpeechResultEvent {
  return {
    resultIndex: 0,
    results: [{ isFinal: true, length: 1, 0: { transcript } }],
  };
}

function interimEvent(transcript: string): WireSpeechResultEvent {
  return {
    resultIndex: 0,
    results: [{ isFinal: false, length: 1, 0: { transcript } }],
  };
}

describe('detectWireSpeechSupport', () => {
  it('returns unsupported when SpeechRecognition is missing', () => {
    expect(detectWireSpeechSupport({} as Window)).toBe('unsupported');
  });

  it('returns supported when SpeechRecognition exists', () => {
    class MockRecognition {}
    const win = { SpeechRecognition: MockRecognition } as unknown as Window;
    expect(detectWireSpeechSupport(win)).toBe('supported');
  });

  it('returns supported for webkitSpeechRecognition', () => {
    class MockRecognition {}
    const win = { webkitSpeechRecognition: MockRecognition } as unknown as Window;
    expect(getSpeechRecognitionConstructor(win)).toBe(MockRecognition);
  });
});

describe('resolveSpeechLanguage', () => {
  it('uses English browser locale when available', () => {
    expect(resolveSpeechLanguage({ language: 'en-GB' } as Navigator)).toBe('en-GB');
  });

  it('falls back to en-AU for non-English locales', () => {
    expect(resolveSpeechLanguage({ language: 'fr-FR' } as Navigator)).toBe('en-AU');
  });
});

describe('mapSpeechRecognitionError', () => {
  it('maps permission errors', () => {
    expect(mapSpeechRecognitionError('not-allowed')).toBe('MICROPHONE ACCESS DENIED');
  });

  it('maps no-speech', () => {
    expect(mapSpeechRecognitionError('no-speech')).toBe('NO COMMAND HEARD');
  });

  it('ignores aborted', () => {
    expect(mapSpeechRecognitionError('aborted')).toBeNull();
  });
});

describe('parseSpeechResultEvent', () => {
  it('separates interim and final transcripts', () => {
    expect(parseSpeechResultEvent(interimEvent('buy max'))).toEqual({
      interim: 'buy max',
      final: '',
    });
    expect(parseSpeechResultEvent(finalEvent('buy 10 aks'))).toEqual({
      interim: '',
      final: 'buy 10 aks',
    });
  });
});

describe('WireSpeechSession', () => {
  let recognition: ReturnType<typeof createMockRecognition>;
  let onFinal: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;
  let onInterim: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    recognition = createMockRecognition();
    onFinal = vi.fn();
    onError = vi.fn();
    onInterim = vi.fn();
  });

  function createSession() {
    return new WireSpeechSession({
      createRecognition: () => recognition,
      onFinal,
      onError,
      onInterim,
      onListeningChange: vi.fn(),
    });
  }

  it('forwards final transcript once', () => {
    const session = createSession();
    session.start();
    recognition.emitResult(finalEvent('buy maximum aks'));
    expect(onFinal).toHaveBeenCalledOnce();
    expect(onFinal).toHaveBeenCalledWith('buy maximum aks');
    expect(onInterim).not.toHaveBeenCalled();
  });

  it('does not execute on interim results alone', () => {
    const session = createSession();
    session.start();
    recognition.emitResult(interimEvent('buy max'));
    expect(onFinal).not.toHaveBeenCalled();
    expect(onInterim).toHaveBeenCalledWith('buy max');
  });

  it('maps permission denied to friendly error', () => {
    const session = createSession();
    session.start();
    recognition.emitError('not-allowed');
    expect(onError).toHaveBeenCalledWith('MICROPHONE ACCESS DENIED');
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('maps no-speech on end when nothing final', () => {
    const session = createSession();
    session.start();
    recognition.emitEnd();
    expect(onError).toHaveBeenCalledWith('NO COMMAND HEARD');
  });

  it('aborts without error when panel closes', () => {
    const session = createSession();
    session.start();
    session.abort();
    recognition.emitError('aborted');
    recognition.emitEnd();
    expect(onError).not.toHaveBeenCalled();
    expect(onFinal).not.toHaveBeenCalled();
  });

  it('does not double-forward duplicate final events', () => {
    const session = createSession();
    session.start();
    recognition.emitResult(finalEvent('buy 10 aks'));
    recognition.emitResult(finalEvent('buy 10 aks'));
    expect(onFinal).toHaveBeenCalledOnce();
  });
});
