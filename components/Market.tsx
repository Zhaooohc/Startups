
import React from 'react';
import { MarketItem, Card as CardType, CompanyType } from '../types';
import { Card, CardBack } from './Card';

interface MarketProps {
  market: MarketItem[];
  deckCount: number;
  onDrawDeck: () => void;
  onTakeMarket: (index: number) => void;
  canDrawDeck: boolean;
  canTakeMarket: boolean;
  drawCost: number;
  playerTokens: CompanyType[];
}

export const Market: React.FC<MarketProps> = ({
  market,
  deckCount,
  onDrawDeck,
  onTakeMarket,
  canDrawDeck,
  canTakeMarket,
  drawCost,
  playerTokens
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-xl border border-white/10 w-full max-w-4xl mx-auto my-4">
      <h3 className="text-gray-400 uppercase text-xs tracking-wider mb-4 font-semibold">市场 (Marketplace)</h3>
      
      <div className="flex flex-col md:flex-row items-start gap-8 w-full">
        {/* Deck */}
        <div className="flex flex-col items-center gap-2 min-w-[100px]">
          <div className="relative group">
            <CardBack count={deckCount} className="w-24 h-32 hover:scale-105 transition-transform" />
             {deckCount > 0 && (
                <button
                    onClick={onDrawDeck}
                    disabled={!canDrawDeck}
                    className={`absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap z-20
                        ${canDrawDeck ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                    `}
                >
                    抽牌堆
                    {drawCost > 0 && canDrawDeck && <span className="ml-1 text-yellow-300">(-{drawCost}💰)</span>}
                </button>
             )}
          </div>
          <span className="text-xs text-gray-500">牌堆 ({deckCount})</span>
        </div>

        {/* Market Pool */}
        <div className="flex-1">
             <div className="flex flex-wrap gap-3 justify-center md:justify-start min-h-[8rem] p-4 bg-slate-900/30 rounded-lg border-2 border-dashed border-white/10">
                {market.length === 0 ? (
                    <div className="w-full text-center text-slate-500 italic text-sm my-auto">市场空空如也</div>
                ) : (
                    market.map((item, index) => {
                        const isBlocked = playerTokens.includes(item.card.type);
                        const canTakeThis = canTakeMarket && !isBlocked;

                        return (
                            <div key={index} className="relative group">
                                <Card 
                                    card={item.card} 
                                    isSmall={false}
                                    className={`${isBlocked ? 'opacity-50 grayscale' : ''}`}
                                />
                                {/* Coins on card */}
                                {item.coins > 0 && (
                                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-black font-bold border-2 border-yellow-200 shadow-md z-10">
                                        {item.coins}
                                    </div>
                                )}
                                
                                {/* Anti-Monopoly Lock Icon */}
                                {isBlocked && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-red-900/80 rounded-full p-2 border border-red-500">
                                            <span className="text-2xl">🔒</span>
                                        </div>
                                    </div>
                                )}

                                {/* Take Button */}
                                {canTakeMarket && !isBlocked && (
                                    <button
                                        onClick={() => onTakeMarket(index)}
                                        className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                                    >
                                        拿取
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
             </div>
             <p className="text-xs text-slate-500 mt-2 text-center md:text-left">
                规则提示：从市场拿牌免费（并获得牌上的金币）。如果你持有该公司的反垄断指示物 🔒，则不能从市场拿牌。
             </p>
        </div>
      </div>
    </div>
  );
};
