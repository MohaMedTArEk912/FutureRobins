import crypto from 'crypto';
import { User } from '../models/User.js';
import { PendingRegistration } from '../models/PendingRegistration.js';
import { Subject } from '../models/Subject.js';
import { SkillTrack } from '../models/SkillTrack.js';
import { Class as Clan } from '../models/Class.js';
import { Quiz } from '../models/Quiz.js';
import { Attempt } from '../models/Attempt.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getEnrichedUser } from '../services/userService.js';
import { resolveJwtSecret } from '../utils/jwtSecret.js';
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendRegistrationVerificationEmail,
  getAppBaseUrl,
  isDeliverableEmail
} from '../services/emailService.js';
import { evaluateAndAwardBadges } from '../services/badgeService.js';
import { runInBackground } from '../utils/vercelUtils.js';


// Helper: Generate JWT
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, resolveJwtSecret(), { expiresIn: '7d' });
};

// Helper function to calculate login streak
const calculateStreak = (lastLoginDate, currentStreak) => {
  if (!lastLoginDate) {
    return 1; // First login ever
  }

  const now = new Date();
  const lastLogin = new Date(lastLoginDate);
  
  // Reset time to midnight for both dates to compare days only
  now.setHours(0, 0, 0, 0);
  lastLogin.setHours(0, 0, 0, 0);
  
  const diffTime = now - lastLogin;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    // Same day - maintain current streak
    return currentStreak || 1;
  } else if (diffDays === 1) {
    // Consecutive day - increment streak
    return (currentStreak || 0) + 1;
  } else {
    // Missed days - reset streak
    return 1;
  }
};

const resolveLoginEmail = (email) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) return normalizedEmail;

  const [localPart, domainPart] = normalizedEmail.split('@');
  if (!localPart || !domainPart) return normalizedEmail;

  if (domainPart === 'quizplatform') {
    return `${localPart}@quizplatform.local`;
  }

  return normalizedEmail;
};

async function finalizeVerifiedUser({ userId, name, email, passwordHash }) {
  const newUser = new User({
    userId,
    name,
    email,
    password: passwordHash,
    emailVerified: true,
    createdAt: new Date()
  });

  await newUser.save();

  // Dispatch Welcome Email (non-blocking, tracked via waitUntil on Vercel)
  runInBackground(
    sendWelcomeEmail({
      email: newUser.email,
      name: newUser.name,
      userId: newUser.userId
    }),
    'register-welcome-email'
  );

  const token = generateToken(newUser.userId, newUser.role || 'user');
  const enrichedUser = await getEnrichedUser(newUser.userId);
  const { password: _pw, ...safeUser } = enrichedUser || newUser.toObject();
  return { user: safeUser, token };
}

