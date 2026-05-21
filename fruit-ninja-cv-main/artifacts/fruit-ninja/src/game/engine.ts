import {
  Vec2,
  Fruit,
  FruitType,
  SliceEffect,
  TrailPoint,
  ScorePopup,
  GameState,
  Particle,
  FRUIT_COLORS,
} from './types';

const sliceSound = new Audio('/sounds/slice.wav')

const playSliceSound = () => {
  sliceSound.currentTime = 0
  sliceSound.volume = 1
  sliceSound.play()
}

const GRAVITY = 0.35;
const TRAIL_MAX_AGE = 18;
const TRAIL_MAX_LEN = 24;
const SLICE_EFFECT_DURATION = 55;
const SCORE_POPUP_DURATION = 50;
const COMBO_WINDOW = 90; // frames

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function linecircleIntersect(p1: Vec2, p2: Vec2, c: Vec2, r: number): boolean {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const fx = p1.x - c.x;
  const fy = p1.y - c.y;
  const a = dx * dx + dy * dy;
  if (a === 0) return false;
  const b = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - r * r;
  let discriminant = b * b - 4 * a * cc;
  if (discriminant < 0) return false;
  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

const FRUIT_TYPES: FruitType[] = ['apple', 'orange', 'watermelon', 'lemon', 'strawberry', 'peach'];

export class FruitNinjaEngine {
  private fruits: Fruit[] = [];
  private sliceEffects: SliceEffect[] = [];
  private trail: TrailPoint[] = [];
  private scorePopups: ScorePopup[] = [];
  state: GameState = {
    score: 0,
    lives: 3,
    phase: 'idle',
    difficulty: 1,
    combo: 0,
    comboTimer: 0,
    totalTime: 0,
  };

  private nextId = 0;
  private spawnTimer = 0;
  private spawnInterval = 90;
  private canvasW = 800;
  private canvasH = 600;
  private prevFingerPos: Vec2 | null = null;

  private countdownTimer = 0;
  countdownValue = 3;

  resize(w: number, h: number) {
    this.canvasW = w;
    this.canvasH = h;
  }

  startGame() {
    this.fruits = [];
    this.sliceEffects = [];
    this.trail = [];
    this.scorePopups = [];
    this.state = {
      score: 0,
      lives: 3,
      phase: 'countdown',
      difficulty: 1,
      combo: 0,
      comboTimer: 0,
      totalTime: 0,
    };
    this.countdownValue = 3;
    this.countdownTimer = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 90;
    this.nextId = 0;
    this.prevFingerPos = null;
  }

  restartGame() {
    this.startGame();
  }

  update(fingerPos: Vec2 | null) {
    if (this.state.phase === 'idle' || this.state.phase === 'gameOver') {
      this.updateEffectsOnly();
      return;
    }

    if (this.state.phase === 'countdown') {
      this.countdownTimer++;
      if (this.countdownTimer >= 60) {
        this.countdownTimer = 0;
        this.countdownValue--;
        if (this.countdownValue <= 0) {
          this.state.phase = 'playing';
        }
      }
      return;
    }

    this.state.totalTime++;

    // Increase difficulty every 30 seconds
    this.state.difficulty = 1 + Math.floor(this.state.totalTime / 1800) * 0.3;
    this.spawnInterval = Math.max(30, 90 - this.state.totalTime / 60);

    // Combo decay
    if (this.state.comboTimer > 0) {
      this.state.comboTimer--;
      if (this.state.comboTimer <= 0) {
        this.state.combo = 0;
      }
    }

    // Spawn fruits
    this.spawnTimer++;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      const count = Math.random() < 0.3 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        this.spawnFruit();
      }
    }

    // Update fruits
    for (const fruit of this.fruits) {
      if (fruit.sliced || fruit.offScreen) continue;
      fruit.vel.y += GRAVITY;
      fruit.pos.x += fruit.vel.x;
      fruit.pos.y += fruit.vel.y;
      fruit.rotation += fruit.angularVel;

      if (fruit.pos.y > this.canvasH + fruit.radius * 2) {
        fruit.offScreen = true;
        if (!fruit.sliced && fruit.type !== 'bomb') {
          fruit.missed = true;
          this.state.lives--;
          this.state.combo = 0;
          this.state.comboTimer = 0;
          if (this.state.lives <= 0) {
            this.state.lives = 0;
            this.state.phase = 'gameOver';
          }
        }
      }
    }
    this.fruits = this.fruits.filter(f => !f.offScreen);

    // Update trail
    if (fingerPos) {
      this.trail.push({ x: fingerPos.x, y: fingerPos.y, age: 0, maxAge: TRAIL_MAX_AGE });
      if (this.trail.length > TRAIL_MAX_LEN) this.trail.shift();
    }
    for (const pt of this.trail) pt.age++;
    this.trail = this.trail.filter(pt => pt.age < pt.maxAge);

    // Slash detection
    if (fingerPos && this.prevFingerPos) {
      const speed = Math.hypot(fingerPos.x - this.prevFingerPos.x, fingerPos.y - this.prevFingerPos.y);
      if (speed > 8) {
        for (const fruit of this.fruits) {
          if (fruit.sliced) continue;
          if (linecircleIntersect(this.prevFingerPos, fingerPos, fruit.pos, fruit.radius * 0.85)) {
            this.sliceFruit(fruit, this.prevFingerPos, fingerPos);
          }
        }
      }
    }
    this.prevFingerPos = fingerPos ? { ...fingerPos } : null;

    // Update slice effects
    for (const effect of this.sliceEffects) {
      effect.age++;
      effect.left.vel.y += GRAVITY * 0.5;
      effect.left.pos.x += effect.left.vel.x;
      effect.left.pos.y += effect.left.vel.y;
      effect.left.rotation += effect.left.angularVel;
      effect.right.vel.y += GRAVITY * 0.5;
      effect.right.pos.x += effect.right.vel.x;
      effect.right.pos.y += effect.right.vel.y;
      effect.right.rotation += effect.right.angularVel;
      for (const p of effect.particles) {
        p.age++;
        p.vel.y += GRAVITY * 0.3;
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        p.alpha = 1 - p.age / p.maxAge;
      }
      effect.particles = effect.particles.filter(p => p.age < p.maxAge);
    }
    this.sliceEffects = this.sliceEffects.filter(e => e.age < e.maxAge);

    // Update score popups
    for (const sp of this.scorePopups) sp.age++;
    this.scorePopups = this.scorePopups.filter(sp => sp.age < sp.maxAge);
  }

  private updateEffectsOnly() {
    for (const effect of this.sliceEffects) {
      effect.age++;
      for (const p of effect.particles) { p.age++; p.alpha = 1 - p.age / p.maxAge; }
      effect.particles = effect.particles.filter(p => p.age < p.maxAge);
    }
    this.sliceEffects = this.sliceEffects.filter(e => e.age < e.maxAge);
    for (const sp of this.scorePopups) sp.age++;
    this.scorePopups = this.scorePopups.filter(sp => sp.age < sp.maxAge);
    for (const pt of this.trail) pt.age++;
    this.trail = this.trail.filter(pt => pt.age < pt.maxAge);
  }

  private spawnFruit() {
    const x = rand(this.canvasW * 0.15, this.canvasW * 0.85);
    const baseVy = rand(-18, -13) * (1 + (this.state.difficulty - 1) * 0.15);
    const vx = rand(-3, 3);
    const isBomb = Math.random() < 0.07;
    const type: FruitType = isBomb ? 'bomb' : FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
    const radius = type === 'watermelon' ? 52 : type === 'bomb' ? 36 : rand(32, 44);

    this.fruits.push({
      id: this.nextId++,
      type,
      pos: { x, y: this.canvasH + radius },
      vel: { x: vx, y: baseVy },
      radius,
      rotation: rand(0, Math.PI * 2),
      angularVel: rand(-0.08, 0.08),
      sliced: false,
      missed: false,
      offScreen: false,
    });
  }

  private sliceFruit(fruit: Fruit, p1: Vec2, p2: Vec2) {
    playSliceSound()
    fruit.sliced = true;

    if (fruit.type === 'bomb') {
      this.state.lives = Math.max(0, this.state.lives - 1);
      this.state.combo = 0;
      this.state.comboTimer = 0;
      if (this.state.lives <= 0) this.state.phase = 'gameOver';
      this.spawnBombEffect(fruit);
      return;
    }

    this.state.combo++;
    this.state.comboTimer = COMBO_WINDOW;
    const comboBonus = this.state.combo > 2 ? this.state.combo : 1;
    const points = comboBonus;
    this.state.score += points;

    const colors = FRUIT_COLORS[fruit.type];
    const sliceAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const perpAngle = sliceAngle + Math.PI / 2;

    const effect: SliceEffect = {
      id: this.nextId++,
      type: fruit.type,
      left: {
        pos: { x: fruit.pos.x, y: fruit.pos.y },
        vel: { x: Math.cos(perpAngle) * 3 + fruit.vel.x * 0.4, y: Math.sin(perpAngle) * 3 + fruit.vel.y * 0.4 },
        rotation: fruit.rotation,
        angularVel: -0.12,
        side: 'left',
      },
      right: {
        pos: { x: fruit.pos.x, y: fruit.pos.y },
        vel: { x: -Math.cos(perpAngle) * 3 + fruit.vel.x * 0.4, y: -Math.sin(perpAngle) * 3 + fruit.vel.y * 0.4 },
        rotation: fruit.rotation,
        angularVel: 0.12,
        side: 'right',
      },
      particles: this.createJuiceParticles(fruit.pos, colors.juice),
      age: 0,
      maxAge: SLICE_EFFECT_DURATION,
    };
    this.sliceEffects.push(effect);

    const popupColor = this.state.combo > 2 ? '#f9c74f' : '#ffffff';
    const popupText = this.state.combo > 2 ? `${points} x${this.state.combo} COMBO!` : `+${points}`;
    this.scorePopups.push({
      id: this.nextId++,
      x: fruit.pos.x,
      y: fruit.pos.y,
      text: popupText,
      color: popupColor,
      age: 0,
      maxAge: SCORE_POPUP_DURATION,
    });
  }

  private spawnBombEffect(fruit: Fruit) {
    const effect: SliceEffect = {
      id: this.nextId++,
      type: 'bomb',
      left: {
        pos: { ...fruit.pos },
        vel: { x: -4, y: -6 },
        rotation: fruit.rotation,
        angularVel: -0.2,
        side: 'left',
      },
      right: {
        pos: { ...fruit.pos },
        vel: { x: 4, y: -6 },
        rotation: fruit.rotation,
        angularVel: 0.2,
        side: 'right',
      },
      particles: this.createBombParticles(fruit.pos),
      age: 0,
      maxAge: SLICE_EFFECT_DURATION,
    };
    this.sliceEffects.push(effect);
    this.scorePopups.push({
      id: this.nextId++,
      x: fruit.pos.x,
      y: fruit.pos.y - 20,
      text: '💥 BOMB!',
      color: '#ff6b6b',
      age: 0,
      maxAge: SCORE_POPUP_DURATION,
    });
  }

  private createJuiceParticles(pos: Vec2, colors: string[]): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < 18; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(2, 8);
      particles.push({
        pos: { x: pos.x + rand(-8, 8), y: pos.y + rand(-8, 8) },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        color: colors[Math.floor(Math.random() * colors.length)],
        radius: rand(3, 8),
        age: 0,
        maxAge: rand(20, 40),
        alpha: 1,
      });
    }
    return particles;
  }

  private createBombParticles(pos: Vec2): Particle[] {
    const particles: Particle[] = [];
    const grayColors = ['#adb5bd', '#6c757d', '#dee2e6', '#fff'];
    for (let i = 0; i < 24; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(3, 12);
      particles.push({
        pos: { x: pos.x + rand(-5, 5), y: pos.y + rand(-5, 5) },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        color: grayColors[Math.floor(Math.random() * grayColors.length)],
        radius: rand(2, 6),
        age: 0,
        maxAge: rand(15, 35),
        alpha: 1,
      });
    }
    return particles;
  }

  render(ctx: CanvasRenderingContext2D) {
    const w = this.canvasW;
    const h = this.canvasH;

    // Clear with transparent (video is underneath)
    ctx.clearRect(0, 0, w, h);

    // Dark overlay for contrast
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, w, h);

    // Draw slice effects (particles first, then halves)
    for (const effect of this.sliceEffects) {
      const alpha = 1 - effect.age / effect.maxAge;
      for (const p of effect.particles) {
        ctx.save();
        ctx.globalAlpha = p.alpha * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Draw half fruits
      this.drawHalfFruit(ctx, effect.left, effect.type, alpha);
      this.drawHalfFruit(ctx, effect.right, effect.type, alpha);
    }

    // Draw whole fruits
    for (const fruit of this.fruits) {
      if (fruit.sliced || fruit.offScreen) continue;
      this.drawFruit(ctx, fruit);
    }

    // Draw trail
    this.drawTrail(ctx);

    // Draw score popups
    for (const sp of this.scorePopups) {
      const t = sp.age / sp.maxAge;
      const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = this.state.combo > 2 ? 'bold 26px "Segoe UI", sans-serif' : 'bold 22px "Segoe UI", sans-serif';
      ctx.fillStyle = sp.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      const yOffset = -sp.age * 1.2;
      ctx.strokeText(sp.text, sp.x, sp.y + yOffset);
      ctx.fillText(sp.text, sp.x, sp.y + yOffset);
      ctx.restore();
    }

    // Countdown
    if (this.state.phase === 'countdown') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, w, h);
      const t = this.countdownTimer / 60;
      const scale = 1 + (1 - t) * 0.5;
      ctx.font = `bold ${Math.round(120 * scale)}px "Segoe UI", sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 4;
      const label = this.countdownValue > 0 ? String(this.countdownValue) : 'GO!';
      ctx.strokeText(label, w / 2, h / 2);
      ctx.fillText(label, w / 2, h / 2);
      ctx.restore();
    }
  }

  private drawFruit(ctx: CanvasRenderingContext2D, fruit: Fruit) {
    const { pos, radius, rotation } = fruit;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(rotation);

    if (fruit.type === 'bomb') {
      this.drawBombShape(ctx, radius);
    } else {
      ctx.font = `${Math.round(radius * 1.7)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 10;
      ctx.fillText(this.getFruitEmoji(fruit.type), 0, 0);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  private drawBombShape(ctx: CanvasRenderingContext2D, radius: number) {
    // Body
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 1, 0, 0, radius);
    grad.addColorStop(0, '#555');
    grad.addColorStop(1, '#111');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fuse
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.quadraticCurveTo(radius * 0.5, -radius * 1.4, radius * 0.3, -radius * 1.8);
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Spark
    ctx.beginPath();
    ctx.arc(radius * 0.3, -radius * 1.8, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(radius * 0.3, -radius * 1.8, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  private getFruitEmoji(type: FruitType): string {
    const map: Record<string, string> = {
      apple: '🍎', orange: '🍊', watermelon: '🍉',
      lemon: '🍋', strawberry: '🍓', peach: '🍑',
    };
    return map[type] ?? '🍎';
  }

  private drawHalfFruit(ctx: CanvasRenderingContext2D, half: { pos: Vec2; vel: Vec2; rotation: number; angularVel: number; side: 'left' | 'right' }, type: FruitType, alpha: number) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(half.pos.x, half.pos.y);
    ctx.rotate(half.rotation);

    const colors = FRUIT_COLORS[type];
    const r = type === 'watermelon' ? 52 : 38;
    const side = half.side === 'left' ? 1 : -1;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI, false);
    ctx.closePath();
    ctx.rotate(half.side === 'left' ? 0 : Math.PI);

    // Outer skin
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = colors.main;
    ctx.fill();

    // Inner flesh
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = colors.juice[0];
    ctx.fill();

    // Juice drip
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private drawTrail(ctx: CanvasRenderingContext2D) {
    if (this.trail.length < 2) return;
    for (let i = 1; i < this.trail.length; i++) {
      const p0 = this.trail[i - 1];
      const p1 = this.trail[i];
      const t = i / this.trail.length;
      const alpha = t * (1 - p1.age / p1.maxAge);
      const width = t * 6 + 1;

      // Outer glow
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.3})`;
      ctx.lineWidth = width + 6;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Inner bright line
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  getFruits() { return this.fruits; }
  getSliceEffects() { return this.sliceEffects; }
  getTrail() { return this.trail; }
  getScorePopups() { return this.scorePopups; }
}
