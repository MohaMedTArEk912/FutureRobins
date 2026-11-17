import mongoose from 'mongoose';

const tournamentSessionSchema = new mongoose.Schema({
  tournamentId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  userName: { type: String, default: 'Student' },
  userEmail: { type: String, default: '' },
  userAvatar: { type: mongoose.Schema.Types.Mixed, default: '' },
  currentQuestion: { type: Number, default: 1 },
  totalQuestions: { type: Number, default: 10 },
  score: { type: Number, default: 0 },
  answersCount: { type: Number, default: 0 },
  status: { type: String, default: 'answering' },
  timeElapsed: { type: Number, default: 0 },
  lastActiveAt: { type: Date, default: Date.now, expires: 300 }
});

tournamentSessionSchema.index({ tournamentId: 1, userId: 1 }, { unique: true });
tournamentSessionSchema.index({ tournamentId: 1, lastActiveAt: -1 });

export const TournamentSession = mongoose.model('TournamentSession', tournamentSessionSchema);
