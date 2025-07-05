import { useRef, useCallback, useEffect, useState } from 'react';
import { Chess } from 'chess.js';

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
        // Create a robust chess engine with proper move validation
        engineRef.current = {
          postMessage: (message: string) => {
            if (message === 'uci') {
              setTimeout(() => {
                if (engineRef.current?.onmessage) {
                  engineRef.current.onmessage({ data: 'id name Eusha Chess Engine v2.0' });
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
                const move = generateValidMove(message);
                if (engineRef.current?.onmessage && move) {
                  engineRef.current.onmessage({ data: `bestmove ${move}` });
                } else if (engineRef.current?.onmessage) {
                  engineRef.current.onmessage({ data: 'bestmove (none)' });
                }
              }, Math.random() * 1000 + 800); // 0.8-1.8 second delay for realistic thinking
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

    const generateValidMove = (positionMessage: string): string | null => {
      try {
        // Extract FEN from position message
        const fenMatch = positionMessage.match(/position fen (.+?)(?:\s+moves|$)/);
        if (!fenMatch) return null;

        const fen = fenMatch[1];
        const game = new Chess(fen);

        // Get all legal moves
        const legalMoves = game.moves({ verbose: true });
        
        if (legalMoves.length === 0) {
          return null; // No legal moves (checkmate or stalemate)
        }

        // Prioritize moves based on chess principles
        const prioritizedMoves = prioritizeMoves(legalMoves, game);
        
        // Select move with some randomness for variety
        const randomIndex = Math.floor(Math.random() * Math.min(3, prioritizedMoves.length));
        const selectedMove = prioritizedMoves[randomIndex];
        
        return selectedMove.from + selectedMove.to + (selectedMove.promotion || '');
      } catch (error) {
        console.error('Error generating move:', error);
        return null;
      }
    };

    const prioritizeMoves = (moves: any[], game: Chess) => {
      // Score moves based on chess principles
      const scoredMoves = moves.map(move => {
        let score = Math.random() * 10; // Base randomness
        
        // Prioritize captures
        if (move.captured) {
          score += 50;
          // Higher value captures get more points
          const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
          score += pieceValues[move.captured] * 10;
        }
        
        // Prioritize checks
        const tempGame = new Chess(game.fen());
        tempGame.move(move);
        if (tempGame.isCheck()) {
          score += 30;
        }
        
        // Prioritize center control
        const centerSquares = ['d4', 'd5', 'e4', 'e5'];
        if (centerSquares.includes(move.to)) {
          score += 20;
        }
        
        // Prioritize piece development in opening
        const moveCount = game.history().length;
        if (moveCount < 20) {
          if (move.piece === 'n' || move.piece === 'b') {
            score += 25;
          }
          // Avoid moving same piece twice in opening
          const history = game.history({ verbose: true });
          const lastMoves = history.slice(-4);
          if (lastMoves.some(m => m.piece === move.piece && m.from === move.from)) {
            score -= 15;
          }
        }
        
        // Avoid hanging pieces
        tempGame.move(move);
        const opponentMoves = tempGame.moves({ verbose: true });
        const isHanging = opponentMoves.some(oppMove => 
          oppMove.to === move.to && oppMove.captured === move.piece
        );
        if (isHanging) {
          score -= 40;
        }
        
        return { ...move, score };
      });
      
      // Sort by score (highest first) and return
      return scoredMoves.sort((a, b) => b.score - a.score);
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
    }, 5000); // Increased timeout

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