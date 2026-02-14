
import React from 'react';
import { Player, Card as CardType } from '../types';
import { Card, CardBack } from './Card';
import { COMPANY_CONFIGS } from '../constants';

interface PlayerBoardProps {
  player: Player;
  isActive: boolean;
  isLocalPlayer: boolean;
  onPlayCard?: (card: CardType) => void;
  canPlay: boolean;
  targetMode: 'tableau' | 'market';
  setTargetMode: (mode: 'tableau' | 'market') => void;
  revealHands?: boolean;
}

export const PlayerBoard: React.FC<PlayerBoardProps> = ({
  player,
  isActive,
  isLocalPlayer,
  onPlayCard,
  canPlay,
  targetMode,
  setTargetMode,
  revealHands = false
}) => {
  const showHandCards = isLocalPlayer || revealHands;

  return (
    <div className={`
      relative p-4 rounded-xl border transition-all duration-300
      ${isActive ? 'bg-slate-800 border-blue-500 shadow-blue-900/20 shadow-xl scale-[1.02] z-10' : 'bg-slate-900/50 border-white/5 opacity-80'}
      ${isLocalPlayer ? 'ring-2 ring-emerald-500/20' : ''}
    `}>
      {/* Header Info */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
            <h3 className={`font-bold ${isActive ? 'text-white' : 'text-gray-400'}`}>
            {player.name} {isLocalPlayer && <span className="text-emerald-400 text-xs ml-2">(你)</span>}
            </h3>
            {/* Tokens Badge */}
            <div className="flex -space-x-1">
                {player.tokens.map((tokenType, i) => (
                    <div key={i} className={`w-5 h-5 rounded-full border border-slate-900 ${COMPANY_CONFIGS[tokenType].color} flex items-center justify-center text-[10px]`} title="反垄断指示物 (Anti-Monopoly Token)">
                        🔒
                    </div>
                ))}
            </div>
        </div>
        <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full">
          <span className="text-yellow-400">💰</span>
          <span className="font-mono text-white font-bold">{player.coins}</span>
        </div>
      </div>

      {/* Tableau (Played Cards) - Always Visible */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">已投资 (Tableau)</div>
        <div className="flex flex-wrap gap-1 min-h-[4rem]">
          {player.tableau.map((card) => (
            <Card key={card.id} card={card} isSmall className="hover:scale-110 transition-transform origin-bottom" />
          ))}
          {player.tableau.length === 0 && <span className="text-gray-700 text-xs italic p-2">暂无投资</span>}
        </div>
      </div>

      {/* Hand - Visible if local player OR revealHands is true */}
      <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex justify-between items-center mb-2">
              <span className={`text-xs uppercase tracking-wide font-bold ${showHandCards ? 'text-blue-300' : 'text-slate-600'}`}>
                  {showHandCards ? (revealHands ? '最终手牌 (计入结算)' : '你的手牌') : '对方手牌'}
              </span>
              
              {/* Play Mode Toggle (Only local player can see this during active play) */}
              {isLocalPlayer && canPlay && (
                  <div className="flex bg-slate-950 rounded-lg p-1">
                      <button
                          onClick={() => setTargetMode('tableau')}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${targetMode === 'tableau' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                      >
                          投资 (打给自己)
                      </button>
                      <button
                          onClick={() => setTargetMode('market')}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${targetMode === 'market' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                      >
                          弃牌 (扔进市场)
                      </button>
                  </div>
              )}
          </div>

          <div className="flex gap-2 justify-center">
              {showHandCards ? (
                  // Show Actual Cards
                  player.hand.map((card) => (
                    <div key={card.id} className="relative group">
                        <Card 
                            card={card} 
                            onClick={() => canPlay && onPlayCard && onPlayCard(card)}
                            className={`${canPlay ? 'hover:-translate-y-2 hover:shadow-lg hover:shadow-blue-500/20 ring-2 ring-transparent hover:ring-white' : 'opacity-80'}`}
                        />
                        {canPlay && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-lg pointer-events-none">
                                <span className="text-xs font-bold text-white bg-black/50 px-2 py-1 rounded">
                                    {targetMode === 'tableau' ? '投资' : '弃牌'}
                                </span>
                            </div>
                        )}
                        {revealHands && !isLocalPlayer && (
                           <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold px-1 rounded-full animate-pulse shadow-sm">
                              +1
                           </div>
                        )}
                    </div>
                  ))
              ) : (
                  // Show Card Backs
                  player.hand.map((_, idx) => (
                      <CardBack key={idx} className="scale-90 opacity-75" />
                  ))
              )}
          </div>
      </div>
    </div>
  );
};
