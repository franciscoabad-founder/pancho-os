// useVoiceDictation: hook para dictado por voz directo en el navegador
// usando Web Speech API (SpeechRecognition / webkitSpeechRecognition).
//
// Soporta transcripcion en tiempo real en espanol (es-EC / es-419) sin
// dependencias externas ni consumo de tokens de audio.

import { useCallback, useEffect, useRef, useState } from 'react';

// Tipos para Web Speech API no incluidos en todos los tsconfig estandares
interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface UseVoiceDictationOptions {
  lang?: string;
  continuous?: boolean;
  onResult?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceDictation(options: UseVoiceDictationOptions = {}) {
  const { lang = 'es-EC', continuous = false, onResult, onError } = options;
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as IWindowWithSpeech;
    const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    setIsSupported(Boolean(SpeechClass));

    if (SpeechClass) {
      const recognition = new SpeechClass();
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript.trim()) {
          onResult?.(finalTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        const errorMsg = event.error === 'not-allowed'
          ? 'Permiso de microfono denegado.'
          : event.error === 'no-speech'
          ? 'No se detecto voz.'
          : `Error de audio: ${event.error}`;
        setError(errorMsg);
        setIsListening(false);
        onError?.(errorMsg);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [lang, continuous, onResult, onError]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    try {
      recognitionRef.current.start();
    } catch {
      // Si ya estaba corriendo, reiniciar
      try {
        recognitionRef.current.stop();
        setTimeout(() => recognitionRef.current?.start(), 100);
      } catch {
        // ignore
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
