
import React from 'react';
import { COMPANY_CONFIGS } from '../constants';
import { CompanyType } from '../types';

export const ReferenceGuide: React.FC = () => {
  const configs = Object.values(COMPANY_CONFIGS).sort((a, b) => a.total - b.total);

  return (
    <div className="bg-slate-800/80 border border-white/10 rounded-xl p-4 h-fit max-w-sm w-full backdrop-blur-sm sticky top-24">
      <h3 className="text-gray-400 uppercase text-xs tracking-wider mb-4 font-semibold border-b border-white/10 pb-2">
        牌库一览 / Card Reference
      </h3>
      <div className="space-y-3">
        {configs.map((config) => (
          <div key={config.type} className="flex items-center gap-3 group">
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center text-lg shadow-sm shrink-0
              ${config.color} text-white font-bold
            `}>
              {config.total}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                 <span className="text-xl leading-none">{config.icon}</span>
                 <span className="font-bold text-sm text-slate-200 truncate">
                    {config.cnLabel} <span className="text-slate-500 text-xs font-normal">({config.label})</span>
                 </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                {config.description}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-slate-500">
        <p>💡 提示：数字代表牌堆中该公司的总张数。数字越小越稀有，也更容易达成垄断。</p>
      </div>
    </div>
  );
};
