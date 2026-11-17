import mongoose from 'mongoose';

const classroomPlayerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, default: 'student' },
  isHost: { type: Boolean, default: false },
  isBot: { type: Boolean, default: false },
  isSpectator: { type: Boolean, default: false },
  score: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  answeredCount: { type: Number, default: 0 },
  hasSubmitted: { type: Boolean, default: false },
  lastAnswerCorrect: { type: Boolean, default: undefined },
  lastAnswerPoints: { type: Number, default: 0 },
  lastSelectedOption: { type: Number, default: -1 },
  lastResponseMs: { type: Number, default: 0 },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const classroomSubmissionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userRole: { type: String, default: 'student' },
  questionIndex: { type: Number, required: true },
  answerIndex: { type: Number, default: -1 },
  isCorrect: { type: Boolean, default: false },
  points: { type: Number, default: 0 },
  timeSpentMs: { type: Number, default: 0 },
  timedOut: { type: Boolean, default: false },
  submittedAt: { type: Date, default: Date.now }
}, { _id: false });

const classroomQuestionSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.Mixed },
  question: { type: String, required: true },
  options: [{ type: String }],
  codeSnippet: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true },
  points: { type: Number, default: 10 },
  explanation: { type: String, default: '' }
}, { _id: false });

const classroomRoomSchema = new mongoose.Schema({
  pin: { type: String, required: true, unique: true, index: true },
  hostId: { type: String, required: true, index: true },
  hostName: { type: String, required: true },
  hostRole: { type: String, default: 'teacher' },
  mode: {
    type: String,
    enum: ['turn_based', 'simultaneous'],
    default: 'turn_based'
  },
  hostParticipates: { type: Boolean, default: true },
  questionTimeSec: { type: Number, default: 25, min: 10, max: 120 },
  quizData: {
    id: { type: String, default: '' },
    title: { type: String, required: true },
    totalQuestions: { type: Number, default: 0 },
    questions: [classroomQuestionSchema]
  },
  gameState: {
    type: String,
    enum: ['lobby', 'question', 'reveal', 'game_over'],
    default: 'lobby',
    index: true
  },
  currentQuestionIndex: { type: Number, default: 0 },
  questionStartedAt: { type: Date, default: null },
  currentTurnUserId: { type: String, default: '' },
  turnOrder: [{ type: String }],
  players: [classroomPlayerSchema],
  submissions: [classroomSubmissionSchema],
  lastTurnResult: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  roundReveal: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  version: { type: Number, default: 1 },
  expiresAt: { type: Date, required: true, expires: 0 }
}, {
  timestamps: true
});

classroomRoomSchema.index({ gameState: 1, updatedAt: -1 });

export const ClassroomRoom = mongoose.model('ClassroomRoom', classroomRoomSchema);
