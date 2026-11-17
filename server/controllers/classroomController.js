import crypto from 'crypto';
import { ClassroomRoom } from '../models/ClassroomRoom.js';
import { User } from '../models/User.js';
import { createAndSendNotification } from './notificationController.js';

const ROOM_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function nextExpiryDate() {
  return new Date(Date.now() + ROOM_TTL_MS);
}

function resolveCorrectIndex(question) {
  if (!question) return 0;
  const raw = question.correctAnswer;
  const num = Number(raw);
  if (Number.isInteger(num) && num >= 0) return num;
  if (Array.isArray(question.options)) {
    const idx = question.options.findIndex(
      opt => String(opt).trim().toLowerCase() === String(raw ?? '').trim().toLowerCase()
    );
    if (idx >= 0) return idx;
  }
  return 0;
}

function computePoints(questionTimeSec, elapsedMs, isCorrect) {
  if (!isCorrect) return 0;
  const totalMs = Math.max(1000, (Number(questionTimeSec) || 25) * 1000);
  const clampedElapsed = Math.max(0, Math.min(totalMs, elapsedMs));
  const remainingRatio = Math.max(0, 1 - clampedElapsed / totalMs);
  return Math.round(700 + remainingRatio * 300);
}

function getEligiblePlayers(players = []) {
  return players.filter(p => !p.isSpectator);
}

function rebuildTurnOrder(players = []) {
  return getEligiblePlayers(players).map(p => p.id);
}

export function sanitizeRoomForClient(roomDoc) {
  if (!roomDoc) return null;
  const room = typeof roomDoc.toObject === 'function' ? roomDoc.toObject() : roomDoc;
  const revealAnswers = room.gameState === 'reveal' || room.gameState === 'game_over';
  const questions = room.quizData?.questions || [];
  const rawQ = questions[room.currentQuestionIndex] || null;
  const eligible = getEligiblePlayers(room.players || []);
  const submittedIds = (room.submissions || [])
    .filter(s => s.questionIndex === room.currentQuestionIndex)
    .map(s => s.userId);

  const sanitizedPlayers = (room.players || []).map(p => {
    const base = {
      id: p.id,
      name: p.name,
      role: p.role || 'student',
      isHost: Boolean(p.isHost),
      isBot: Boolean(p.isBot),
      isSpectator: Boolean(p.isSpectator),
      score: Number(p.score) || 0,
      streak: Number(p.streak) || 0,
      correctCount: Number(p.correctCount) || 0,
      answeredCount: Number(p.answeredCount) || 0,
      hasSubmitted: Boolean(p.hasSubmitted)
    };
    if (revealAnswers) {
      return {
        ...base,
        lastAnswerCorrect: p.lastAnswerCorrect,
        lastAnswerPoints: Number(p.lastAnswerPoints) || 0,
        lastSelectedOption: typeof p.lastSelectedOption === 'number' ? p.lastSelectedOption : -1,
        lastResponseMs: Number(p.lastResponseMs) || 0
      };
    }
    return base;
  });

  return {
    pin: room.pin,
    hostId: room.hostId,
    hostName: room.hostName,
    hostRole: room.hostRole || 'teacher',
    mode: room.mode || 'turn_based',
    hostParticipates: room.hostParticipates !== false,
    questionTimeSec: room.questionTimeSec || 25,
    quizId: room.quizData?.id || '',
    quizTitle: room.quizData?.title || 'Live Quiz',
    totalQuestions: questions.length,
    gameState: room.gameState || 'lobby',
    currentQuestionIndex: room.currentQuestionIndex || 0,
    questionStartedAt: room.questionStartedAt ? new Date(room.questionStartedAt).toISOString() : null,
    serverNow: new Date().toISOString(),
    currentTurnUserId: room.currentTurnUserId || '',
    turnOrder: room.turnOrder || [],
    players: sanitizedPlayers,
    submittedUserIds: submittedIds,
    submittedCount: submittedIds.length,
    eligibleCount: eligible.length,
    currentQuestion: rawQ
      ? {
          id: rawQ.id ?? room.currentQuestionIndex,
          index: room.currentQuestionIndex,
          question: rawQ.question,
          options: rawQ.options || [],
          codeSnippet: rawQ.codeSnippet || '',
          imageUrl: rawQ.imageUrl || '',
          points: rawQ.points || 10,
          ...(revealAnswers
            ? {
                correctAnswer: resolveCorrectIndex(rawQ),
                explanation: rawQ.explanation || ''
              }
            : {})
        }
      : null,
    lastTurnResult: revealAnswers ? room.lastTurnResult || null : null,
    roundReveal: revealAnswers ? room.roundReveal || null : null,
    version: room.version || 1
  };
}

