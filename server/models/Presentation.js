import mongoose from 'mongoose';
import crypto from 'crypto';

const checkupQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [String], default: [] },
  correctAnswer: { type: Number, default: 0 },
  explanation: { type: String, default: '' },
  points: { type: Number, default: 10 }
}, { _id: false });

const motionSlideSchema = new mongoose.Schema({
  id: { type: String, required: true },
  order: { type: Number, default: 0 },
  layout: {
    type: String,
    enum: ['hero', 'bullets', 'split', 'code', 'comparison', 'timeline', 'checkup', 'summary', 'wireframe', 'live-preview', 'homework'],
    default: 'bullets'
  },
  motion: {
    type: String,
    enum: ['fade-up', 'slide-left', 'zoom-in', 'stagger', 'pop', 'flip'],
    default: 'fade-up'
  },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  body: { type: String, default: '' },
  bullets: { type: [String], default: [] },
  codeSnippet: {
    language: { type: String, default: 'javascript' },
    code: { type: String, default: '' }
  },
  visualBlock: { type: mongoose.Schema.Types.Mixed, default: undefined },
  callout: { type: String, default: '' },
  speakerNotes: { type: String, default: '' },
  durationSeconds: { type: Number, default: 45 },
  checkupQuestion: { type: checkupQuestionSchema, default: undefined }
}, { _id: false });

const presentationSchema = new mongoose.Schema({
  presentationId: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomUUID()
  },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  trackId: { type: String, default: null, index: true },
  moduleId: { type: String, default: null, index: true },
  moduleIds: { type: [String], default: [], index: true },
  clanId: { type: String, default: null, index: true },
  createdBy: { type: String, required: true, index: true },
  sourceFormat: {
    type: String,
    enum: ['json', 'xml', 'ai_slides', 'manual'],
    default: 'manual'
  },
  theme: {
    type: String,
    enum: ['dark-tech', 'bento', 'editorial', 'neon'],
    default: 'dark-tech'
  },
  rawJson: { type: String, default: '' },
  slides: { type: [motionSlideSchema], default: [] }
}, {
  timestamps: true
});

presentationSchema.index({ trackId: 1, moduleId: 1 });
presentationSchema.index({ clanId: 1, moduleId: 1 });

export const Presentation = mongoose.model('Presentation', presentationSchema);