export const requestRegistrationVerification = async (req, res) => {
  try {
    const { userId, name, email, password } = req.body || {};
    const normalizedEmail = (email || '').toLowerCase().trim();
    const trimmedName = (name || '').trim();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !isDeliverableEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid, deliverable email address' });
    }
    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({ message: 'Full name must be at least 2 characters' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).select('userId email').lean();
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email address' });
    }

    const baseUserId = (userId && String(userId).trim())
      ? String(userId).trim()
      : normalizedEmail.replace(/[^a-z0-9]/g, '_');
    const conflictingUserId = await User.exists({ userId: baseUserId });
    const resolvedUserId = conflictingUserId
      ? `${baseUserId}_${crypto.randomBytes(3).toString('hex')}`
      : baseUserId;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const otp = String(crypto.randomInt(100000, 1000000));
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        userId: resolvedUserId,
        name: trimmedName,
        passwordHash,
        otp,
        verificationToken,
        attempts: 0,
        expiresAt
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const verifyUrl = `${getAppBaseUrl(req)}/register?email=${encodeURIComponent(normalizedEmail)}&token=${encodeURIComponent(verificationToken)}`;
    const mailResult = await sendRegistrationVerificationEmail({
      email: normalizedEmail,
      name: trimmedName,
      otp,
      verifyUrl
    });

    if (!mailResult || !mailResult.success) {
      await PendingRegistration.deleteOne({ email: normalizedEmail }).catch(() => {});
      return res.status(502).json({
        message: 'Could not deliver verification email. Please verify your email address works and try again.',
        error: mailResult?.error || 'Mail delivery failed'
      });
    }

    return res.status(200).json({
      requiresVerification: true,
      email: normalizedEmail,
      message: 'A 6-digit verification code and confirmation link have been sent to your email.',
      deliveryStatus: mailResult.status || 'sent',
      ...(mailResult.status === 'simulated' && mailResult.previewUrl ? { previewUrl: mailResult.previewUrl } : {})
    });
  } catch (error) {
    console.error('Error in requestRegistrationVerification:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const verifyRegistration = async (req, res) => {
  try {
    const { email, otp, code, token } = req.body || {};
    const normalizedEmail = (email || '').toLowerCase().trim();
    const submittedOtp = String(otp ?? code ?? '').trim();
    const submittedToken = String(token || '').trim();

    if (!submittedToken && (!normalizedEmail || !submittedOtp)) {
      return res.status(400).json({
        message: 'Provide your 6-digit verification code or open the verification link sent to your email.'
      });
    }

    const query = submittedToken
      ? { verificationToken: submittedToken, ...(normalizedEmail ? { email: normalizedEmail } : {}) }
      : { email: normalizedEmail };

    const pending = await PendingRegistration.findOne(query);
    if (!pending) {
      if (normalizedEmail) {
        const existingUser = await User.findOne({ email: normalizedEmail }).select('emailVerified').lean();
        if (existingUser?.emailVerified) {
          return res.status(200).json({
            alreadyVerified: true,
            message: 'Your email is already verified! Please sign in to continue.'
          });
        }
        if (existingUser) {
          return res.status(400).json({ message: 'An account already exists with this email. Please sign in.' });
        }
      }
      return res.status(400).json({
        message: 'Verification request not found or expired. Please register again to receive a new code.'
      });
    }

    if (pending.expiresAt && new Date() > pending.expiresAt) {
      await PendingRegistration.deleteOne({ _id: pending._id }).catch(() => {});
      return res.status(400).json({
        message: 'Verification code and link have expired. Please request a new one.'
      });
    }

    if (submittedToken) {
      const expectedBuf = Buffer.from(String(pending.verificationToken), 'utf8');
      const providedBuf = Buffer.from(submittedToken, 'utf8');
      if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
        return res.status(400).json({ message: 'Invalid verification link token.' });
      }
    } else if (pending.otp !== submittedOtp) {
      const updated = await PendingRegistration.findByIdAndUpdate(
        pending._id,
        { $inc: { attempts: 1 } },
        { new: true }
      );
      if (updated && updated.attempts >= 5) {
        await PendingRegistration.deleteOne({ _id: pending._id }).catch(() => {});
        return res.status(429).json({
          message: 'Too many invalid code attempts. Please submit your details again to get a new verification code.'
        });
      }
      return res.status(400).json({ message: 'Invalid 6-digit verification code. Please check your email and try again.' });
    }

    const existingUser = await User.findOne({ email: pending.email }).select('emailVerified').lean();
    if (existingUser) {
      await PendingRegistration.deleteOne({ _id: pending._id }).catch(() => {});
      if (existingUser.emailVerified) {
        return res.status(200).json({
          alreadyVerified: true,
          message: 'Your email is already verified! Please sign in to continue.'
        });
      }
      return res.status(400).json({ message: 'An account already exists with this email. Please sign in.' });
    }

    const consumed = await PendingRegistration.findOneAndDelete({ _id: pending._id });
    if (!consumed) {
      const concurrentUser = await User.findOne({ email: pending.email }).select('emailVerified').lean();
      if (concurrentUser?.emailVerified) {
        return res.status(200).json({
          alreadyVerified: true,
          message: 'Your email is already verified! Please sign in to continue.'
        });
      }
      return res.status(400).json({ message: 'Verification was already processed. Please sign in.' });
    }

    const { user, token: authToken } = await finalizeVerifiedUser({
      userId: consumed.userId,
      name: consumed.name,
      email: consumed.email,
      passwordHash: consumed.passwordHash
    });

    return res.status(201).json({
      user,
      token: authToken,
      message: 'Email verified and account created successfully!'
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'An account with this email or username already exists. Please sign in.' });
    }
    console.error('Error in verifyRegistration:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const register = async (req, res) => {
  if (req.body?.otp || req.body?.code || req.body?.token) {
    return verifyRegistration(req, res);
  }
  return requestRegistrationVerification(req, res);
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = resolveLoginEmail(email);
    const loginCandidates = normalizedEmail === (email || '').toLowerCase().trim()
      ? [normalizedEmail]
      : [normalizedEmail, (email || '').toLowerCase().trim()];

    const user = await User.findOne({ email: { $in: loginCandidates } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify Password
    let isMatch = await bcrypt.compare(password, user.password);
    
    // Lazy Migration: Check if password matches plain text if bcrypt fails
    // This supports legacy users who haven't had their passwords hashed yet
    if (!isMatch) {
      if (password === user.password) {
        isMatch = true;
        // Password matches plain text, so we'll upgrade it to a hash
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        // The user.save() later in this function will persist this change
      }
    }

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Calculate and update login streak
    const newStreak = calculateStreak(user.lastLoginDate, user.streak);
    user.streak = newStreak;
    user.lastLoginDate = new Date();
    await user.save();

    // Trigger badge evaluation on login
    evaluateAndAwardBadges(user.userId).catch(() => {});

    // Generate Token
    const token = generateToken(user.userId, user.role || 'user');

    // Fetch enriched user for response
    const enrichedUser = await getEnrichedUser(user.userId);
    const { password: _pw, ...safeUser } = enrichedUser || user.toObject();

    res.json({ user: safeUser, token });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { email, name, googleId } = req.body || {};
    const normalizedEmail = (email || '').toLowerCase().trim();
    
    // Check if user exists
    let user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      // Create new user with Google account
      const userId = normalizedEmail.replace(/[^a-z0-9]/g, '_');
      user = new User({
        userId,
        name,
        email: normalizedEmail,
        password: googleId, // Use Google ID as password (they won't use it for login)
        emailVerified: true,
        totalScore: 0,
        totalAttempts: 0,
        totalTime: 0,
        xp: 0,
        level: 1,
        streak: 1, // First login
        lastLoginDate: new Date(),
        badges: []
      });
      await user.save();
    } else {
      // Existing user - calculate and update streak
      const newStreak = calculateStreak(user.lastLoginDate, user.streak);
      user.streak = newStreak;
      user.lastLoginDate = new Date();
      if (!user.emailVerified) {
        user.emailVerified = true;
      }
      await user.save();
    }
    
    // Trigger badge evaluation on Google login
    evaluateAndAwardBadges(user.userId).catch(() => {});
    
    // Generate Token for Google User
    const token = generateToken(user.userId, user.role || 'user');
    
    // Fetch enriched user for response
    const enrichedUser = await getEnrichedUser(user.userId);
    const { password: _pw, ...safeUser } = enrichedUser || user.toObject();
    
    res.json({ user: safeUser, token });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const verifySession = async (req, res) => {
  try {
    // For backwards compatibility/session check, we can rely on the middleware to have verified the token
    // But if this route is used to *validate* a stored token on client reload:
    
    // In a stateless JWT flow, "verifying session" is just "is my token valid?"
    // The client should send the token in the header.
    // If we're here, it means the token MIGHT be in the body (if that's how the client sends it) 
    // OR we should just trust the middleware if we add it to this route.
    
    // Assuming we update the frontend to check validaty by hitting a protected route
    // Or we decode the token here if sent in body.

    const authHeader = req.headers?.authorization;
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const bodyToken = req.body?.token;
    const queryToken = req.query?.token;
    const token = headerToken || bodyToken || queryToken;

    if (!token) return res.status(401).json({ valid: false, message: 'No token provided' });

    const decoded = jwt.verify(token, resolveJwtSecret());
    const user = await User.findOne({ userId: decoded.userId });

    if (!user) return res.status(404).json({ valid: false });

    // Fetch enriched user for response
    const enrichedUser = await getEnrichedUser(user.userId);
    const { password: _pw, ...safeUser } = enrichedUser || user.toObject();

    res.json({
      valid: true,
      user: safeUser
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(200).json({ valid: false, message: 'Invalid or expired token' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body || {};
        const normalizedEmail = (email || '').toLowerCase().trim();

        if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Please provide a valid email address' });
        }

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: 'No account found with this email address' });
        }

        // Generate cryptographically random 6-digit numeric verification code
        const code = String(crypto.randomInt(100000, 1000000));
        user.resetPasswordCode = code;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
        await user.save();

        // Dispatch Password Reset Code Email and verify delivery
        const mailResult = await sendPasswordResetEmail({
            email: user.email,
            name: user.name,
            resetCode: code
        });

        if (!mailResult || !mailResult.success) {
            user.resetPasswordCode = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            return res.status(502).json({
                message: 'Failed to send verification email. Please verify mail service settings and try again.',
                error: mailResult?.error || 'Mail delivery failed'
            });
        }

        res.json({
            message: 'A 6-digit verification code has been sent to your email.',
            deliveryStatus: mailResult.status || 'sent',
            ...(mailResult.status === 'simulated' && mailResult.previewUrl ? { previewUrl: mailResult.previewUrl } : {})
        });
    } catch (error) {
        console.error('Error in forgotPassword:', error);
        res.status(500).json({ message: 'Error processing request', error: error.message });
    }
};

export const verifyResetCode = async (req, res) => {
    try {
        const { email, code } = req.body || {};
        const normalizedEmail = (email || '').toLowerCase().trim();

        if (!normalizedEmail || !code) {
            return res.status(400).json({ valid: false, message: 'Email and verification code are required' });
        }

        const user = await User.findOne({ email: normalizedEmail });
        if (!user || !user.resetPasswordCode) {
            return res.status(400).json({ valid: false, message: 'No active password reset request found for this email' });
        }

        if (user.resetPasswordCode !== String(code).trim()) {
            return res.status(400).json({ valid: false, message: 'Invalid verification code' });
        }

        if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) {
            return res.status(400).json({ valid: false, message: 'Verification code has expired. Please request a new code.' });
        }

        res.json({ valid: true, message: 'Verification code confirmed' });
    } catch (error) {
        res.status(500).json({ valid: false, message: 'Error verifying code', error: error.message });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { email, newPassword, code } = req.body || {};
        const normalizedEmail = (email || '').toLowerCase().trim();
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        if (!code || !String(code).trim()) {
            return res.status(400).json({ message: 'Verification code is required' });
        }
        
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.resetPasswordCode) {
            return res.status(400).json({ message: 'No active reset request found. Please request a verification code first.' });
        }

        if (user.resetPasswordCode !== String(code).trim()) {
            return res.status(400).json({ message: 'Invalid or incorrect verification code' });
        }

        if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) {
            return res.status(400).json({ message: 'Verification code has expired. Please request a new code.' });
        }
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Dispatch confirmation email (tracked via waitUntil on Vercel)
        runInBackground(
            sendPasswordChangedEmail({
                email: user.email,
                name: user.name
            }),
            'reset-password-email'
        );
        
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Error resetting password', error: error.message });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body || {};
        const normalizedEmail = (email || '').toLowerCase().trim();

        if (normalizedEmail.endsWith('@quizplatform.demo')) {
            return res.status(403).json({ message: 'Demo account password cannot be changed' });
        }
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long' });
        }
        
        // Find user (works for both regular users and admin)
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Verify current password
        let isMatch = await bcrypt.compare(currentPassword, user.password);
        
        // Handle legacy plain text check (though login should have fixed it, best to be safe)
        if (!isMatch && currentPassword === user.password) {
             isMatch = true;
        }

        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }
        
        // Update password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        // Dispatch confirmation email (tracked via waitUntil on Vercel)
        runInBackground(
            sendPasswordChangedEmail({
                email: user.email,
                name: user.name
            }),
            'change-password-email'
        );
        
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error changing password', error: error.message });
    }
};

