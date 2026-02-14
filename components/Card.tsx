import React from 'react';
import { Card as CardType } from '../types';
import { COMPANY_CONFIGS } from '../constants';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  className?: string;
  isSmall?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, onClick, className = '', isSmall = false }) => {
  const config = COMPANY_CONFIGS[card.type];

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-lg shadow-md border-2 border-white/10 flex flex-col items-center justify-center
        select-none transition-transform hover:scale-105 cursor-pointer
        ${config.color} text-white
        ${isSmall ? 'w-12 h-16 text-xs' : 'w-24 h-32 text-sm'}
        ${className}
      `}
    >
      <div className="absolute top-1 left-1 font-bold opacity-80">{isSmall ? '' : config.total}</div>
      <div className="text-2xl">{config.icon}</div>
      {!isSmall && <div className="font-bold text-center mt-2 leading-tight px-1">{config.label}</div>}
    </div>
  );
};

export const CardBack: React.FC<{ count?: number, className?: string }> = ({ count, className = '' }) => (
  <div className={`w-16 h-24 bg-slate-700 rounded-lg border-2 border-slate-500 flex items-center justify-center shadow-md ${className}`}>
    <div className="text-slate-400 font-bold text-xl">
        {count !== undefined ? count : 'S'}
    </div>
  </div>
);