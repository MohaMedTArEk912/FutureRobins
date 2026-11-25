import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'student', 'teacher', 'admin'], default: 'user' },
  totalScore: { type: Number, default: 0 },
  totalAttempts: { type: Number, default: 0 },
  totalTime: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  streak: { type: Number, default: 0 },
  lastLoginDate: { type: Date, default: Date.now },
  lastLoginMethod: { type: String, enum: ['email', 'google'], default: null },
  avatar: {
    gender: { type: String, enum: ['male', 'female'], default: 'male' },
    skinColor: { type: String },
    hairStyle: { type: String },
    hairColor: { type: String },
    clothing: { type: String },
    accessory: { type: String },
    frame: { type: String },
    backgroundColor: { type: String },
    mood: { type: String }
  },
  badges: [{
    id: String,
    name: String,
    title: String,
    description: String,
    icon: String,
    rarity: String,
    category: String,
    xpReward: Number,
    dateEarned: { type: Date, default: Date.now }
  }],
  equippedBadgeId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  friends: [{ type: String, ref: 'User' }], // Stores userIds
  friendRequests: [{
    from: { type: String, ref: 'User' }, // userId
    to: { type: String, ref: 'User' }, // userId
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],
  clanInvites: [{
    clanId: { type: String },
    clanName: { type: String },
    invitedBy: { type: String }, // userId of inviter
    createdAt: { type: Date, default: Date.now }
  }],
  // Economy & power-ups
  coins: { type: Number, default: 0 },
  inventory: [{
    itemId: String,
    quantity: { type: Number, default: 0 }
  }],
  powerUps: [{
    type: { type: String }, // e.g., '5050', 'time_freeze'
    quantity: { type: Number, default: 0 }
  }],
  unlockedItems: [{ type: String }], // Array of itemIds for permanent unlocks (cosmetics)
  // Daily login streak claim tracking
  lastStreakClaimDate: { type: Date },
  // Daily challenge streak
  dailyChallengeDate: { type: Date },
  dailyChallengeCompleted: { type: Boolean, default: false },
  dailyChallengeStreak: { type: Number, default: 0 },
  // Skill tracks progress (simplified)
  skillTracks: [{
    trackId: String,
    unlockedModules: [String],
    completedModules: [String],
    completedSubModules: [String] // Format: "moduleId:subModuleId"
  }],
  // Road / Track access control
  primaryTrackId: { type: String }, // Initial chosen track/road ID (subjectId)
  unlockedTracks: [{ type: String }], // List of track/subject IDs user has access to
  clanId: { type: String }, // Simplified link to clan
  preferredLanguage: { type: String, enum: ['en', 'ar-EG'], default: null },
  emailVerified: { type: Boolean, default: false },
  resetPasswordCode: { type: String },
  resetPasswordExpires: { type: Date },
  // Secret Noir Arcade XP anti-abuse tracking & records
  arcadeXpDailyDate: { type: String, default: null },
  arcadeXpDailyEarned: { type: Number, default: 0 },
  arcadeStats: {
    bestHuntSeconds: { type: Number, default: 0 },
    bestHuntScore: { type: Number, default: 0 },
    bestHarvestScore: { type: Number, default: 0 },
    bestSmashScore: { type: Number, default: 0 },
    bestDashDistance: { type: Number, default: 0 },
    totalArcadeXp: { type: Number, default: 0 }
  }
});

// Indexes to speed up lookups, authentication, and leaderboards
userSchema.index({ role: 1, totalScore: -1 }); // Ultra-fast leaderboard slice
userSchema.index({ isAdmin: 1, totalScore: -1 });
userSchema.index({ totalScore: -1 });
userSchema.index({ name: 1 });
userSchema.index({ clanId: 1 });
userSchema.index({ createdAt: -1 });

export const User = mongoose.model('User', userSchema);
