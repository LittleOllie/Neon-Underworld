'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WireSpeechSession,
  detectWireSpeechSupport,
  getSpeechRecognitionConstructor,
  resolveSpeechLanguage,
  type WireSpeechSupport,
} from '@local/lib/wire/wire-speech';

export interface UseWireSpeechOptions {
  panelOpen: boolean;
  onFinalTranscript: (transcript: string) => void;
}

export interface UseWireSpeechResult {
  support: WireSpeechSupport;
  listening: boolean;
  interimTranscript: string;
  lastHeard: string | null;
  voiceError: string | null;
  toggleListening: () => void;
  abort: () => void;
}

export function useWireSpeech({ panelOpen, onFinalTranscript }: UseWireSpeechOptions): UseWireSpeechResult {
  const support = useMemo(() => detectWireSpeechSupport(), []);
  const sessionRef = useRef<WireSpeechSession | null>(null);
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const abort = useCallback(() => {
    sessionRef.current?.abort();
    sessionRef.current = null;
    setListening(false);
    setInterimTranscript('');
  }, []);

  useEffect(() => {
    if (!panelOpen) abort();
  }, [panelOpen, abort]);

  useEffect(() => () => abort(), [abort]);

  const toggleListening = useCallback(() => {
    if (support === 'unsupported') return;

    if (sessionRef.current?.isListening) {
      abort();
      return;
    }

    setVoiceError(null);
    setLastHeard(null);
    setInterimTranscript('');

    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;

    const session = new WireSpeechSession({
      createRecognition: () => new Ctor(),
      lang: resolveSpeechLanguage(),
      onInterim: setInterimTranscript,
      onFinal: (transcript) => {
        setLastHeard(transcript);
        setInterimTranscript('');
        sessionRef.current = null;
        setListening(false);
        onFinalRef.current(transcript);
      },
      onError: (message) => {
        setVoiceError(message);
        sessionRef.current = null;
        setListening(false);
        setInterimTranscript('');
      },
      onListeningChange: setListening,
    });

    sessionRef.current = session;
    session.start();
  }, [support, abort]);

  return {
    support,
    listening,
    interimTranscript,
    lastHeard,
    voiceError,
    toggleListening,
    abort,
  };
}
