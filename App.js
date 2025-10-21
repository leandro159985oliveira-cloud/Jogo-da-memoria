import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ImageBackground } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

// ========== TEMAS DE EMOJIS ==========
const THEMES = {
  jogos: ['🎮', '🎯', '🎲', '🎪', '🎭', '🎨', '🎸', '🎺', '🎹', '🎤', '🎧', '🎬', '🕹️', '👾', '🎰', '🃏'],
  animais: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔'],
  comida: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐', '🥨', '🥯'],
  esportes: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍'],
  natureza: ['🌳', '🌲', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🌺', '🌻', '🌼', '🌷', '🌹'],
  transporte: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛵', '🏍️', '🚲'],
  entretenimento: ['🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '🎯'],
  objetos: ['📱', '💻', '⌚', '📷', '📹', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '⏰', '🕰️', '⏱️', '⏲️'],
  formas: ['⭐', '✨', '💫', '🌟', '⚡', '🔥', '💧', '🌊', '❄️', '☀️', '🌙', '⭐', '🌈', '☁️', '⛅', '🌤️']
};

// ========== FUNÇÃO PARA OBTER EMOJIS POR FASE ==========
const getEmojisForLevel = (level) => {
  const pairs = Math.ceil(level / 10) + 5;
  const actualPairs = Math.min(pairs, 16);
  
  const shouldMixThemes = level > 40;
  const themeKeys = Object.keys(THEMES);
  
  let selectedEmojis = [];
  
  if (shouldMixThemes) {
    const shuffledThemes = [...themeKeys].sort(() => Math.random() - 0.5);
    for (let theme of shuffledThemes) {
      selectedEmojis.push(...THEMES[theme]);
      if (selectedEmojis.length >= actualPairs) break;
    }
  } else {
    const themeIndex = Math.floor((level - 1) / 10) % themeKeys.length;
    selectedEmojis = [...THEMES[themeKeys[themeIndex]]];
  }
  
  return selectedEmojis.slice(0, actualPairs);
};

// ========== COMPONENTE: TELA INICIAL ==========
const TelaInicial = ({ onNavigate, hasSavedGame }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🧠</Text>
      <Text style={styles.title}>Jogo da Memoria</Text>
      
      {hasSavedGame && (
        <TouchableOpacity style={styles.btnPrimary} onPress={() => onNavigate('resumeGame')}>
          <Text style={styles.btnText}>▶️ Continuar Jogo</Text>
        </TouchableOpacity>
      )}
      
      <TouchableOpacity style={hasSavedGame ? styles.btnSecondary : styles.btnPrimary} onPress={() => onNavigate('game')}>
        <Text style={styles.btnText}>🆕 Novo Jogo</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.btnSecondary} onPress={() => onNavigate('levels')}>
        <Text style={styles.btnText}>📋 Seleção de Fases</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.btnSecondary} onPress={() => onNavigate('stats')}>
        <Text style={styles.btnText}>📊 Histórico</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.btnSecondary} onPress={() => onNavigate('settings')}>
        <Text style={styles.btnText}>⚙️ Configurações</Text>
      </TouchableOpacity>
    </View>
  );
};