export const adminChangeUserPassword = async (req, res) => {
    try {
        const { userId, newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }
        
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();
        
        res.json({ message: 'User password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error changing user password', error: error.message });
    }
};

export const adminCreateUser = async (req, res) => {
    try {
        const { userId, name, email, password, role } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        const allowedRoles = ['user', 'student', 'teacher', 'admin'];
        const safeRole = allowedRoles.includes(role) ? role : 'user';

        // Check if user exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            userId: userId || normalizedEmail.replace(/[^a-z0-9]/g, '_'),
            name,
            email: normalizedEmail,
            password: hashedPassword,
            emailVerified: true,
            role: safeRole,
            createdAt: new Date()
        });

        await newUser.save();
    
    // Dispatch Welcome Email (non-blocking, tracked via waitUntil on Vercel)
    runInBackground(
      sendWelcomeEmail({
        email: newUser.email,
        name: newUser.name,
        userId: newUser.userId
      }),
      'admin-create-welcome-email'
    );

        // Fetch enriched user for response
        const enrichedUser = await getEnrichedUser(newUser.userId);
        const { password: _pw, ...safeUser } = enrichedUser || newUser.toObject();

        res.status(201).json({ user: safeUser });
    } catch (error) {
        console.error('Admin Create User Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const demoLogin = async (req, res) => {
    try {
        if (process.env.ALLOW_LIVE_DEMO === 'false') {
            return res.status(403).json({ message: 'Live demo access is currently disabled.' });
        }

        const requestedRole = req.body?.role === 'teacher' ? 'teacher' : 'student';
        const requestedLang =
            req.body?.preferredLanguage === 'ar-EG' || req.body?.preferredLanguage === 'en'
                ? req.body.preferredLanguage
                : null;
        const rawCustomName = typeof req.body?.name === 'string' ? req.body.name : '';
        const sanitizedCustomName = rawCustomName
            .replace(/[\r\n\t<>]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 40);

        const [subjects, tracks, visibleQuizzes] = await Promise.all([
            Subject.find({}).select('_id title').lean(),
            SkillTrack.find({ isVisible: { $ne: false } }).select('trackId title').lean(),
            Quiz.find({ isVisible: { $ne: false } }).select('id title questions').limit(4).lean()
        ]);

        const allUnlockedTrackIds = Array.from(
            new Set([
                ...subjects.map((s) => s._id?.toString()).filter(Boolean),
                ...tracks.map((t) => t.trackId).filter(Boolean)
            ])
        );
        const primaryTrackId = subjects[0]?._id?.toString() || tracks[0]?.trackId || undefined;
        const firstTrackId = tracks[0]?.trackId || null;
        const firstSubjectId = subjects[0]?._id?.toString() || null;

        const ensureSingleDemoUser = async ({
            userId,
            email,
            name,
            role,
            friendId,
            avatarBg
        }) => {
            let doc = await User.findOne({ userId });
            if (!doc) {
                const salt = await bcrypt.genSalt(10);
                const randomSecret = crypto.randomBytes(24).toString('hex');
                const passwordHash = await bcrypt.hash(randomSecret, salt);

                doc = new User({
                    userId,
                    name,
                    email,
                    password: passwordHash,
                    role,
                    emailVerified: true,
                    xp: role === 'teacher' ? 2400 : 1250,
                    level: role === 'teacher' ? 5 : 4,
                    coins: 450,
                    streak: 5,
                    totalScore: role === 'teacher' ? 320 : 240,
                    totalAttempts: role === 'teacher' ? 4 : 6,
                    totalTime: 780,
                    lastLoginDate: new Date(),
                    lastStreakClaimDate: new Date(),
                    primaryTrackId,
                    unlockedTracks: allUnlockedTrackIds,
                    friends: [friendId],
                    powerUps: [
                        { type: '5050', quantity: 3 },
                        { type: 'time_freeze', quantity: 2 }
                    ],
                    preferredLanguage: requestedLang || 'en',
                    avatar: {
                        skinColor: '#F3D2A2',
                        hairStyle: 'short',
                        hairColor: '#1F2937',
                        accessory: 'glasses',
                        backgroundColor: avatarBg,
                        mood: 'happy'
                    },
                    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
                });
                await doc.save();
            } else {
                doc.emailVerified = true;
                if (name) {
                    doc.name = name;
                }
                doc.unlockedTracks = Array.from(new Set([...(doc.unlockedTracks || []), ...allUnlockedTrackIds]));
                if (!doc.primaryTrackId && primaryTrackId) {
                    doc.primaryTrackId = primaryTrackId;
                }
                if (!doc.friends || !doc.friends.includes(friendId)) {
                    doc.friends = Array.from(new Set([...(doc.friends || []), friendId]));
                }
                if ((doc.coins || 0) < 100) doc.coins = 450;
                if ((doc.xp || 0) < 100) {
                    doc.xp = role === 'teacher' ? 2400 : 1250;
                    doc.level = role === 'teacher' ? 5 : 4;
                }
                if (!doc.powerUps || doc.powerUps.length === 0) {
                    doc.powerUps = [
                        { type: '5050', quantity: 3 },
                        { type: 'time_freeze', quantity: 2 }
                    ];
                }
                if (requestedLang) {
                    doc.preferredLanguage = requestedLang;
                } else if (!doc.preferredLanguage) {
                    doc.preferredLanguage = 'en';
                }
                doc.lastLoginDate = new Date();
                await doc.save();
            }
            return doc;
        };

        const teacherName =
            requestedRole === 'teacher' && sanitizedCustomName
                ? sanitizedCustomName
                : 'Prof. Demo (Educator)';
        const studentName =
            requestedRole === 'student' && sanitizedCustomName
                ? sanitizedCustomName
                : 'Alex Demo (Explorer)';

        const [demoTeacher, demoStudent] = await Promise.all([
            ensureSingleDemoUser({
                userId: 'demo_teacher',
                email: 'demo.teacher@quizplatform.demo',
                name: teacherName,
                role: 'teacher',
                friendId: 'demo_student',
                avatarBg: '#FDE047'
            }),
            ensureSingleDemoUser({
                userId: 'demo_student',
                email: 'demo.student@quizplatform.demo',
                name: studentName,
                role: 'student',
                friendId: 'demo_teacher',
                avatarBg: '#BEF264'
            })
        ]);

        // Ensure shared showcase Class so Class Hub, Class Chat & Curriculum tabs are populated
        try {
            let demoClass = await Clan.findOne({ tag: 'DEMO' });
            if (!demoClass) {
                demoClass = new Clan({
                    name: 'Live Demo Cohort',
                    tag: 'DEMO',
                    description: 'Interactive showcase classroom — explore live discussions, announcements, curriculum modules, and homework.',
                    leaderId: demoTeacher.userId,
                    isPublic: true,
                    totalXP: 3650,
                    level: 4,
                    trackId: firstTrackId,
                    subjectId: firstSubjectId,
                    members: [
                        { userId: demoTeacher.userId, role: 'leader', contribution: 2400 },
                        { userId: demoStudent.userId, role: 'member', contribution: 1250 }
                    ],
                    announcements: [
                        {
                            id: 'demo_ann_1',
                            authorId: demoTeacher.userId,
                            authorName: demoTeacher.name,
                            content: 'Welcome to the Live Platform Demo! Check out Class Chat, Curriculum Sessions, and Live Classroom Arena.',
                            isPinned: true,
                            createdAt: new Date()
                        }
                    ],
                    chatMessages: [
                        {
                            id: 'demo_msg_1',
                            senderId: demoTeacher.userId,
                            senderName: demoTeacher.name,
                            senderAvatar: demoTeacher.avatar,
                            senderRole: 'leader',
                            content: 'Welcome everyone! Click any classmate name to open Private Chat or View Profile, or jump into Live Classroom Arena.',
                            createdAt: new Date(Date.now() - 1000 * 60 * 15)
                        },
                        {
                            id: 'demo_msg_2',
                            senderId: demoStudent.userId,
                            senderName: demoStudent.name,
                            senderAvatar: demoStudent.avatar,
                            senderRole: 'member',
                            content: 'Ready to explore all the quizzes, tracks, daily challenges, and flashcards!',
                            createdAt: new Date(Date.now() - 1000 * 60 * 5)
                        }
                    ]
                });
                await demoClass.save();
            } else {
                let changed = false;
                for (const [uid, roleName] of [
                    [demoTeacher.userId, 'leader'],
                    [demoStudent.userId, 'member']
                ]) {
                    if (!demoClass.members.some((m) => m.userId === uid)) {
                        demoClass.members.push({ userId: uid, role: roleName, contribution: 500 });
                        changed = true;
                    }
                }
                if (!demoClass.trackId && firstTrackId) {
                    demoClass.trackId = firstTrackId;
                    changed = true;
                }
                if (changed) await demoClass.save();
            }

            if (demoClass?.clanId) {
                const clanUpdates = [];
                if (demoTeacher.clanId !== demoClass.clanId) {
                    demoTeacher.clanId = demoClass.clanId;
                    clanUpdates.push(demoTeacher.save());
                }
                if (demoStudent.clanId !== demoClass.clanId) {
                    demoStudent.clanId = demoClass.clanId;
                    clanUpdates.push(demoStudent.save());
                }
                if (clanUpdates.length > 0) await Promise.all(clanUpdates);
            }
        } catch (classErr) {
            console.warn('Demo class setup warning:', classErr?.message || classErr);
        }

        // Seed showcase quiz attempts for Analytics & Activity Heatmap if demo student has none
        try {
            const existingAttemptCount = await Attempt.countDocuments({ userId: demoStudent.userId });
            if (existingAttemptCount === 0 && visibleQuizzes.length > 0) {
                const sampleAttempts = visibleQuizzes.slice(0, 3).map((quiz, idx) => {
                    const totalQuestions = Math.max(quiz.questions?.length || 10, 5);
                    const score = Math.max(totalQuestions - idx - 1, Math.ceil(totalQuestions * 0.8));
                    const percentage = Math.round((score / totalQuestions) * 100);
                    return {
                        attemptId: `demo_attempt_${Date.now()}_${idx}`,
                        userId: demoStudent.userId,
                        userName: demoStudent.name,
                        userEmail: demoStudent.email,
                        quizId: quiz.id,
                        quizTitle: quiz.title,
                        score,
                        totalQuestions,
                        percentage,
                        timeTaken: 95 + idx * 35,
                        answers: {},
                        reviewStatus: 'completed',
                        passed: true,
                        completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * idx)
                    };
                });
                await Attempt.insertMany(sampleAttempts, { ordered: false }).catch(() => {});
            }
        } catch (attemptErr) {
            console.warn('Demo attempt seed warning:', attemptErr?.message || attemptErr);
        }

        const activeUser = requestedRole === 'teacher' ? demoTeacher : demoStudent;
        await evaluateAndAwardBadges(activeUser.userId).catch(() => {});

        const token = generateToken(activeUser.userId, activeUser.role);
        const enrichedUser = await getEnrichedUser(activeUser.userId);
        const { password: _pw, ...safeUser } = enrichedUser || activeUser.toObject();

        res.json({ user: safeUser, token, demo: true });
    } catch (error) {
        console.error('Demo Login Error:', error);
        res.status(500).json({ message: 'Failed to initialize live demo session', error: error.message });
    }
};
