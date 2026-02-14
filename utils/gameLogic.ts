
import { GameState, Player, Card, CompanyType, MarketItem, FinalStats, ScoreResult, CompanyScoring } from '../types';
import { COMPANY_CONFIGS, STARTING_COINS, CARDS_REMOVED_AT_START, HAND_SIZE } from '../constants';

// Helper to shuffle array
const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Helper to get CN Name
const getCnName = (type: CompanyType | null): string => {
    if (!type) return '未知';
    return COMPANY_CONFIGS[type].cnLabel;
};

export const initializeGame = (connectedPlayers: { peerId: string, name: string }[]): GameState => {
  // 1. Create Deck
  let deck: Card[] = [];
  Object.values(COMPANY_CONFIGS).forEach(config => {
    for (let i = 0; i < config.total; i++) {
      deck.push({
        id: `${config.type}-${i}`,
        type: config.type
      });
    }
  });
  deck = shuffle(deck);

  // 2. Remove 5 cards (return to box)
  deck.splice(0, CARDS_REMOVED_AT_START);

  // 3. Setup Players
  // We shuffle the player order so seat position is random
  const shuffledProfiles = shuffle(connectedPlayers);
  const players: Player[] = shuffledProfiles.map((p, i) => ({
    id: i,
    peerId: p.peerId,
    name: p.name,
    hand: [],
    tableau: [],
    coins: STARTING_COINS,
    earnedChips: 0,
    tokens: []
  }));

  // 4. Deal Hands (3 cards each)
  players.forEach(player => {
    player.hand = deck.splice(0, HAND_SIZE);
  });

  // 5. Setup Market (Market starts EMPTY per new rules)
  const market: MarketItem[] = [];

  return {
    version: 1,
    players,
    deck,
    market,
    currentPlayerIndex: 0,
    phase: 'DRAW',
    turnState: { source: null, drawnCardId: null },
    logs: ['游戏初始化完成。', '洗牌并分发手牌。', '市场清空。'],
    winnerId: null
  };
};

// Check if player can draw from deck given market tax rules
export const canDrawFromDeck = (gameState: GameState): boolean => {
  if (gameState.deck.length === 0) return false;
  
  const player = gameState.players[gameState.currentPlayerIndex];
  
  // Calculate cost: 1 coin per market card, UNLESS player holds Anti-Monopoly token for that card type
  let cost = 0;
  gameState.market.forEach(item => {
    if (!player.tokens.includes(item.card.type)) {
      cost += 1;
    }
  });

  return player.coins >= cost;
};

export const canDrawFromMarket = (gameState: GameState): boolean => {
  return gameState.market.length > 0;
};

export const updateTokens = (players: Player[]): Player[] => {
  const newPlayers = JSON.parse(JSON.stringify(players)) as Player[];
  const companyTypes = Object.keys(COMPANY_CONFIGS) as CompanyType[];

  // Map current token owners for "First Come First Served" logic
  // If a player already has the token, they win ties.
  const currentTokenHolders: Record<string, number> = {};
  newPlayers.forEach(p => {
    p.tokens.forEach(t => {
      currentTokenHolders[t] = p.id;
    });
    // Clear tokens temporarily to recalculate
    p.tokens = [];
  });

  companyTypes.forEach(company => {
    let maxCount = 0;
    let potentialOwners: number[] = [];

    // 1. Determine the highest number of shares
    newPlayers.forEach(p => {
      const count = p.tableau.filter(c => c.type === company).length;
      if (count > maxCount) {
        maxCount = count;
        potentialOwners = [p.id];
      } else if (count === maxCount && count > 0) {
        potentialOwners.push(p.id);
      }
    });

    // 2. Award Token
    if (potentialOwners.length > 0) {
       let winnerId: number | null = null;

       if (potentialOwners.length === 1) {
         // Strict majority
         winnerId = potentialOwners[0];
       } else {
         // Tie detected.
         // Rule: "First Come First Served". 
         // If the previous owner is in the tie, they keep it.
         const previousOwnerId = currentTokenHolders[company];
         if (previousOwnerId !== undefined && potentialOwners.includes(previousOwnerId)) {
           winnerId = previousOwnerId;
         }
       }

       if (winnerId !== null) {
         newPlayers[winnerId].tokens.push(company);
       }
    }
  });

  return newPlayers;
};

export const calculateFinalScores = (players: Player[]): FinalStats => {
  // 1. Prepare players with Hands added to Tableau (Mental Calculation only, doesn't affect UI rendering of board)
  const scoringPlayers = players.map(p => ({
    ...p,
    tableau: [...p.tableau, ...p.hand],
  }));

  // Identify who held the token at the END of the game (before revealing hands)
  const legacyTokenHolders: Record<string, number> = {};
  players.forEach(p => {
      p.tokens.forEach(t => legacyTokenHolders[t] = p.id);
  });

  const companyTypes = Object.keys(COMPANY_CONFIGS) as CompanyType[];
  const companyStats: CompanyScoring[] = [];

  // 2. Resolve Payments & Stats per Company
  companyTypes.forEach(company => {
    let maxCount = 0;
    let potentialOwners: number[] = [];
    const holdings: { playerId: number, playerName: string, count: number }[] = [];

    // Find counts including hand cards
    scoringPlayers.forEach(p => {
      const count = p.tableau.filter(c => c.type === company).length;
      holdings.push({ playerId: p.id, playerName: p.name, count });

      if (count > maxCount) {
        maxCount = count;
        potentialOwners = [p.id];
      } else if (count === maxCount && count > 0) {
        potentialOwners.push(p.id);
      }
    });

    // Determine Majority Shareholder (Winner of this company)
    let winnerId: number | null = null;

    if (potentialOwners.length === 1) {
        winnerId = potentialOwners[0];
    } else if (potentialOwners.length > 1) {
        // Tie-breaker
        const incumbentId = legacyTokenHolders[company];
        if (incumbentId !== undefined && potentialOwners.includes(incumbentId)) {
            winnerId = incumbentId; 
        }
    }

    companyStats.push({
        company,
        winnerId,
        holdings: holdings.sort((a, b) => b.count - a.count)
    });

    // Apply Scoring
    if (winnerId !== null) {
      const winner = scoringPlayers[winnerId];

      scoringPlayers.forEach(p => {
        if (p.id !== winnerId) {
          const count = p.tableau.filter(c => c.type === company).length;
          if (count > 0) {
            // Loser pays 1 coin per share
            p.coins -= count; 
            // Winner receives 1 chip (worth 3 points, but tracked as count) per share
            winner.earnedChips += count;
          }
        }
      });
    }
  });

  // 3. Final Tally
  const rankings: ScoreResult[] = [];
  scoringPlayers.forEach(p => {
    // Score = Current Coins (1pt) + Earned Chips (3pt)
    const finalScore = p.coins + (p.earnedChips * 3);
    
    rankings.push({
      playerId: p.id,
      playerName: p.name,
      score: finalScore,
      coins: p.coins,
      earnedChips: p.earnedChips,
      breakdown: [
        `最终金币: ${p.coins}`,
        `收益指示物: ${p.earnedChips} (x3 = ${p.earnedChips * 3}分)`
      ] 
    });
  });

  return {
      rankings: rankings.sort((a, b) => b.score - a.score),
      companyStats
  };
};
