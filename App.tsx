
import React, { useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import { initializeGame, canDrawFromDeck, canDrawFromMarket, updateTokens, calculateFinalScores } from './utils/gameLogic';
import { GameState, Card, Player, NetworkMessage } from './types';
import { Market } from './components/Market';
import { PlayerBoard } from './components/PlayerBoard';
import { ReferenceGuide } from './components/ReferenceGuide';
import { ScoringSidebar } from './components/ScoringSidebar';
import { getGeminiAdvice } from './services/geminiService';

const PEER_CONFIG = {
    debug: 2,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
        ],
        iceCandidatePoolSize: 10,
    },
};

const App: React.FC = () => {
  // Network State
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState<string>(localStorage.getItem('startups_name') || '');
  const [hostId, setHostId] = useState<string>(localStorage.getItem('startups_hostId') || '');
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [serverStatus, setServerStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  
  const connectionsRef = useRef<any[]>([]); 
  const peerRef = useRef<any>(null);
  const gameStateRef = useRef<GameState | null>(null);

  const [isHost, setIsHost] = useState<boolean>(localStorage.getItem('startups_isHost') === 'true');
  const [lobbyPlayers, setLobbyPlayers] = useState<{ peerId: string, name: string }[]>([]);

  // Game State
  const [view, setView] = useState<'LOGIN' | 'LOBBY' | 'GAME'>('LOGIN');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [targetMode, setTargetMode] = useState<'tableau' | 'market'>('tableau');

  // Persistence Effects
  useEffect(() => {
    if (peerName) localStorage.setItem('startups_name', peerName);
  }, [peerName]);

  useEffect(() => {
    localStorage.setItem('startups_hostId', hostId);
  }, [hostId]);

  useEffect(() => {
    localStorage.setItem('startups_isHost', String(isHost));
  }, [isHost]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Handle data reception
  const handleData = (msg: NetworkMessage, conn: any) => {
    console.log(`[DATA RECEIVED] Type: ${msg.type}`, msg.payload);
    
    switch (msg.type) {
        case 'JOIN_LOBBY':
             if (isHost) {
                 const newPlayer = msg.payload;
                 setLobbyPlayers(prev => {
                     const exists = prev.find(p => p.peerId === newPlayer.peerId);
                     const newList = exists ? prev : [...prev, newPlayer];
                     
                     if (conn && conn.open) {
                         conn.send({ type: 'UPDATE_LOBBY', payload: newList });
                         if (gameStateRef.current) {
                             conn.send({ type: 'UPDATE_GAME_STATE', payload: gameStateRef.current });
                         }
                     }
                     setTimeout(() => broadcast({ type: 'UPDATE_LOBBY', payload: newList }), 200);
                     return newList;
                 });
             }
             break;
        case 'UPDATE_LOBBY':
             setLobbyPlayers(msg.payload);
             setConnectionStatus("已连接到大厅");
             if (view === 'LOGIN') setView('LOBBY');
             break;
        case 'START_GAME':
        case 'UPDATE_GAME_STATE':
             setGameState(msg.payload);
             setView('GAME');
             setAdvice(null);
             if (isHost && msg.type === 'UPDATE_GAME_STATE') {
                 broadcast(msg, conn?.peer);
             }
             break;
        case 'REQUEST_STATE':
             if (isHost && gameStateRef.current && conn && conn.open) {
                 conn.send({ type: 'UPDATE_GAME_STATE', payload: gameStateRef.current });
             }
             break;
    }
  };

  const handleDataRef = useRef(handleData);
  useEffect(() => { handleDataRef.current = handleData; });

  const broadcast = (msg: NetworkMessage, excludeId?: string) => {
      connectionsRef.current = connectionsRef.current.filter(c => c.open);
      connectionsRef.current.forEach(conn => {
          if (excludeId && conn.peer === excludeId) return;
          try { conn.send(msg); } catch (e) { console.error("Broadcast failed", e); }
      });
  };

  const sendToHost = (msg: NetworkMessage) => {
      if (isHost) {
          handleData(msg, null); 
      } else {
          let hostConn = connectionsRef.current.find(c => c.peer === hostId && c.open);
          if (hostConn) {
              hostConn.send(msg);
          } else {
              // Try to reconnect if connection lost
              setConnectionStatus("尝试重新连接房主...");
              joinGame();
          }
      }
  };

  const initPeer = (name: string, autoJoin: boolean = false) => {
      if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
      }

      setServerStatus('CONNECTING');
      setConnectionStatus("连接信令服务器...");
      
      const peer = new Peer(null, PEER_CONFIG);
      peerRef.current = peer;
      
      peer.on('open', (id: string) => {
          setPeerId(id);
          setServerStatus('CONNECTED');
          setConnectionStatus("在线");
          if (autoJoin) {
              if (isHost) {
                  setLobbyPlayers([{ peerId: id, name }]);
                  setView('LOBBY');
              } else if (hostId) {
                  joinGame();
              }
          } else {
            setView('LOBBY');
            setLobbyPlayers([{ peerId: id, name }]);
          }
      });

      peer.on('connection', (conn: any) => {
          conn.on('data', (data: NetworkMessage) => handleDataRef.current(data, conn));
          conn.on('open', () => {
              connectionsRef.current = connectionsRef.current.filter(c => c.peer !== conn.peer);
              connectionsRef.current.push(conn);
          });
          conn.on('close', () => {
              connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
          });
      });

      peer.on('disconnected', () => setServerStatus('DISCONNECTED'));
      peer.on('error', (err: any) => {
          console.error("Peer Error:", err);
          setServerStatus('DISCONNECTED');
          setConnectionStatus(`网络错误: ${err.type}`);
      });
  };

  // Auto-init on mount if name exists
  useEffect(() => {
    if (peerName && !peerRef.current) {
        initPeer(peerName, true);
    }
  }, []);

  const createGame = () => { setIsHost(true); setConnectionStatus("创建房间中"); };
  
  const joinGame = () => {
      const cleanHostId = hostId.trim();
      if (!cleanHostId || !peerRef.current) return;
      
      if (peerRef.current.disconnected) peerRef.current.reconnect();

      setConnectionStatus("连接房主中...");
      const conn = peerRef.current.connect(cleanHostId, { reliable: true, serialization: 'json' });
      
      const timeout = setTimeout(() => {
          if (!connectionsRef.current.some(c => c.peer === cleanHostId && c.open)) {
              setConnectionStatus("连接超时，请重试");
          }
      }, 5000);

      conn.on('open', () => {
          clearTimeout(timeout);
          connectionsRef.current = connectionsRef.current.filter(c => c.peer !== cleanHostId);
          connectionsRef.current.push(conn);
          setIsHost(false);
          const msg = { type: 'JOIN_LOBBY', payload: { peerId: peerId, name: peerName } } as NetworkMessage;
          conn.send(msg);
          // Also request state in case game is already running
          conn.send({ type: 'REQUEST_STATE', payload: {} });
      });

      conn.on('data', (data: NetworkMessage) => handleDataRef.current(data, conn));
  };

  const cancelJoin = () => {
      setHostId('');
      localStorage.removeItem('startups_hostId');
      setLobbyPlayers([{ peerId: peerId!, name: peerName }]);
  };

  const fullReset = () => {
      localStorage.clear();
      window.location.reload();
  };

  const copyId = () => {
      if (peerId) {
          navigator.clipboard.writeText(peerId);
          alert("ID 已复制到剪贴板");
      }
  };

  // --- GAMEPLAY ACTIONS ---
  const syncGameState = (newState: GameState) => {
      newState.version = (newState.version || 0) + 1;
      setGameState(newState);
      if (isHost) broadcast({ type: 'UPDATE_GAME_STATE', payload: newState });
      else sendToHost({ type: 'UPDATE_GAME_STATE', payload: newState });
  };

  const handleStartGame = () => {
      if (!isHost) return;
      const initialState = initializeGame(lobbyPlayers);
      syncGameState(initialState);
      setView('GAME');
  };

  const handleForceFinish = () => {
      if (!isHost || !gameState) return;
      if (confirm("强制结束游戏并进入结算阶段？")) {
          const newGameState = JSON.parse(JSON.stringify(gameState)) as GameState;
          newGameState.phase = 'READY_TO_SCORE';
          newGameState.logs.push("房主强制结束了游戏。");
          syncGameState(newGameState);
      }
  };

  const handleRevealAndScore = () => {
      if (!gameState) return;
      const newGameState = JSON.parse(JSON.stringify(gameState)) as GameState;
      newGameState.phase = 'SCORING';
      newGameState.logs.push("结算开始！所有玩家亮出手牌。");
      syncGameState(newGameState);
  };

  const handleDrawDeck = () => {
    if (!gameState) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.peerId !== peerId) return;
    if (gameState.phase !== 'DRAW') return;
    
    let cost = 0;
    gameState.market.forEach(item => {
        if (!currentPlayer.tokens.includes(item.card.type)) cost += 1;
    });

    if (currentPlayer.coins < cost) return; 

    const newGameState = JSON.parse(JSON.stringify(gameState)) as GameState;
    const player = newGameState.players[newGameState.currentPlayerIndex];
    player.coins -= cost;
    newGameState.market.forEach(item => {
        if (!player.tokens.includes(item.card.type)) item.coins += 1;
    });
    
    const card = newGameState.deck.shift();
    if (card) {
      player.hand.push(card);
      newGameState.phase = 'PLAY';
      newGameState.turnState = { source: 'DECK', drawnCardId: card.id };
      newGameState.logs.push(`${player.name} 从牌堆抽了一张牌。`);
      syncGameState(newGameState);
    }
  };

  const handleTakeMarket = (index: number) => {
    if (!gameState) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.peerId !== peerId) return;
    if (gameState.phase !== 'DRAW') return;

    if (index < 0 || index >= gameState.market.length) return;
    const marketItem = gameState.market[index];

    if (currentPlayer.tokens.includes(marketItem.card.type)) {
        alert("你持有该公司的反垄断指示物，不能拿取该公司的股份。");
        return;
    }

    const newGameState = JSON.parse(JSON.stringify(gameState)) as GameState;
    const player = newGameState.players[newGameState.currentPlayerIndex];
    const [takenItem] = newGameState.market.splice(index, 1);

    if (takenItem) {
      player.hand.push(takenItem.card);
      player.coins += takenItem.coins;
      newGameState.phase = 'PLAY';
      newGameState.turnState = { source: 'MARKET', drawnCardId: takenItem.card.id };
      newGameState.logs.push(`${player.name} 从市场拿走了 ${takenItem.card.type} (+${takenItem.coins} 💰)。`);
      syncGameState(newGameState);
    }
  };

  const handlePlayCard = (card: Card) => {
    if (!gameState) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.peerId !== peerId) return;
    if (gameState.phase !== 'PLAY') return;

    if (targetMode === 'market' && 
        gameState.turnState.source === 'MARKET' && 
        gameState.turnState.drawnCardId === card.id) {
        alert("你刚从市场拿回的这张牌不能立刻弃回市场！");
        return;
    }

    const newGameState = JSON.parse(JSON.stringify(gameState)) as GameState;
    const player = newGameState.players[newGameState.currentPlayerIndex];
    const cardIndex = player.hand.findIndex(c => c.id === card.id);
    if (cardIndex === -1) return;
    player.hand.splice(cardIndex, 1);

    if (targetMode === 'tableau') {
      player.tableau.push(card);
      newGameState.logs.push(`${player.name} 投资了 ${card.type}。`);
    } else {
      newGameState.market.push({ card, coins: 0 });
      newGameState.logs.push(`${player.name} 将 ${card.type} 弃入市场。`);
    }

    newGameState.players = updateTokens(newGameState.players);

    if (newGameState.deck.length === 0 && newGameState.market.length === 0) {
        newGameState.phase = 'READY_TO_SCORE';
        newGameState.logs.push("牌堆和市场均已清空！等待结算。");
    } else {
        newGameState.currentPlayerIndex = (newGameState.currentPlayerIndex + 1) % newGameState.players.length;
        newGameState.phase = 'DRAW';
        newGameState.turnState = { source: null, drawnCardId: null };
    }

    syncGameState(newGameState);
  };

  const getAdvice = async () => {
    if (!gameState) return;
    setLoadingAdvice(true);
    const adviceText = await getGeminiAdvice(gameState);
    setAdvice(adviceText);
    setLoadingAdvice(false);
  };

  // --- RENDERING ---
  if (view === 'LOGIN' || view === 'LOBBY') {
      return (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
               {view === 'LOGIN' ? (
                  <div className="bg-slate-800 p-8 rounded-xl max-w-md w-full border border-white/10 shadow-2xl relative">
                      <h1 className="text-3xl font-black text-center mb-6 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">STARTUPS 创业公司</h1>
                      <div className="space-y-4">
                          <input type="text" value={peerName} onChange={(e) => setPeerName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white" placeholder="输入昵称..." />
                          <button onClick={() => peerName && initPeer(peerName)} disabled={!peerName} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-bold py-3 rounded-lg">{serverStatus === 'CONNECTING' ? '连接中...' : '开始游戏'}</button>
                          <div className="text-xs text-slate-500 text-center">{connectionStatus}</div>
                      </div>
                  </div>
               ) : (
                  <div className="bg-slate-800 p-8 rounded-xl max-w-lg w-full border border-white/10 shadow-2xl">
                      <div className="flex justify-between items-center mb-6">
                          <div>
                            <h2 className="text-2xl font-bold text-white">大厅 (Lobby)</h2>
                            <p className="text-xs text-green-400">{connectionStatus}</p>
                          </div>
                          <button onClick={fullReset} className="text-[10px] text-red-400 border border-red-900/50 px-2 py-1 rounded hover:bg-red-900/20">重置所有数据</button>
                      </div>

                      {!isHost && !hostId && (
                          <div className="grid grid-cols-2 gap-4 mb-6">
                              <button onClick={createGame} className="bg-indigo-600 hover:bg-indigo-500 p-4 rounded-xl font-bold text-white text-center">创建房间</button>
                              <div className="flex flex-col gap-2">
                                  <input type="text" placeholder="房主 ID" value={hostId} onChange={(e) => setHostId(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                                  <button onClick={joinGame} disabled={!hostId} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold py-2 rounded-lg">加入</button>
                              </div>
                          </div>
                      )}

                      {(isHost || hostId) && (
                          <div className="space-y-6">
                              {isHost && (
                                  <div className="bg-slate-950/50 p-4 rounded text-center">
                                      <p className="text-slate-400 text-xs mb-1">分享此 ID 给好友:</p>
                                      <div className="flex gap-2 justify-center items-center">
                                          <code className="text-xl font-mono text-blue-400 select-all">{peerId}</code>
                                          <button onClick={copyId} className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">复制</button>
                                      </div>
                                  </div>
                              )}
                              {!isHost && (
                                  <div className="flex justify-between items-center">
                                      <button onClick={cancelJoin} className="text-xs text-red-400 hover:text-red-300">取消 / 返回</button>
                                      <button onClick={joinGame} className="text-xs text-blue-400 hover:text-blue-300 font-bold">↻ 重新连接</button>
                                  </div>
                              )}
                              <div>
                                  <h3 className="text-sm text-slate-500 font-bold mb-2">玩家 ({lobbyPlayers.length})</h3>
                                  <div className="space-y-2">
                                    {lobbyPlayers.map((p, i) => (
                                        <div key={i} className="bg-slate-700/50 p-3 rounded flex gap-3 text-white">
                                            <span className="font-bold">{p.name}</span>
                                            {p.peerId === peerId && <span className="text-xs text-green-400 my-auto ml-auto">(你)</span>}
                                        </div>
                                    ))}
                                  </div>
                              </div>
                              {isHost ? <button onClick={handleStartGame} disabled={lobbyPlayers.length < 3 || lobbyPlayers.length > 6} className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white font-bold py-4 rounded-xl">{lobbyPlayers.length < 3 ? `还需 ${3-lobbyPlayers.length} 人` : '开始游戏'}</button> : <div className="text-center text-slate-400 animate-pulse">等待房主开始...</div>}
                          </div>
                      )}
                  </div>
               )}
          </div>
      )
  }

  if (!gameState) return <div className="text-white text-center mt-20">同步中... <button onClick={joinGame} className="text-blue-400 underline">重试</button></div>;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer.peerId === peerId;
  const isScoring = gameState.phase === 'SCORING';
  const isReadyToScore = gameState.phase === 'READY_TO_SCORE';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans flex flex-col xl:flex-row overflow-hidden">
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="bg-slate-950/80 border-b border-white/5 p-4 flex justify-between items-center sticky top-0 z-50 backdrop-blur-md">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">STARTUPS 创业公司</h1>
            <div className="flex items-center gap-4">
                <button onClick={() => sendToHost({ type: 'REQUEST_STATE', payload: {} })} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs border border-white/10">🔄 强制同步</button>
                {isHost && !isScoring && !isReadyToScore && <button onClick={handleForceFinish} className="bg-red-900/30 text-red-400 px-3 py-1 rounded text-xs border border-red-500/20">⚠️ 强制结束</button>}
                {isMyTurn && !isScoring && !isReadyToScore && <button onClick={getAdvice} disabled={loadingAdvice} className="bg-indigo-600 px-4 py-1.5 rounded-full text-xs font-bold">{loadingAdvice ? '思考中...' : 'AI 顾问'}</button>}
            </div>
        </header>

        <main className="container mx-auto p-4 max-w-7xl flex flex-col flex-1">
            {isReadyToScore && (
                <div className="w-full bg-blue-900/30 border border-blue-500/30 p-6 rounded-xl text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">牌堆清空，等待结算</h2>
                    <button onClick={handleRevealAndScore} className="bg-blue-500 hover:bg-blue-400 text-white text-lg font-bold px-8 py-3 rounded-full">🔎 开始结算 (亮牌)</button>
                </div>
            )}

            {advice && <div className="mb-8 bg-indigo-950/40 border border-indigo-500/30 p-4 rounded-xl text-sm text-indigo-100">{advice}</div>}

            <Market 
                market={gameState.market}
                deckCount={gameState.deck.length}
                onDrawDeck={handleDrawDeck}
                onTakeMarket={handleTakeMarket}
                canDrawDeck={isMyTurn && gameState.phase === 'DRAW' && canDrawFromDeck(gameState)}
                canTakeMarket={isMyTurn && gameState.phase === 'DRAW' && canDrawFromMarket(gameState)}
                drawCost={gameState.market.filter(item => !currentPlayer.tokens.includes(item.card.type)).length}
                playerTokens={currentPlayer.tokens}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12 mb-8">
                {gameState.players.map(player => (
                    <PlayerBoard
                        key={player.id}
                        player={player}
                        isActive={gameState.currentPlayerIndex === player.id}
                        isLocalPlayer={player.peerId === peerId}
                        canPlay={isMyTurn && gameState.phase === 'PLAY'}
                        onPlayCard={handlePlayCard}
                        targetMode={targetMode}
                        setTargetMode={setTargetMode}
                        revealHands={isScoring} 
                    />
                ))}
            </div>
            
            <div className="mt-auto p-4 bg-slate-950/50 rounded-xl border border-white/5">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">动态日志</h3>
                <div className="h-32 overflow-y-auto text-[10px] font-mono text-slate-400 custom-scrollbar">
                    {gameState.logs.slice().reverse().map((log, i) => <div key={i} className="mb-1">[{gameState.logs.length - i}] {log}</div>)}
                </div>
            </div>
        </main>
      </div>

      {isScoring ? (
          <ScoringSidebar 
              stats={calculateFinalScores(gameState.players)}
              onRestart={handleStartGame}
              onExit={() => setView('LOBBY')}
              isHost={isHost}
          />
      ) : (
          <div className="hidden xl:block w-80 shrink-0 bg-slate-900 border-l border-white/5 p-4 overflow-y-auto">
             <ReferenceGuide />
          </div>
      )}
    </div>
  );
};

export default App;
