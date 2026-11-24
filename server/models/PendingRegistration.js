import mongoose from 'mongoose';

const pendingRegistrationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female'], default: 'male' },
  otp: { type: String, required: true },
  verificationToken: { type: String, required: true, index: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 }
}, {
  timestamps: true
});

export const PendingRegistration = mongoose.model('PendingRegistration', pendingRegistrationSchema);
