import crypto from 'crypto';
import { User } from '../models/User.js';
import { PendingRegistration } from '../models/PendingRegistration.js';
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