// ========== COMPONENTE: TELA DE FASES ==========
const TelaFases = ({ onNavigate, progress }) => {
  const visibleLevels = Math.min(progress.currentLevel + 5, 100);
  
  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>📋 Seleção de Fases</Text>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.levelsGrid}>
        {[...Array(visibleLevels)].map((_, i) => {
          const level = i + 1;
          const unlocked = level <= (progress.currentLevel || 1);
          const stars = progress.stars[level] || 0;
          
          return (
            <TouchableOpacity 
              key={level}
              style={[styles.levelCard, !unlocked && styles.levelLocked]}
              onPress={() => unlocked && onNavigate('game', level)}
              disabled={!unlocked}
            >
              <Text style={styles.levelNumber}>{unlocked ? level : '🔒'}</Text>
              {unlocked && stars > 0 && (
                <Text style={styles.levelStars}>{'⭐'.repeat(stars)}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      <TouchableOpacity style={styles.btnBack} onPress={() => onNavigate('home')}>
        <Text style={styles.btnText}>◀️ Voltar</Text>
      </TouchableOpacity>
    </View>
  );
};

// ========== COMPONENTE: TELA DO JOGO ==========
const TelaJogo = ({ onNavigate, level, onComplete, onSaveGame, savedGameState, soundEnabled }) => {
  const emojis = getEmojisForLevel(level);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [points, setPoints] = useState(0);
  const [canFlip, setCanFlip] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [timer, setTimer] = useState(null);
  const [lives, setLives] = useState(3);
  const [showMemorization, setShowMemorization] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  
  const soundFlip = useRef(null);
  const soundMatch = useRef(null);
  const soundComplete = useRef(null);

  useEffect(() => {
    loadSounds();
    return () => {
      if (soundFlip.current) soundFlip.current.unloadAsync();
      if (soundMatch.current) soundMatch.current.unloadAsync();
      if (soundComplete.current) soundComplete.current.unloadAsync();
    };
  }, []);

  const loadSounds = async () => {
    try {
      const { sound: flip } = await Audio.Sound.createAsync(
        { uri: 'https://cdn.freesound.org/previews/171/171671_2437358-lq.mp3' }
      );
      const { sound: match } = await Audio.Sound.createAsync(
        { uri: 'https://cdn.freesound.org/previews/341/341695_5121236-lq.mp3' }
      );
      const { sound: complete } = await Audio.Sound.createAsync(
        { uri: 'https://cdn.freesound.org/previews/270/270404_5123851-lq.mp3' }
      );
      
      soundFlip.current = flip;
      soundMatch.current = match;
      soundComplete.current = complete;
    } catch (error) {
      console.log('Erro ao carregar sons:', error);
    }
  };

  const playSound = async (sound) => {
    if (soundEnabled && sound) {
      try {
        await sound.replayAsync();
      } catch (error) {
        console.log('Erro ao tocar som:', error);
      }
    }
  };

  useEffect(() => {
    if (savedGameState && savedGameState.level === level) {
      setCards(savedGameState.cards);
      setFlipped(savedGameState.flipped);
      setMatched(savedGameState.matched);
      setMoves(savedGameState.moves);
      setPoints(savedGameState.points);
      setCanFlip(true);
    } else {
      initGame();
    }
  }, [level]);

  useEffect(() => {
    if (cards.length > 0) {
      onSaveGame({
        level,
        cards,
        flipped,
        matched,
        moves,
        points
      });
    }
  }, [cards, flipped, matched, moves, points]);

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0) {
      const interval = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (timeLeft === 0) {
      handleGameOver();
    }
  }, [timeLeft]);

  const initGame = () => {
    const shuffled = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({ id: index, emoji }));
    
    setCards(shuffled);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setPoints(0);
    setLives(3);
    setTimeLeft(null);
    
    if (shuffled.length >= 28) {
      setShowMemorization(true);
      setFlipped(shuffled.map(c => c.id));
      setTimeout(() => {
        setFlipped([]);
        setShowMemorization(false);
        setCanFlip(true);
      }, 3000);
    } else {
      setCanFlip(true);
    }
  };

  const handleGameOver = () => {
    alert('Tempo esgotado! Você perdeu uma vida.');
    const newLives = lives - 1;
    setLives(newLives);
    
    if (newLives === 0) {
      alert('Game Over! Voltando ao menu...');
      onNavigate('home');
    } else {
      initGame();
    }
  };

  const handleCardPress = (id) => {
    if (!canFlip || flipped.includes(id) || matched.includes(id)) return;

    playSound(soundFlip.current);
    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setCanFlip(false);
      setMoves(moves + 1);

      const [first, second] = newFlipped;
      const firstCard = cards.find(card => card.id === first);
      const secondCard = cards.find(card => card.id === second);

      if (firstCard.emoji === secondCard.emoji) {
        playSound(soundMatch.current);
        setMatched([...matched, first, second]);
        setPoints(points + 100);
        setFlipped([]);
        setCanFlip(true);

        if (matched.length + 2 === cards.length) {
          const stars = getStars();
          playSound(soundComplete.current);
          setTimeout(() => {
            onComplete(level, stars, points + 100, moves + 1);
          }, 500);
        }
      } else {
        if (moves >= 10 && timeLeft === null) {
          const timeLimit = getTimeLimit(cards.length);
          setTimeLeft(timeLimit);
        }
        
        setTimeout(() => {
          setFlipped([]);
          setCanFlip(true);
        }, 1000);
      }
    }
  };

  const getTimeLimit = (numCards) => {
    if (numCards <= 12) return 60;
    if (numCards <= 16) return 90;
    if (numCards <= 20) return 120;
    if (numCards <= 24) return 150;
    if (numCards <= 28) return 180;
    return 210;
  };

  const getStars = () => {
    if (moves < 15) return 3;
    if (moves < 25) return 2;
    return 1;
  };

  return (
    <View style={styles.container}>
      <View style={styles.gameHeader}>
        <Text style={styles.gameInfo}>Fase: {level}</Text>
        <Text style={styles.gameInfo}>Pontos: {points}</Text>
        <Text style={styles.gameInfo}>Jogadas: {moves}</Text>
        {timeLeft !== null && (
          <Text style={[styles.gameInfo, timeLeft < 10 && styles.timeWarning]}>
            ⏰ {timeLeft}s
          </Text>
        )}
        <Text style={styles.gameInfo}>❤️ {lives}</Text>
        <TouchableOpacity onPress={() => setShowPause(true)}>
          <Text style={styles.pauseBtn}>⏸️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.starsPreview}>
        <Text style={styles.starsText}>{'⭐'.repeat(getStars())}{'☆'.repeat(3 - getStars())}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.board}>
        {cards.map(card => {
          const isFlipped = flipped.includes(card.id) || matched.includes(card.id);
          return (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.card,
                isFlipped && styles.cardFlipped,
                matched.includes(card.id) && styles.cardMatched
              ]}
              onPress={() => handleCardPress(card.id)}
            >
              <Text style={styles.cardText}>
                {isFlipped ? card.emoji : '❓'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={showPause} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⏸️ Pausado</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowPause(false)}>
              <Text style={styles.btnText}>Continuar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => { setShowPause(false); initGame(); }}>
              <Text style={styles.btnText}>Reiniciar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => { setShowPause(false); onNavigate('home'); }}>
              <Text style={styles.btnText}>Sair (Progresso Salvo)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ========== COMPONENTE: TELA DE VITÓRIA ==========
