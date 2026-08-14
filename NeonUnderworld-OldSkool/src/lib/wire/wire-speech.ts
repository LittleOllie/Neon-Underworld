/** Client-only Web Speech API helpers — safe to import from client components; do not call detect during SSR. */

export type WireSpeechSupport = 'supported' | 'unsupported';

export type WireSpeechErrorCode =
  | 'not-allowed'
  | 'service-not-allowed'
  | 'no-speech'
  | 'network'
  | 'aborted'
  | 'audio-capture'
  | 'language-not-supported'
  | 'bad-grammar'
  | string;

export interface WireSpeechResultAlternative {
  transcript: string;
}

export interface WireSpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: WireSpeechResultAlternative;
}

export interface WireSpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<WireSpeechResult>;
}

export interface WireSpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: WireSpeechResultEvent) => void) | null;
  onerror: ((event: { error: WireSpeechErrorCode }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type WireSpeechRecognitionConstructor = new () => WireSpeechRecognitionLike;

type WindowWithSpeech = Window & {
  SpeechRecognition?: WireSpeechRecognitionConstructor;
  webkitSpeechRecognition?: WireSpeechRecognitionConstructor;
};

export function getSpeechRecognitionConstructor(
  win?: WindowWithSpeech,
): WireSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined' && !win) return null;
  const target = win ?? (window as WindowWithSpeech);
  return target.SpeechRecognition ?? target.webkitSpeechRecognition ?? null;
}

export function detectWireSpeechSupport(win?: WindowWithSpeech): WireSpeechSupport {
  return getSpeechRecognitionConstructor(win) ? 'supported' : 'unsupported';
}

/** Prefer player locale when English; otherwise default to en-AU for NU. */
export function resolveSpeechLanguage(navigatorLike?: Navigator): string {
  const lang = navigatorLike?.language?.trim();
  if (lang && lang.toLowerCase().startsWith('en')) return lang;
  return 'en-AU';
}

export function mapSpeechRecognitionError(error: WireSpeechErrorCode): string | null {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'MICROPHONE ACCESS DENIED';
    case 'no-speech':
      return 'NO COMMAND HEARD';
    case 'network':
      return 'VOICE CONNECTION FAILED';
    case 'aborted':
      return null;
    case 'audio-capture':
      return 'VOICE CONNECTION FAILED';
    case 'language-not-supported':
      return 'VOICE UNAVAILABLE';
    default:
      return 'VOICE CONNECTION FAILED';
  }
}

export interface ParsedSpeechResults {
  interim: string;
  final: string;
}

export function parseSpeechResultEvent(event: WireSpeechResultEvent): ParsedSpeechResults {
  let interim = '';
  let final = '';
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results[i];
    if (!result) continue;
    const chunk = result[0]?.transcript ?? '';
    if (result.isFinal) final += chunk;
    else interim += chunk;
  }
  return { interim: interim.trim(), final: final.trim() };
}

export interface WireSpeechSessionOptions {
  createRecognition: () => WireSpeechRecognitionLike;
  onInterim?: (transcript: string) => void;
  onFinal: (transcript: string) => void;
  onError: (message: string) => void;
  onListeningChange?: (listening: boolean) => void;
  lang?: string;
}

/** Imperative speech session — testable without React. */
export class WireSpeechSession {
  private recognition: WireSpeechRecognitionLike | null = null;
  private finalHandled = false;
  private aborted = false;

  constructor(private readonly options: WireSpeechSessionOptions) {}

  get isListening(): boolean {
    return this.recognition != null;
  }

  start(): void {
    if (this.recognition) return;

    this.finalHandled = false;
    this.aborted = false;

    const recognition = this.options.createRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = this.options.lang ?? resolveSpeechLanguage();

    recognition.onresult = (event) => {
      const { interim, final } = parseSpeechResultEvent(event);
      if (interim) this.options.onInterim?.(interim);
      if (final && !this.finalHandled) {
        this.finalHandled = true;
        this.options.onListeningChange?.(false);
        recognition.stop();
        if (!final.trim()) {
          this.options.onError('NO COMMAND HEARD');
          return;
        }
        this.options.onFinal(final.trim());
      }
    };

    recognition.onerror = (event) => {
      if (this.aborted) return;
      this.aborted = true;
      const message = mapSpeechRecognitionError(event.error);
      if (message) this.options.onError(message);
      this.cleanup(false);
    };

    recognition.onend = () => {
      if (this.aborted) {
        this.cleanup(false);
        return;
      }
      if (!this.finalHandled) {
        this.options.onError('NO COMMAND HEARD');
      }
      this.cleanup(false);
    };

    try {
      recognition.start();
      this.recognition = recognition;
      this.options.onListeningChange?.(true);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[THE WIRE] speech start failed', err);
      }
      this.options.onError('VOICE CONNECTION FAILED');
      this.cleanup(false);
    }
  }

  stop(): void {
    this.recognition?.stop();
  }

  abort(): void {
    this.aborted = true;
    this.recognition?.abort();
    this.cleanup(false);
  }

  private cleanup(notify: boolean): void {
    this.recognition = null;
    if (notify) this.options.onListeningChange?.(false);
    else this.options.onListeningChange?.(false);
  }
}
