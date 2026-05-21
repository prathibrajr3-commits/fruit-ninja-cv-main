import { useEffect, useRef, useCallback, useState } from 'react';
import { FruitNinjaEngine } from '../game/engine';
import { useHandTracker } from '../hooks/useHandTracker';

const sliceSound = new Audio('/sounds/slice.wav')

const playSliceSound = () => {
  sliceSound.currentTime = 0
  sliceSound.volume = 1
  sliceSound.play()
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FruitNinjaEngine>(new FruitNinjaEngine());
  const animRef = useRef<number>(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [displayCombo, setDisplayCombo] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'playing' | 'gameOver'>('idle');
  const [finalScore, setFinalScore] = useState(0);
  const [cameraStarted, setCameraStarted] = useState(false);

  const { videoRef, fingerPos, isTracking, state: trackerState, errorMsg, startCamera, stopCamera } = useHandTracker();

  const fingerPosRef = useRef(fingerPos);
  useEffect(() => { fingerPosRef.current = fingerPos; }, [fingerPos]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    engineRef.current.resize(canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  const startGame = useCallback(async () => {
    if (!cameraStarted) {
      setCameraStarted(true);
      await startCamera();
    }
    engineRef.current.startGame();
    setPhase('countdown');
  }, [cameraStarted, startCamera]);

  const restartGame = useCallback(() => {
    engineRef.current.restartGame();
    setPhase('countdown');
  }, []);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const loop = () => {
      if (!running) return;
      animRef.current = requestAnimationFrame(loop);

      const engine = engineRef.current;
      engine.update(fingerPosRef.current);

      const { score, lives, combo, phase: gPhase } = engine.state;
      setDisplayScore(score);
      setDisplayLives(lives);
      setDisplayCombo(combo);
      setPhase(gPhase);
      if (gPhase === 'gameOver') {
        setFinalScore(score);
      }

      engine.render(ctx);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  const hearts = Array.from({ length: 3 }, (_, i) => i < displayLives);

  return (
    <div className="game-root">
      {/* Webcam feed as background */}
      <video
        ref={videoRef}
        id="game-video"
        className="game-video"
        autoPlay
        playsInline
        muted
      />

      {/* Game canvas overlay */}
      <canvas ref={canvasRef} id="fruit-canvas" className="game-canvas" />

      {/* HUD */}
      {(phase === 'playing' || phase === 'countdown') && (
        <div className="hud">
          <div className="hud-score">
            <span className="hud-label">SCORE</span>
            <span className="hud-value">{displayScore}</span>
          </div>
          {displayCombo > 2 && (
            <div className="hud-combo">
              <span>🔥 {displayCombo}x COMBO</span>
            </div>
          )}
          <div className="hud-lives">
            {hearts.map((alive, i) => (
              <span key={i} className={`heart ${alive ? 'alive' : 'dead'}`}>
                {alive ? '❤️' : '🖤'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Idle / start screen */}
      {phase === 'idle' && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="game-title">
              <span className="title-emoji">🍉</span>
              <h1>Fruit Ninja</h1>
              <span className="title-emoji">🍎</span>
            </div>
            <p className="subtitle">Computer Vision Edition</p>
            <div className="feature-list">
              <div className="feature">👁️ Real-time hand tracking via webcam</div>
              <div className="feature">✂️ Trajectory-based slash detection</div>
              <div className="feature">🎯 Line-circle intersection geometry</div>
              <div className="feature">⚡ Dynamic difficulty scaling</div>
            </div>
            <p className="hint">Hold up your index finger to slice fruits</p>
            <p className="hint danger">Avoid <strong>💣 bombs</strong> — they cost a life!</p>
            {trackerState === 'error' && (
              <p className="error-msg">{errorMsg}</p>
            )}
            <button className="btn-start" onClick={startGame} disabled={trackerState === 'loading'}>
              {trackerState === 'loading' ? (
                <span>Loading MediaPipe...</span>
              ) : (
                <span>🎮 Start Game</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Game Over screen */}
      {phase === 'gameOver' && (
        <div className="overlay">
          <div className="overlay-card gameover">
            <h2>Game Over</h2>
            <div className="final-score">
              <span className="final-label">Final Score</span>
              <span className="final-value">{finalScore}</span>
            </div>
            {finalScore >= 20 && <p className="remark">🔥 Blade Master!</p>}
            {finalScore >= 10 && finalScore < 20 && <p className="remark">⚡ Nice slicing!</p>}
            {finalScore < 10 && <p className="remark">🌱 Keep practicing!</p>}
            <button className="btn-start" onClick={restartGame}>
              🔄 Play Again
            </button>
          </div>
        </div>
      )}

      {/* Camera not active warning */}
      {phase === 'playing' && !isTracking && (
        <div className="no-camera-banner">
          📷 Camera not active — your hand won't be tracked
        </div>
      )}

      {/* Finger dot indicator */}
      {fingerPos && phase === 'playing' && (
        <div
          className="finger-dot"
          style={{ left: fingerPos.x, top: fingerPos.y }}
        />
      )}
    </div>
  );
}