function broadcastRoom(app, room) {
  const io = app?.get?.('io');
  if (!io || !room?.pin) return;
  const payload = sanitizeRoomForClient(room);
  io.to(`classroom_${room.pin}`).emit('classroom_room_update', payload);
}

function resetQuestionTracking(room) {
  room.submissions = [];
  room.lastTurnResult = null;
  room.roundReveal = null;
  room.players = (room.players || []).map(p => ({
    ...(typeof p.toObject === 'function' ? p.toObject() : p),
    hasSubmitted: false,
    lastAnswerCorrect: undefined,
    lastAnswerPoints: 0,
    lastSelectedOption: -1,
    lastResponseMs: 0
  }));
}

function finalizeSimultaneousRound(room) {
  if (room.gameState !== 'question') return;
  const qIndex = room.currentQuestionIndex || 0;
  const currentQ = (room.quizData?.questions || [])[qIndex];
  const correctIdx = resolveCorrectIndex(currentQ);
  const optionLen = Math.max(4, currentQ?.options?.length || 0);
  const optionCounts = Array(optionLen).fill(0);

  const subByUser = new Map();
  for (const sub of room.submissions || []) {
    if (sub.questionIndex === qIndex) {
      subByUser.set(sub.userId, typeof sub.toObject === 'function' ? sub.toObject() : sub);
    }
  }

  const results = [];
  room.players = (room.players || []).map(rawPlayer => {
    const p = typeof rawPlayer.toObject === 'function' ? rawPlayer.toObject() : { ...rawPlayer };
    if (p.isSpectator) return p;

    const existingSub = subByUser.get(p.id);
    const sub = existingSub || {
      userId: p.id,
      userName: p.name,
      userRole: p.role || 'student',
      questionIndex: qIndex,
      answerIndex: -1,
      isCorrect: false,
      points: 0,
      timeSpentMs: (room.questionTimeSec || 25) * 1000,
      timedOut: true,
      submittedAt: new Date()
    };

    if (typeof sub.answerIndex === 'number' && sub.answerIndex >= 0 && sub.answerIndex < optionCounts.length) {
      optionCounts[sub.answerIndex] += 1;
    }

    results.push({
      userId: sub.userId,
      userName: sub.userName,
      userRole: sub.userRole || p.role || 'student',
      answerIndex: sub.answerIndex,
      isCorrect: Boolean(sub.isCorrect),
      points: Number(sub.points) || 0,
      timeSpentMs: Number(sub.timeSpentMs) || 0,
      timedOut: Boolean(sub.timedOut)
    });

    const isCorrect = Boolean(sub.isCorrect);
    const pts = Number(sub.points) || 0;
    return {
      ...p,
      score: (Number(p.score) || 0) + pts,
      streak: isCorrect ? (Number(p.streak) || 0) + 1 : 0,
      correctCount: (Number(p.correctCount) || 0) + (isCorrect ? 1 : 0),
      answeredCount: (Number(p.answeredCount) || 0) + (sub.timedOut ? 0 : 1),
      hasSubmitted: true,
      lastAnswerCorrect: isCorrect,
      lastAnswerPoints: pts,
      lastSelectedOption: typeof sub.answerIndex === 'number' ? sub.answerIndex : -1,
      lastResponseMs: Number(sub.timeSpentMs) || 0
    };
  });

  // Sort results: correct first, then highest points, then fastest
  results.sort((a, b) => {
    if (a.isCorrect !== b.isCorrect) return a.isCorrect ? -1 : 1;
    if (b.points !== a.points) return b.points - a.points;
    return a.timeSpentMs - b.timeSpentMs;
  });

  room.roundReveal = {
    questionIndex: qIndex,
    correctAnswer: correctIdx,
    optionCounts,
    results
  };
  room.gameState = 'reveal';
}

