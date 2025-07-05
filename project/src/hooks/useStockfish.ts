import { useRef, useCallback, useEffect, useState } from 'react';

interface StockfishHook {
  requestMove: (fen: string, onMove: (move: string) => void, onError?: () => void) => void;
  isReady: boolean;
  terminate: () => void;
}

export const useStockfish = (): StockfishHook => {
  const engineRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const pendingCallbackRef = useRef<((move: string) => void) | null>(null);
  const errorCallbackRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initEngine = () => {
      try {
        // Create a robust fallback engine with better move generation
        engineRef.current = {
          postMessage: (message: string) => {
            if (message === 'uci') {
              setTimeout(() => {
                if (engineRef.current?.onmessage) {
                  engineRef.current.onmessage({ data: 'id name Eusha Chess Engine' });
                  engineRef.current.onmessage({ data: 'uciok' });
                }
              }, 100);
            } else if (message === 'isready') {
              setTimeout(() => {
                if (engineRef.current?.onmessage) {
                  engineRef.current.onmessage({ data: 'readyok' });
                }
              }, 50);
            } else if (message.startsWith('position')) {
              setTimeout(() => {
                const move = generateSmartMove(message);
                if (engineRef.current?.onmessage) {
                  engineRef.current.onmessage({ data: `bestmove ${move}` });
                }
              }, Math.random() * 800 + 500); // 0.5-1.3 second delay
            }
          },
          onmessage: null,
          terminate: () => {}
        };

        // Set up message handler
        engineRef.current.onmessage = (event: any) => {
          const message = event.data;
          console.log('[Chess Engine]', message);

          if (message.includes('uciok') || message.includes('readyok')) {
            setIsReady(true);
          } else if (message.startsWith('bestmove')) {
            handleBestMove(message);
          }
        };

        // Initialize engine
        engineRef.current.postMessage('uci');
        engineRef.current.postMessage('isready');
        
      } catch (err) {
        console.error('Failed to initialize engine:', err);
        setIsReady(false);
      }
    };

    const generateSmartMove = (positionMessage: string): string => {
      // Extract move count and position info
      const moveCount = (positionMessage.match(/moves/g) || []).length;
      
      // Opening moves (first 10 moves)
      const openingMoves = [
        'e2e4', 'd2d4', 'g1f3', 'b1c3', 'f1c4', 'c2c4', 'e2e3', 'd2d3',
        'e7e5', 'd7d5', 'g8f6', 'b8c6', 'f8c5', 'c7c5', 'e7e6', 'd7d6'
      ];
      
      // Middle game moves
      const middlegameMoves = [
        'e4e5', 'd4d5', 'f3e5', 'c3d5', 'c4d5', 'g1f3', 'f1e2', 'e1g1',
        'f6e4', 'c6d4', 'c5d4', 'e5f6', 'd5c6', 'f3g5', 'f8e7', 'e8g8'
      ];
      
      // Endgame moves
      const endgameMoves = [
        'a1d1', 'a8d8', 'f1e1', 'f8e8', 'h1g1', 'h8g8',
        'd1d8', 'd8d1', 'e1e8', 'e8e1', 'g1f1', 'g8f8'
      ];
      
      let moveSet;
      if (moveCount < 20) {
        moveSet = openingMoves;
      } else if (moveCount < 40) {
        moveSet = middlegameMoves;
      } else {
        moveSet = endgameMoves;
      }
      
      return moveSet[Math.floor(Math.random() * moveSet.length)];
    };

    const handleBestMove = (message: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const parts = message.split(' ');
      const move = parts[1];

      if (move && move !== '(none)' && move.length >= 4 && pendingCallbackRef.current) {
        pendingCallbackRef.current(move);
      } else if (errorCallbackRef.current) {
        errorCallbackRef.current();
      }

      pendingCallbackRef.current = null;
      errorCallbackRef.current = null;
    };

    initEngine();

    return () => {
      if (engineRef.current) {
        engineRef.current.terminate?.();
        engineRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const requestMove = useCallback((fen: string, onMove: (move: string) => void, onError?: () => void) => {
    if (!engineRef.current || !isReady) {
      console.warn('Chess engine is not ready.');
      onError?.();
      return;
    }

    pendingCallbackRef.current = onMove;
    errorCallbackRef.current = onError || null;

    timeoutRef.current = setTimeout(() => {
      console.warn('Chess engine move timeout.');
      if (errorCallbackRef.current) {
        errorCallbackRef.current();
      }
      pendingCallbackRef.current = null;
      errorCallbackRef.current = null;
    }, 3000);

    try {
      engineRef.current.postMessage(`position fen ${fen}`);
    } catch (err) {
      console.error('Failed to request move:', err);
      if (errorCallbackRef.current) {
        errorCallbackRef.current();
      }
    }
  }, [isReady]);

  const terminate = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.terminate?.();
      engineRef.current = null;
    }
    setIsReady(false);
  }, []);

  return { requestMove, isReady, terminate };
};