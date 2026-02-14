
import React from 'react';
import { FinalStats } from '../types';
import { COMPANY_CONFIGS } from '../constants';

interface ScoringSidebarProps {
  stats: FinalStats;
  onRestart: () => void;
  onExit: () => void;
  isHost: boolean;
}

export const ScoringSidebar: React.FC<ScoringSidebarProps> = ({ stats, onRestart, onExit, isHost }) => {
  return (
    <div className="w-full xl:w-96 bg-slate-900 border-l border-white/10 flex flex-col h-full overflow-hidden shadow-2xl">
      <div className="p-4 bg-slate-950 border-b border-white/10 flex-shrink-0">
        <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 text-center">
           🏆 最终战报
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* Rankings */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 pb-1">玩家排名</h3>
          {stats.rankings.map((r, i) => (
            <div key={r.playerId} className={`p-3 rounded-lg flex justify-between items-center ${i===0 ? 'bg-yellow-900/20 border border-yellow-500/30' : 'bg-slate-800/50'}`}>
               <div className="flex items-center gap-3">
                   <div className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${i===0 ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-300'}`}>
                       {i+1}
                   </div>
                   <div>
                       <div className="font-bold text-sm text-slate-200">{r.playerName}</div>
                       <div className="text-[10px] text-slate-500">💰{r.coins} + 🪙{r.earnedChips}x3</div>
                   </div>
               </div>
               <div className="text-xl font-mono font-bold text-white">{r.score}</div>
            </div>
          ))}
        </div>

        {/* Company Breakdowns */}
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 pb-1">股权详情</h3>
            {stats.companyStats.map((c) => {
                const config = COMPANY_CONFIGS[c.company];
                const winnerName = c.winnerId !== null 
                    ? c.holdings.find(h => h.playerId === c.winnerId)?.playerName 
                    : "无 (平局)";
                
                return (
                    <div key={c.company} className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                             <span className="text-lg">{config.icon}</span>
                             <span className={`text-sm font-bold ${c.winnerId !== null ? 'text-white' : 'text-slate-500'}`}>
                                 {config.cnLabel}
                             </span>
                             <span className="ml-auto text-[10px] text-slate-400">Total: {config.total}</span>
                        </div>
                        
                        {c.winnerId !== null ? (
                             <div className="text-xs text-green-400 mb-2 font-bold bg-green-900/20 px-2 py-1 rounded inline-block">
                                 👑 大股东: {winnerName}
                             </div>
                        ) : (
                             <div className="text-xs text-red-400 mb-2 font-bold bg-red-900/20 px-2 py-1 rounded inline-block">
                                 ⚠️ 僵局 - 无收益
                             </div>
                        )}

                        <div className="space-y-1">
                            {c.holdings.filter(h => h.count > 0).map(h => {
                                const isWinner = h.playerId === c.winnerId;
                                return (
                                    <div key={h.playerId} className="flex justify-between text-xs items-center">
                                        <span className={isWinner ? 'text-yellow-200 font-bold' : 'text-slate-400'}>
                                            {h.playerName}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-700 px-1.5 rounded text-[10px] text-white min-w-[20px] text-center">{h.count}</span>
                                            {isWinner ? (
                                                <span className="text-green-500 font-bold w-12 text-right">收租</span>
                                            ) : (
                                                <span className="text-red-400 w-12 text-right">-{h.count}💰</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>

      </div>

      {/* Actions */}
      <div className="p-4 bg-slate-950 border-t border-white/10 flex flex-col gap-2">
          {isHost && (
              <button onClick={onRestart} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-sm">
                  再来一局
              </button>
          )}
          <button onClick={onExit} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold text-sm">
              返回大厅
          </button>
      </div>
    </div>
  );
};