const TelaVitoria = ({ onNavigate, level, stars, points, moves, onClearSavedGame }) => {
  useEffect(() => {
    onClearSavedGame();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🏆</Text>
      <Text style={styles.title}>Parabéns!</Text>
      
      <View style={styles.resultCard}>
        <Text style={styles.resultStars}>{'⭐'.repeat(stars)}</Text>
        <Text style={styles.resultText}>Fase {level} Concluída!</Text>
        <Text style={styles.resultDetail}>Pontos: {points}</Text>
        <Text style={styles.resultDetail}>Jogadas: {moves}</Text>
      </View>
      
      <TouchableOpacity style={styles.btnPrimary} onPress={() => onNavigate('game', level + 1)}>
        <Text style={styles.btnText}>➡️ Próxima Fase</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.btnSecondary} onPress={() => onNavigate('game', level)}>
        <Text style={styles.btnText}>🔄 Repetir</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.btnSecondary} onPress={() => onNavigate('home')}>
        <Text style={styles.btnText}>🏠 Menu</Text>
      </TouchableOpacity>
    </View>
  );
};

// ========== COMPONENTE: HISTÓRICO ==========
const TelaHistorico = ({ onNavigate, progress }) => {
  const totalStars = Object.values(progress.stars).reduce((a, b) => a + b, 0);
  
  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>📊 Histórico</Text>
      
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Estatísticas Gerais</Text>
        <Text style={styles.statsText}>Fase Atual: {progress.currentLevel || 1}</Text>
        <Text style={styles.statsText}>Total de Estrelas: {totalStars}/300 ⭐</Text>
        <Text style={styles.statsText}>Fases Completas: {Object.keys(progress.stars).length}/100</Text>
      </View>
      
      <ScrollView style={styles.scrollView}>
        {Object.entries(progress.stars).map(([level, stars]) => (
          <View key={level} style={styles.historyItem}>
            <Text style={styles.historyLevel}>Fase {level}</Text>
            <Text style={styles.historyStars}>{'⭐'.repeat(stars)}</Text>
          </View>
        ))}
      </ScrollView>
      
      <TouchableOpacity style={styles.btnBack} onPress={() => onNavigate('home')}>
        <Text style={styles.btnText}>◀️ Voltar</Text>
      </TouchableOpacity>
    </View>
  );
};

