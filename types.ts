
export enum CompanyType {
  GIRAFFE = 'GIRAFFE', // 5 cards
  FLAMINGO = 'FLAMINGO', // 6 cards
  DOG = 'DOG', // 7 cards
  OCTOPUS = 'OCTOPUS', // 8 cards
  HIPPO = 'HIPPO', // 9 cards
  ELEPHANT = 'ELEPHANT' // 10 cards
}

export interface CardConfig {
  type: CompanyType;
  total: number;
  color: string;
  label: string;
  cnLabel: string;
  icon: string;
  description: string;
}

export interface Card {
  id: string;
  type: CompanyType;
}

export interface Player {
  id: number;
  peerId: string; // Transient ID (changes on reload)
  uuid: string;   // Persistent ID (stored in localStorage)
  name: string;
  hand: Card[];
  tableau: Card[];
  coins: number; // 1-point chips (Starting Capital)
  earnedChips: number; // 3-point chips (Acquired from winning)
  tokens: CompanyType[]; // Anti-monopoly tokens held
  isHost?: boolean;
}

export interface MarketItem {
  card: Card;
  coins: number;
}

export type GamePhase = 'LOBBY' | 'SETUP' | 'DRAW' | 'PLAY' | 'READY_TO_SCORE' | 'SCORING';

export interface TurnState {
  source: 'DECK' | 'MARKET' | null;
  drawnCardId: string | null;
}

export interface GameState {
  version: number; // Version control for sync
  players: Player[];
  deck: Card[];
  market: MarketItem[];
  currentPlayerIndex: number;
  phase: GamePhase;
  turnState: TurnState;
  logs: string[];
  winnerId: number | null;
}

export interface ScoreResult {
  playerId: number;
  playerName: string;
  score: number;
  coins: number;
  earnedChips: number;
  breakdown: string[];
}

export interface CompanyScoring {
  company: CompanyType;
  winnerId: number | null; // Player ID
  holdings: { playerId: number, playerName: string, count: number }[];
}

export interface FinalStats {
  rankings: ScoreResult[];
  companyStats: CompanyScoring[];
}

// Network Message Types
export type MessageType = 'JOIN_LOBBY' | 'UPDATE_LOBBY' | 'START_GAME' | 'UPDATE_GAME_STATE' | 'REQUEST_STATE';

export interface NetworkMessage {
  type: MessageType;
  payload: any;
  senderId?: string;
}
