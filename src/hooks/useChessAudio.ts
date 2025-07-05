import { useRef, useCallback } from 'react';

interface ChessAudioHook {
  playMoveSound: () => void;
  playCaptureSound: () => void;
  playCheckSound: () => void;
  playGameEndSound: () => void;
  speakMessage: (message: string, gender: 'male' | 'female') => void;
  stopSpeaking: () => void;
}

export const useChessAudio = (): ChessAudioHook => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const createTone = useCallback((frequency: number, duration: number, volume: number = 0.08) => {
    try {
      const audioContext = initAudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  }, [initAudioContext]);

  const playMoveSound = useCallback(() => {
    // Subtle, natural move sound
    createTone(600, 0.08, 0.06);
  }, [createTone]);

  const playCaptureSound = useCallback(() => {
    // Slightly more pronounced for captures
    createTone(800, 0.12, 0.08);
    setTimeout(() => createTone(400, 0.08, 0.05), 60);
  }, [createTone]);

  const playCheckSound = useCallback(() => {
    // Alert but not jarring
    createTone(1000, 0.15, 0.1);
  }, [createTone]);

  const playGameEndSound = useCallback(() => {
    // Pleasant ending sound
    createTone(523, 0.2, 0.08); // C
    setTimeout(() => createTone(659, 0.2, 0.08), 120); // E
    setTimeout(() => createTone(784, 0.3, 0.1), 240); // G
  }, [createTone]);

  const speakMessage = useCallback((message: string, gender: 'male' | 'female') => {
    if ('speechSynthesis' in window) {
      // Stop any ongoing speech
      window.speechSynthesis.cancel();

      // Wait for voices to load
      const speak = () => {
        const utterance = new SpeechSynthesisUtterance(message);
        
        // Get available voices
        const voices = window.speechSynthesis.getVoices();
        
        if (gender === 'male') {
          // Find a suitable male voice
          const maleVoice = voices.find(voice => 
            voice.name.toLowerCase().includes('male') ||
            voice.name.toLowerCase().includes('david') ||
            voice.name.toLowerCase().includes('mark') ||
            voice.name.toLowerCase().includes('alex') ||
            voice.name.toLowerCase().includes('daniel') ||
            voice.name.toLowerCase().includes('thomas') ||
            (voice.gender && voice.gender.toLowerCase() === 'male')
          );
          
          if (maleVoice) {
            utterance.voice = maleVoice;
          }
          
          utterance.pitch = 0.85; // Slightly lower pitch
          utterance.rate = 1.0; // Normal speed
          utterance.volume = 0.7;
        } else {
          // Find a suitable female voice
          const femaleVoice = voices.find(voice => 
            voice.name.toLowerCase().includes('female') ||
            voice.name.toLowerCase().includes('samantha') ||
            voice.name.toLowerCase().includes('victoria') ||
            voice.name.toLowerCase().includes('karen') ||
            voice.name.toLowerCase().includes('susan') ||
            voice.name.toLowerCase().includes('anna') ||
            voice.name.toLowerCase().includes('emma') ||
            (voice.gender && voice.gender.toLowerCase() === 'female')
          );
          
          if (femaleVoice) {
            utterance.voice = femaleVoice;
          }
          
          utterance.pitch = 1.1; // Slightly higher pitch
          utterance.rate = 0.95; // Slightly slower for warmth
          utterance.volume = 0.6;
        }

        // Make speech more natural
        utterance.rate = Math.max(0.8, Math.min(1.2, utterance.rate + (Math.random() - 0.5) * 0.1));
        utterance.pitch = Math.max(0.5, Math.min(2, utterance.pitch + (Math.random() - 0.5) * 0.1));

        speechSynthesisRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      };

      // Check if voices are loaded
      if (window.speechSynthesis.getVoices().length > 0) {
        speak();
      } else {
        // Wait for voices to load
        window.speechSynthesis.addEventListener('voiceschanged', speak, { once: true });
      }
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return {
    playMoveSound,
    playCaptureSound,
    playCheckSound,
    playGameEndSound,
    speakMessage,
    stopSpeaking
  };
};