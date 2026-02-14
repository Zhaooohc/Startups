
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

export const initializeGame = (connectedPlayers: { peerId: string, name: string, uuid: string }[]): GameState => {
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
    uuid: p.uuid, // Bind persistence ID
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

// Logic to advance turn, handling skipping players if they are stuck
export const advanceTurn = (gameState: GameState): GameState => {
    const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
    const totalPlayers = newState.players.length;
    let attempts = 0;

    // We loop through players to find the next valid one
    // Max attempts = totalPlayers + 1 to prevent infinite loops (though logic breaks at totalPlayers)
    while (attempts < totalPlayers) {
        // 1. Move to next player
        newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % totalPlayers;
        attempts++;

        // 2. Check Global Game End Condition first (Deck Empty AND Market Empty)
        if (newState.deck.length === 0 && newState.market.length === 0) {
            newState.phase = 'READY_TO_SCORE';
            newState.logs.push("牌堆和市场均已清空！游戏结束，等待结算。");
            return newState;
        }

        // 3. Check if THIS player is "stuck" (The Skip Rule)
        // Condition: Deck is empty AND Player cannot take ANY card from market due to tokens
        const player = newState.players[newState.currentPlayerIndex];
        
        if (newState.deck.length === 0) {
             // Can the player take ANY card from the market?
             // A player can take a market card if they DO NOT hold the token for it.
             const canTakeAnyMarketCard = newState.market.some(item => !player.tokens.includes(item.card.type));

             if (!canTakeAnyMarketCard) {
                 // Player is stuck. Log it and continue loop to next player.
                 newState.logs.push(`${player.name} 无牌可抓（牌堆空且市场被反垄断锁死），跳过回合。`);
                 continue; 
             }
        }

        // 4. If we are here, the player can act.
        newState.phase = 'DRAW';
        newState.turnState = { source: null, drawnCardId: null };
        return newState;
    }

    // If we exit the while loop, it means ALL players are stuck (or deck/market empty logic above caught it)
    // Just in case specific logic leads to a full deadlock with items in market:
    newState.phase = 'READY_TO_SCORE';
    newState.logs.push("所有玩家均无法行动，直接进入结算。");
    return newState;
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

    // 2. Award Token (In-Game Control)
    if (potentialOwners.length > 0) {
       let winnerId: number | null = null;

       if (potentialOwners.length === 1) {
         // Strict majority
         winnerId = potentialOwners[0];
       } else {
         // Tie detected.
         // Rule: "First Come First Served" for holding the token during the game.
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
    } else {
        // TIE or NO ONE has cards
        // NEW RULE CONFIRMATION: If there is a tie, winnerId is NULL.
        // Even if someone holds the token, they do NOT win the payout.
        winnerId = null; 
    }

    companyStats.push({
        company,
        winnerId,
        holdings: holdings.sort((a, b) => b.count - a.count)
    });

    // Apply Scoring
    // CRITICAL FIX: Only execute payment logic if there is a DISTINCT WINNER.
    // In a tie (winnerId === null), this block is skipped entirely, meaning NO coins change hands.
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
