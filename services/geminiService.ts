
import { GoogleGenAI } from "@google/genai";
import { GameState, CompanyType } from '../types';
import { COMPANY_CONFIGS } from '../constants';

const getCompanyLabel = (type: CompanyType) => {
  const config = COMPANY_CONFIGS[type];
  return `${config.cnLabel} (${config.label}, Total ${config.total})`;
};

export const getGeminiAdvice = async (gameState: GameState): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key not found. Unable to provide AI advice.";
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  
  // Construct a textual representation of the game state
  const handDesc = currentPlayer.hand.map(c => getCompanyLabel(c.type)).join(', ');
  const tableauDesc = currentPlayer.tableau.map(c => getCompanyLabel(c.type)).join(', ');
  
  let marketDesc = "Empty";
  if (gameState.market.length > 0) {
    const topItem = gameState.market[gameState.market.length - 1];
    marketDesc = `Top Card: ${getCompanyLabel(topItem.card.type)} with ${topItem.coins} coins on it.`;
  }

  const opponentsDesc = gameState.players
    .filter(p => p.id !== currentPlayer.id)
    .map(p => `Player ${p.id + 1}: Has ${p.tableau.length} cards in play (${p.tableau.map(c => c.type).join(', ')}), ${p.tokens.length > 0 ? 'Tokens: ' + p.tokens.join(', ') : 'No tokens'}`)
    .join('\n');

  const prompt = `
    You are an expert at the board game "Startups" by Oink Games.
    Analyze the current game state and suggest the best move for Player ${currentPlayer.id + 1}.

    Current Phase: ${gameState.phase} (If DRAW, should I draw from deck or market? If PLAY, which card should I play to tableau or market?)

    My State:
    - Hand: ${handDesc}
    - My Tableau (Cards played): ${tableauDesc}
    - Coins: ${currentPlayer.coins}
    - Tokens Held: ${currentPlayer.tokens.join(', ') || 'None'}

    Market State:
    - ${marketDesc}

    Opponents:
    ${opponentsDesc}

    Rules Reminder:
    - To win, I need the most cards of a company to collect coins from others who have that company.
    - If I have the Anti-Monopoly Token, I cannot take that card from the Market.
    - Paying to skip the market card costs 1 coin.

    Please provide a concise (max 2 sentences) strategic recommendation IN CHINESE (简体中文). Start with the action "Draw from..." or "Play..." translated to Chinese.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
          thinkingConfig: { thinkingBudget: 0 } // Low latency preferred for game advice
      }
    });
    
    return response.text || "No advice generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI 顾问目前离线 (请检查 API Key 或网络)。";
  }
};