// ========== COMPONENTE: CONFIGURAÇÕES ==========
const TelaConfig = ({ onNavigate, onReset, soundEnabled, onToggleSound }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>⚙️ Configurações</Text>
      
      <View style={styles.configCard}>
        <TouchableOpacity style={styles.configItem} onPress={onToggleSound}>
          <Text style={styles.configText}>🔊 Som</Text>
          <Text style={styles.configValue}>{soundEnabled ? 'Ligado' : 'Desligado'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.configItem, styles.dangerItem]} onPress={onReset}>
          <Text style={[styles.configText, styles.dangerText]}>🔄 Resetar Progresso</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.credits}>
        <Text style={styles.creditsText}>Desenvolvido com ❤️</Text>
      </View>
      
      <TouchableOpacity style={styles.btnBack} onPress={() => onNavigate('home')}>
        <Text style={styles.btnText}>◀️ Voltar</Text>
      </TouchableOpacity>
    </View>
  );
};

// ========== APP PRINCIPAL ==========
export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [progress, setProgress] = useState({ currentLevel: 1, stars: {} });
  const [victoryData, setVictoryData] = useState(null);
  const [savedGameState, setSavedGameState] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const saved = await AsyncStorage.getItem('gameProgress');
      if (saved) {
        setProgress(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Erro ao carregar progresso:', error);
    }
  };

  const saveProgress = async (newProgress) => {
    try {
      await AsyncStorage.setItem('gameProgress', JSON.stringify(newProgress));
      setProgress(newProgress);
    } catch (error) {
      console.log('Erro ao salvar progresso:', error);
    }
  };

  const navigate = (screen, level = null) => {
    if (screen === 'resumeGame' && savedGameState) {
      setCurrentLevel(savedGameState.level);
      setCurrentScreen('game');
    } else if (screen === 'game' && level) {
      setCurrentLevel(level);
      setSavedGameState(null);
      setCurrentScreen('game');
    } else if (screen === 'game') {
      setCurrentLevel(progress.currentLevel || 1);
      setSavedGameState(null);
      setCurrentScreen('game');
    } else {
      setCurrentScreen(screen);
      if (level) setCurrentLevel(level);
    }
  };

  const handleSaveGame = (gameState) => {
    setSavedGameState(gameState);
  };

  const handleClearSavedGame = () => {
    setSavedGameState(null);
  };

  const handleComplete = (level, stars, points, moves) => {
    const newProgress = { ...progress };
    newProgress.stars[level] = Math.max(stars, newProgress.stars[level] || 0);
    if (level >= newProgress.currentLevel) {
      newProgress.currentLevel = level + 1;
    }
    saveProgress(newProgress);
    setVictoryData({ level, stars, points, moves });
    setCurrentScreen('victory');
  };

  const handleReset = async () => {
    if (confirm('Tem certeza que deseja resetar todo o progresso?')) {
      await AsyncStorage.removeItem('gameProgress');
      setProgress({ currentLevel: 1, stars: {} });
      setSavedGameState(null);
      setCurrentLevel(1);
      navigate('home');
    }
  };

  const handleToggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  return (
    <>
      {currentScreen === 'home' && <TelaInicial onNavigate={navigate} hasSavedGame={savedGameState !== null} />}
      {currentScreen === 'levels' && <TelaFases onNavigate={navigate} progress={progress} />}
      {currentScreen === 'game' && <TelaJogo onNavigate={navigate} level={currentLevel} onComplete={handleComplete} onSaveGame={handleSaveGame} savedGameState={savedGameState} soundEnabled={soundEnabled} />}
      {currentScreen === 'victory' && victoryData && <TelaVitoria onNavigate={navigate} {...victoryData} onClearSavedGame={handleClearSavedGame} />}
      {currentScreen === 'stats' && <TelaHistorico onNavigate={navigate} progress={progress} />}
      {currentScreen === 'settings' && <TelaConfig onNavigate={navigate} onReset={handleReset} soundEnabled={soundEnabled} onToggleSound={handleToggleSound} />}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 40,
  },
  btnPrimary: {
    backgroundColor: '#16db93',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginVertical: 8,
    width: 280,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: '#0f3460',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginVertical: 8,
    width: 280,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#16db93',
  },
  btnBack: {
    backgroundColor: '#e94560',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 20,
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    marginTop: 40,
  },
  scrollView: {
    width: '100%',
    flex: 1,
  },
  levelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  levelCard: {
    width: 70,
    height: 70,
    backgroundColor: '#16db93',
    margin: 5,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0db574',
  },
  levelLocked: {
    backgroundColor: '#0f3460',
    borderColor: '#16213e',
  },
  levelNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  levelStars: {
    fontSize: 12,
    marginTop: 2,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 10,
    marginTop: 40,
    flexWrap: 'wrap',
  },
  gameInfo: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 5,
  },
  timeWarning: {
    color: '#e94560',
    fontWeight: 'bold',
  },
  pauseBtn: {
    fontSize: 24,
  },
  starsPreview: {
    marginBottom: 15,
  },
  starsText: {
    fontSize: 24,
  },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 350,
    paddingBottom: 20,
  },
  card: {
    width: 70,
    height: 70,
    backgroundColor: '#0f3460',
    margin: 5,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#16213e',
  },
  cardFlipped: {
    backgroundColor: '#16db93',
    borderColor: '#0db574',
  },
  cardMatched: {
    backgroundColor: '#feca57',
    borderColor: '#ff9f43',
  },
  cardText: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#16db93',
  },
  modalTitle: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 30,
  },
  resultCard: {
    backgroundColor: '#0f3460',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 3,
    borderColor: '#16db93',
  },
  resultStars: {
    fontSize: 50,
    marginBottom: 20,
  },
  resultText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 15,
  },
  resultDetail: {
    fontSize: 18,
    color: '#16db93',
    marginVertical: 5,
  },
  statsCard: {
    backgroundColor: '#0f3460',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#16db93',
  },
  statsTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 15,
  },
  statsText: {
    fontSize: 16,
    color: '#16db93',
    marginVertical: 5,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0f3460',
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#16213e',
  },
  historyLevel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyStars: {
    fontSize: 16,
  },
  configCard: {
    backgroundColor: '#0f3460',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#16db93',
  },
  configItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#16213e',
  },
  configText: {
    color: '#fff',
    fontSize: 16,
  },
  configValue: {
    color: '#16db93',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerItem: {
    borderBottomWidth: 0,
    marginTop: 10,
  },
  dangerText: {
    color: '#e94560',
  },
  credits: {
    marginTop: 20,
  },
  creditsText: {
    color: '#888',
    fontSize: 14,
  },
});