
import { CompanyType, CardConfig } from './types';

export const COMPANY_CONFIGS: Record<CompanyType, CardConfig> = {
  [CompanyType.GIRAFFE]: { 
    type: CompanyType.GIRAFFE, 
    total: 5, 
    color: 'bg-yellow-500', 
    label: 'Giraffe Beer', 
    cnLabel: '长颈鹿啤酒',
    icon: '🦒',
    description: '最稀有，容易抢到多数'
  },
  [CompanyType.FLAMINGO]: { 
    type: CompanyType.FLAMINGO, 
    total: 6, 
    color: 'bg-pink-500', 
    label: 'Flamingo Soft', 
    cnLabel: '火烈鸟软件',
    icon: '🦩',
    description: '较稀有，容易形成垄断'
  },
  [CompanyType.DOG]: { 
    type: CompanyType.DOG, 
    total: 7, 
    color: 'bg-cyan-500', 
    label: 'BowWow Games', 
    cnLabel: '汪汪游戏',
    icon: '🐕',
    description: '中等稀有度'
  },
  [CompanyType.OCTOPUS]: { 
    type: CompanyType.OCTOPUS, 
    total: 8, 
    color: 'bg-indigo-500', 
    label: 'Octo Coffee', 
    cnLabel: '章鱼咖啡',
    icon: '🐙',
    description: '稍分散，需更多股份'
  },
  [CompanyType.HIPPO]: { 
    type: CompanyType.HIPPO, 
    total: 9, 
    color: 'bg-emerald-600', 
    label: 'Hippo Power', 
    cnLabel: '河马电力',
    icon: '🦛',
    description: '较分散，竞争激烈'
  },
  [CompanyType.ELEPHANT]: { 
    type: CompanyType.ELEPHANT, 
    total: 10, 
    color: 'bg-red-600', 
    label: 'Elephant Mars', 
    cnLabel: '大象火星',
    icon: '🐘',
    description: '最分散，最难独占'
  },
};

export const STARTING_COINS = 10;
export const CARDS_REMOVED_AT_START = 5;
export const HAND_SIZE = 3;