async function mutateRoomAtomically(pin, mutatorFn, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const doc = await ClassroomRoom.findOne({ pin: String(pin).trim() });
    if (!doc) return { notFound: true };

    const working = doc.toObject();
    const outcome = await mutatorFn(working);
    if (outcome?.abort) {
      return outcome;
    }

    const updated = await ClassroomRoom.findOneAndUpdate(
      { _id: doc._id, version: doc.version },
      {
        $set: {
          mode: working.mode,
          hostParticipates: working.hostParticipates,
          questionTimeSec: working.questionTimeSec,
          gameState: working.gameState,
          currentQuestionIndex: working.currentQuestionIndex,
          questionStartedAt: working.questionStartedAt,
          currentTurnUserId: working.currentTurnUserId,
          turnOrder: working.turnOrder,
          players: working.players,
          submissions: working.submissions,
          lastTurnResult: working.lastTurnResult,
          roundReveal: working.roundReveal,
          expiresAt: nextExpiryDate()
        },
        $inc: { version: 1 }
      },
      { new: true }
    );

    if (updated) {
      return { room: updated, outcome };
    }
  }
  return { conflict: true };
}

export const listActiveRooms = async (req, res) => {
  try {
    const now = new Date();
    const rooms = await ClassroomRoom.find({
      gameState: { $in: ['lobby', 'question', 'reveal'] },
      expiresAt: { $gt: now }
    })
      .sort({ updatedAt: -1 })
      .limit(8)
      .select('pin hostName hostRole mode quizData.title quizData.questions gameState players updatedAt')
      .lean();

    const summaries = rooms.map(r => ({
      pin: r.pin,
      hostName: r.hostName,
      hostRole: r.hostRole || 'teacher',
      mode: r.mode || 'turn_based',
      quizTitle: r.quizData?.title || 'Live Quiz',
      totalQuestions: Array.isArray(r.quizData?.questions) ? r.quizData.questions.length : 0,
      gameState: r.gameState,
      playerCount: Array.isArray(r.players) ? r.players.filter(p => !p.isSpectator).length : 0
    }));

    return res.json({ rooms: summaries });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load active rooms', error: error.message });
  }
};

