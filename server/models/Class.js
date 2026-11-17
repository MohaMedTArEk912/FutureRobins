import mongoose from 'mongoose';

const clanSchema = new mongoose.Schema({
  clanId: { type: String, required: true, unique: true, default: () => crypto.randomUUID() },
  name: { type: String, required: true, unique: true },
  tag: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 5 },
  description: { type: String, default: '' },
  leaderId: { type: String, required: true }, // userId
  
  // Stats
  totalXP: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  isPublic: { type: Boolean, default: true },
  
  // Membership
  members: [{
    userId: { type: String, required: true },
    role: { type: String, enum: ['leader', 'elder', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    contribution: { type: Number, default: 0 } // XP contributed
  }],
  
  activeJoinRequests: [{
    userId: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],

  logo: {
    shape: { type: String, default: 'rounded' },
    icon: { type: String, default: 'Shield' },
    bgColor: { type: String, default: '#fde047' },
    iconColor: { type: String, default: '#000000' },
    showTag: { type: Boolean, default: true },
    customUrl: { type: String, default: '' }
  },

  announcementBanner: {
    text: { type: String, default: '' },
    url: { type: String, default: '' },
    buttonText: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
  },

  announcements: [{
    id: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    content: { type: String, required: true, maxlength: 500 },
    isPinned: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],

  // Chat messages (limited to last 100)
  chatMessages: [{
    id: { type: String, required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderAvatar: { type: mongoose.Schema.Types.Mixed, default: null },
    senderRole: { type: String, enum: ['leader', 'elder', 'member'], default: 'member' },
    senderBadge: { type: mongoose.Schema.Types.Mixed, default: null },
    content: { type: String, required: true, maxlength: 500 },
    isEdited: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date }
  }],

  settings: {
    minLevel: { type: Number, default: 1 },
    autoAccept: { type: Boolean, default: true }
  },

  // Class Mode: Invite Link, Track Curriculum, Completed Sessions & Homework Alerts
  inviteCode: {
    type: String,
    unique: true,
    sparse: true,
    default: () => crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  },
  trackId: { type: String, default: null },
  subjectId: { type: String, default: null },
  completedSessions: [{
    moduleId: { type: String, required: true },
    completedAt: { type: Date, default: Date.now },
    completedBy: { type: String },
    note: { type: String, default: '' }
  }],
  homeworkAlerts: [{
    alertId: { type: String, required: true },
    moduleId: { type: String, required: true },
    moduleTitle: { type: String, default: '' },
    quizId: { type: String, default: '' },
    targetUserIds: [{ type: String }],
    message: { type: String, default: '' },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now }
});

clanSchema.index({ totalXP: -1 });
clanSchema.index({ 'members.userId': 1 });
clanSchema.index({ leaderId: 1 });

export const Class = mongoose.model('Class', clanSchema, 'clans');
export const Clan = Class;
