export interface Vec2 {
  x: number;
  y: number;
}

export type FruitType = 'apple' | 'orange' | 'watermelon' | 'lemon' | 'strawberry' | 'peach' | 'bomb';

export interface Fruit {
  id: number;
  type: FruitType;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  rotation: number;
  angularVel: number;
  sliced: boolean;
  missed: boolean;
  offScreen: boolean;
}

export interface HalfFruit {
  pos: Vec2;
  vel: Vec2;
  rotation: number;
  angularVel: number;
  side: 'left' | 'right';
}

export interface Particle {
  pos: Vec2;
  vel: Vec2;
  color: string;
  radius: number;
  age: number;
  maxAge: number;
  alpha: number;
}

export interface SliceEffect {
  id: number;
  type: FruitType;
  left: HalfFruit;
  right: HalfFruit;
  particles: Particle[];
  age: number;
  maxAge: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  age: number;
  maxAge: number;
}

export interface ScorePopup {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  maxAge: number;
}

export interface GameState {
  score: number;
  lives: number;
  phase: 'idle' | 'countdown' | 'playing' | 'gameOver';
  difficulty: number;
  combo: number;
  comboTimer: number;
  totalTime: number;
}

export const FRUIT_COLORS: Record<FruitType, { main: string; dark: string; juice: string[] }> = {
  apple:      { main: '#e63946', dark: '#9b2226', juice: ['#e63946','#c1121f','#ff6b6b'] },
  orange:     { main: '#fb8500', dark: '#c77c00', juice: ['#fb8500','#ffb703','#ff6d00'] },
  watermelon: { main: '#52b788', dark: '#1b4332', juice: ['#52b788','#74c69d','#d8f3dc'] },
  lemon:      { main: '#f9c74f', dark: '#f3a712', juice: ['#f9c74f','#f8961e','#fffcf2'] },
  strawberry: { main: '#e63946', dark: '#9b2226', juice: ['#e63946','#ff6b6b','#ffccd5'] },
  peach:      { main: '#ffb347', dark: '#e07b20', juice: ['#ffb347','#ff9f1c','#ffd6a5'] },
  bomb:       { main: '#212529', dark: '#000000', juice: ['#adb5bd','#6c757d','#dee2e6'] },
};

export const FRUIT_EMOJI: Record<FruitType, string> = {
  apple:      '🍎',
  orange:     '🍊',
  watermelon: '🍉',
  lemon:      '🍋',
  strawberry: '🍓',
  peach:      '🍑',
  bomb:       '💣',
};