export const createRoom = async (req, res) => {
  try {
    const {
      hostId,
      hostName,
      hostRole = 'teacher',
      mode = 'turn_based',
      hostParticipates = true,
      questionTimeSec = 25,
      quizData
    } = req.body || {};

    if (!quizData || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      return res.status(400).json({ message: 'Quiz questions are required to host a live classroom' });
    }

    const safeMode = mode === 'simultaneous' ? 'simultaneous' : 'turn_based';
    const safeHostId = String(hostId || req.user?.userId || `host_${crypto.randomBytes(3).toString('hex')}`);
    const safeHostName = String(hostName || 'Host').trim() || 'Host';
    const safeTimer = Math.max(10, Math.min(120, Number(questionTimeSec) || 25));

    let pin = '';
    for (let i = 0; i < 6; i++) {
      const candidate = String(crypto.randomInt(100000, 1000000));
      const exists = await ClassroomRoom.exists({ pin: candidate });
      if (!exists) {
        pin = candidate;
        break;
      }
    }
    if (!pin) {
      pin = String(crypto.randomInt(100000, 1000000));
    }

    const hostPlayer = {
      id: safeHostId,
      name: safeHostName,
      role: hostRole,
      isHost: true,
      isBot: false,
      isSpectator: !hostParticipates,
      score: 0,
      streak: 0,
      correctCount: 0,
      answeredCount: 0,
      hasSubmitted: false
    };

    const sanitizedQuestions = quizData.questions.map((q, idx) => ({
      id: q.id ?? idx,
      question: q.question,
      options: Array.isArray(q.options) ? q.options : [],
      codeSnippet: q.codeSnippet || '',
      imageUrl: q.imageUrl || '',
      correctAnswer: q.correctAnswer,
      points: Number(q.points) || 10,
      explanation: q.explanation || ''
    }));

    const room = await ClassroomRoom.create({
      pin,
      hostId: safeHostId,
      hostName: safeHostName,
      hostRole,
      mode: safeMode,
      hostParticipates: Boolean(hostParticipates),
      questionTimeSec: safeTimer,
      quizData: {
        id: String(quizData.id || quizData._id || ''),
        title: String(quizData.title || 'Live Classroom Quiz'),
        totalQuestions: sanitizedQuestions.length,
        questions: sanitizedQuestions
      },
      gameState: 'lobby',
      currentQuestionIndex: 0,
      currentTurnUserId: hostParticipates ? safeHostId : '',
      turnOrder: hostParticipates ? [safeHostId] : [],
      players: [hostPlayer],
      submissions: [],
      version: 1,
      expiresAt: nextExpiryDate()
    });

    broadcastRoom(req.app, room);
    return res.status(201).json({ room: sanitizeRoomForClient(room) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create classroom room', error: error.message });
  }
};

export const joinRoom = async (req, res) => {
  try {
    const { pin } = req.params;
    const { userId, name, role = 'student' } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ message: 'Player name is required to join' });
    }

    const cleanId = String(userId || `guest_${crypto.randomBytes(4).toString('hex')}`);

    const result = await mutateRoomAtomically(pin, (room) => {
      const existingIdx = room.players.findIndex(p => p.id === cleanId);
      if (existingIdx >= 0) {
        room.players[existingIdx].name = cleanName;
        if (role) room.players[existingIdx].role = role;
      } else {
        room.players.push({
          id: cleanId,
          name: cleanName,
          role: role || 'student',
          isHost: cleanId === room.hostId,
          isBot: false,
          isSpectator: cleanId === room.hostId ? !room.hostParticipates : false,
          score: 0,
          streak: 0,
          correctCount: 0,
          answeredCount: 0,
          hasSubmitted: false,
          joinedAt: new Date()
        });
      }

      room.turnOrder = rebuildTurnOrder(room.players);
      if (!room.currentTurnUserId || !room.turnOrder.includes(room.currentTurnUserId)) {
        room.currentTurnUserId = room.turnOrder[0] || '';
      }
    });

    if (result.notFound) {
      return res.status(404).json({ message: 'Classroom PIN not found or expired' });
    }
    if (result.conflict) {
      return res.status(409).json({ message: 'Room is busy, please retry joining' });
    }

    broadcastRoom(req.app, result.room);
    return res.json({ room: sanitizeRoomForClient(result.room), joinedUserId: cleanId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to join classroom room', error: error.message });
  }
};

export const getRoomState = async (req, res) => {
  try {
    const { pin } = req.params;
    const clientVersion = Number(req.query.version || 0);

    const room = await ClassroomRoom.findOne({ pin: String(pin).trim() }).lean();
    if (!room) {
      return res.status(404).json({ message: 'Classroom room closed or expired' });
    }

    if (clientVersion && room.version === clientVersion) {
      return res.json({ unchanged: true, version: room.version, serverNow: new Date().toISOString() });
    }

    return res.json({ room: sanitizeRoomForClient(room) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch classroom state', error: error.message });
  }
};

export const updateRoomSettings = async (req, res) => {
  try {
    const { pin } = req.params;
    const { mode, hostParticipates, questionTimeSec } = req.body || {};

    const result = await mutateRoomAtomically(pin, (room) => {
      if (mode === 'turn_based' || mode === 'simultaneous') {
        room.mode = mode;
      }
      if (typeof hostParticipates === 'boolean') {
        room.hostParticipates = hostParticipates;
        room.players = room.players.map(p =>
          p.isHost || p.id === room.hostId
            ? { ...p, isSpectator: !hostParticipates }
            : p
        );
      }
      if (questionTimeSec !== undefined) {
        room.questionTimeSec = Math.max(10, Math.min(120, Number(questionTimeSec) || 25));
      }
      room.turnOrder = rebuildTurnOrder(room.players);
      if (!room.currentTurnUserId || !room.turnOrder.includes(room.currentTurnUserId)) {
        room.currentTurnUserId = room.turnOrder[0] || '';
      }
    });

    if (result.notFound) return res.status(404).json({ message: 'Classroom room not found' });
    if (result.conflict) return res.status(409).json({ message: 'Please retry settings update' });

    broadcastRoom(req.app, result.room);
    return res.json({ room: sanitizeRoomForClient(result.room) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update classroom settings', error: error.message });
  }
};

export const togglePracticeBot = async (req, res) => {
  try {
    const { pin } = req.params;
    const { action = 'add', botId } = req.body || {};

    const result = await mutateRoomAtomically(pin, (room) => {
      if (action === 'remove') {
        room.players = room.players.filter(p => !(p.isBot && (!botId || p.id === botId)));
      } else {
        const existingBots = room.players.filter(p => p.isBot).length;
        const botNames = ['Alex (Practice Student)', 'Maya (Practice Student)', 'Omar (Practice Student)'];
        const chosenName = botNames[existingBots % botNames.length];
        const newBotId = `bot_${crypto.randomBytes(3).toString('hex')}`;
        room.players.push({
          id: newBotId,
          name: chosenName,
          role: 'student',
          isHost: false,
          isBot: true,
          isSpectator: false,
          score: 0,
          streak: 0,
          correctCount: 0,
          answeredCount: 0,
          hasSubmitted: false,
          joinedAt: new Date()
        });
      }
      room.turnOrder = rebuildTurnOrder(room.players);
      if (!room.currentTurnUserId || !room.turnOrder.includes(room.currentTurnUserId)) {
        room.currentTurnUserId = room.turnOrder[0] || '';
      }
    });

    if (result.notFound) return res.status(404).json({ message: 'Classroom room not found' });
    if (result.conflict) return res.status(409).json({ message: 'Please retry' });

    broadcastRoom(req.app, result.room);
    return res.json({ room: sanitizeRoomForClient(result.room) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update practice student', error: error.message });
  }
};

export const startRoom = async (req, res) => {
  try {
    const { pin } = req.params;
    const { mode, hostParticipates } = req.body || {};

    const result = await mutateRoomAtomically(pin, (room) => {
      if (mode === 'turn_based' || mode === 'simultaneous') {
        room.mode = mode;
      }
      if (typeof hostParticipates === 'boolean') {
        room.hostParticipates = hostParticipates;
      }

      // Reset scores for fresh start or rematch
      room.players = room.players.map(p => ({
        ...p,
        isSpectator: (p.isHost || p.id === room.hostId) ? !room.hostParticipates : false,
        score: 0,
        streak: 0,
        correctCount: 0,
        answeredCount: 0,
        hasSubmitted: false,
        lastAnswerCorrect: undefined,
        lastAnswerPoints: 0,
        lastSelectedOption: -1,
        lastResponseMs: 0
      }));

      room.turnOrder = rebuildTurnOrder(room.players);
      if (room.turnOrder.length === 0) {
        return { abort: true, status: 400, message: 'At least one active participant is needed before starting.' };
      }

      room.currentQuestionIndex = 0;
      room.currentTurnUserId = room.turnOrder[0];
      room.questionStartedAt = new Date();
      room.submissions = [];
      room.lastTurnResult = null;
      room.roundReveal = null;
      room.gameState = 'question';
    });

    if (result.abort) return res.status(result.status || 400).json({ message: result.message });
    if (result.notFound) return res.status(404).json({ message: 'Classroom room not found' });
    if (result.conflict) return res.status(409).json({ message: 'Could not start room, please retry' });

    broadcastRoom(req.app, result.room);
    return res.json({ room: sanitizeRoomForClient(result.room) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to start classroom session', error: error.message });
  }
};

export const submitAnswer = async (req, res) => {
  try {
    const { pin } = req.params;
    const { userId, questionIndex, answerIndex, timedOut = false, autoAnswer = false } = req.body || {};
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const result = await mutateRoomAtomically(pin, (room) => {
      if (room.gameState !== 'question') {
        // Idempotent: return current state if already revealed
        return { noChange: true };
      }

      const activeQIndex = room.currentQuestionIndex || 0;
      if (typeof questionIndex === 'number' && questionIndex !== activeQIndex) {
        return { noChange: true };
      }

      const currentQ = (room.quizData?.questions || [])[activeQIndex];
      if (!currentQ) {
        return { abort: true, status: 400, message: 'Current question not found' };
      }

      const playerIdx = room.players.findIndex(p => p.id === userId);
      if (playerIdx === -1) {
        return { abort: true, status: 404, message: 'Participant not found in this room' };
      }
      const player = room.players[playerIdx];
      if (player.isSpectator) {
        return { abort: true, status: 403, message: 'Spectators cannot submit answers' };
      }

      const correctIdx = resolveCorrectIndex(currentQ);
      let numericAnswer = Number(answerIndex);
      if (autoAnswer && player.isBot) {
        const optLen = Array.isArray(currentQ.options) && currentQ.options.length > 0 ? currentQ.options.length : 4;
        const pickRight = Math.random() < 0.72;
        numericAnswer = pickRight
          ? correctIdx
          : (correctIdx + 1 + Math.floor(Math.random() * Math.max(1, optLen - 1))) % optLen;
      }
      const isCorrect = !timedOut && numericAnswer === correctIdx;
      const startedMs = room.questionStartedAt ? new Date(room.questionStartedAt).getTime() : Date.now();
      const elapsedMs = Math.max(0, Date.now() - startedMs);
      const points = computePoints(room.questionTimeSec, elapsedMs, isCorrect);

      if (room.mode === 'turn_based') {
        if (room.currentTurnUserId && room.currentTurnUserId !== userId) {
          return { abort: true, status: 409, message: 'It is another player\'s turn right now' };
        }

        room.players[playerIdx] = {
          ...player,
          score: (Number(player.score) || 0) + points,
          streak: isCorrect ? (Number(player.streak) || 0) + 1 : 0,
          correctCount: (Number(player.correctCount) || 0) + (isCorrect ? 1 : 0),
          answeredCount: (Number(player.answeredCount) || 0) + (timedOut ? 0 : 1),
          hasSubmitted: true,
          lastAnswerCorrect: isCorrect,
          lastAnswerPoints: points,
          lastSelectedOption: timedOut ? -1 : numericAnswer,
          lastResponseMs: elapsedMs
        };

        room.lastTurnResult = {
          playerId: player.id,
          playerName: player.name,
          userRole: player.role || 'student',
          questionIndex: activeQIndex,
          answerIndex: timedOut ? -1 : numericAnswer,
          isCorrect,
          points,
          timeSpentMs: elapsedMs,
          timedOut: Boolean(timedOut)
        };
        room.gameState = 'reveal';
        return;
      }

      // Simultaneous mode ("Everyone Answers"): record individual submission cleanly
      const alreadySubmitted = (room.submissions || []).some(
        s => s.questionIndex === activeQIndex && s.userId === userId
      );
      if (alreadySubmitted) {
        return { noChange: true };
      }

      room.submissions.push({
        userId: player.id,
        userName: player.name,
        userRole: player.role || 'student',
        questionIndex: activeQIndex,
        answerIndex: timedOut ? -1 : numericAnswer,
        isCorrect,
        points,
        timeSpentMs: elapsedMs,
        timedOut: Boolean(timedOut),
        submittedAt: new Date()
      });
      room.players[playerIdx] = {
        ...player,
        hasSubmitted: true
      };

      // Check if ALL eligible non-spectating participants have submitted!
      const eligibleIds = getEligiblePlayers(room.players).map(p => p.id);
      const submittedSet = new Set(
        room.submissions.filter(s => s.questionIndex === activeQIndex).map(s => s.userId)
      );
      const everyoneSubmitted = eligibleIds.length > 0 && eligibleIds.every(id => submittedSet.has(id));

      if (everyoneSubmitted) {
        finalizeSimultaneousRound(room);
      }
    });

    if (result.abort) return res.status(result.status || 400).json({ message: result.message });
    if (result.notFound) return res.status(404).json({ message: 'Classroom room not found' });
    if (result.conflict) return res.status(409).json({ message: 'Submission conflict, please try again' });

    broadcastRoom(req.app, result.room);
    return res.json({ room: sanitizeRoomForClient(result.room) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit answer', error: error.message });
  }
};

export const revealQuestion = async (req, res) => {
  try {
    const { pin } = req.params;

    const result = await mutateRoomAtomically(pin, (room) => {
      if (room.gameState !== 'question') {
        return { noChange: true };
      }

      if (room.mode === 'simultaneous') {
        finalizeSimultaneousRound(room);
      } else {
        const activeId = room.currentTurnUserId;
        const player = room.players.find(p => p.id === activeId);
        if (player) {
          room.lastTurnResult = {
            playerId: player.id,
            playerName: player.name,
            userRole: player.role || 'student',
            questionIndex: room.currentQuestionIndex || 0,
            answerIndex: -1,
            isCorrect: false,
            points: 0,
            timeSpentMs: (room.questionTimeSec || 25) * 1000,
            timedOut: true
          };
          room.players = room.players.map(p =>
            p.id === activeId
              ? { ...p, streak: 0, hasSubmitted: true, lastAnswerCorrect: false, lastAnswerPoints: 0, lastSelectedOption: -1 }
              : p
          );
        }
        room.gameState = 'reveal';
      }
    });

    if (result.notFound) return res.status(404).json({ message: 'Classroom room not found' });
    if (result.conflict) return res.status(409).json({ message: 'Could not reveal question, please retry' });

    broadcastRoom(req.app, result.room);
    return res.json({ room: sanitizeRoomForClient(result.room) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reveal question results', error: error.message });
  }
};

export const nextQuestion = async (req, res) => {
  try {
    const { pin } = req.params;

    const result = await mutateRoomAtomically(pin, (room) => {
      const totalQuestions = room.quizData?.questions?.length || 0;
      const nextIdx = (room.currentQuestionIndex || 0) + 1;

      if (nextIdx >= totalQuestions) {
        room.gameState = 'game_over';
        return;
      }

      room.turnOrder = rebuildTurnOrder(room.players);
      if (room.mode === 'turn_based' && room.turnOrder.length > 0) {
        const curPos = room.turnOrder.indexOf(room.currentTurnUserId);
        room.currentTurnUserId = room.turnOrder[(curPos + 1) % room.turnOrder.length];
      }

      room.currentQuestionIndex = nextIdx;
      room.questionStartedAt = new Date();
      resetQuestionTracking(room);
      room.gameState = 'question';
    });

    if (result.notFound) return res.status(404).json({ message: 'Classroom room not found' });
    if (result.conflict) return res.status(409).json({ message: 'Please retry advancing turn' });

    broadcastRoom(req.app, result.room);
    return res.json({ room: sanitizeRoomForClient(result.room) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to advance classroom question', error: error.message });
  }
};

export const inviteToRoom = async (req, res) => {
  try {
    const { pin } = req.params;
    const { toUserId, fromUser, quizTitle } = req.body || {};
    if (!toUserId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    const senderName = fromUser?.name || 'Your Teacher';
    const roomTitle = quizTitle || 'Live Classroom Session';
    const inviteLink = `/classroom?pin=${encodeURIComponent(pin)}`;

    const io = req.app?.get?.('io');
    if (io) {
      io.to(toUserId).emit('classroom_invite_received', {
        fromUser: { id: fromUser?.id || '', name: senderName },
        pin,
        quizTitle: roomTitle,
        timestamp: Date.now()
      });
    }

    const targetExists = await User.exists({ userId: toUserId });
    if (targetExists) {
      await createAndSendNotification(req.app, {
        recipientId: toUserId,
        senderId: fromUser?.id || 'system',
        senderName,
        type: 'challenge',
        title: `🎮 Live Classroom Invite (${pin})`,
        message: `${senderName} invited you to join "${roomTitle}" live! Room PIN: ${pin}`,
        link: inviteLink,
        metadata: { pin, quizTitle: roomTitle }
      });
    }

    return res.json({ success: true, message: 'Invitation sent' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to invite user', error: error.message });
  }
};

export const leaveRoom = async (req, res) => {
  try {
    const { pin } = req.params;
    const { userId } = req.body || {};
    if (!userId) return res.json({ success: true });

    const result = await mutateRoomAtomically(pin, (room) => {
      room.players = room.players.filter(p => p.id !== userId);
      room.submissions = (room.submissions || []).filter(s => s.userId !== userId);
      room.turnOrder = rebuildTurnOrder(room.players);
      if (room.currentTurnUserId === userId) {
        room.currentTurnUserId = room.turnOrder[0] || '';
      }
    });

    if (!result.notFound && result.room) {
      broadcastRoom(req.app, result.room);
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to leave classroom room', error: error.message });
  }
};

export const closeRoom = async (req, res) => {
  try {
    const { pin } = req.params;
    const cleanPin = String(pin).trim();
    await ClassroomRoom.deleteOne({ pin: cleanPin });
    const io = req.app?.get?.('io');
    if (io) {
      io.to(`classroom_${cleanPin}`).emit('classroom_room_closed', { pin: cleanPin });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to close classroom room', error: error.message });
  }
};
