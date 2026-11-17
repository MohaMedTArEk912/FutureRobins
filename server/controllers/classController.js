import { Class as Clan } from '../models/Class.js';
import { User } from '../models/User.js';
import { SkillTrack } from '../models/SkillTrack.js';
import { SkillTrackProgress } from '../models/SkillTrackProgress.js';
import { Quiz } from '../models/Quiz.js';
import { Attempt } from '../models/Attempt.js';
import crypto from 'crypto';
import { escapeRegex } from '../utils/regexUtils.js';
import { sendClanInviteEmail, sendHomeworkAlertEmail, isDeliverableEmail } from '../services/emailService.js';
import { evaluateAndAwardBadges } from '../services/badgeService.js';
import { createAndSendNotification } from './notificationController.js';
import { runInBackground } from '../utils/vercelUtils.js';

const dispatchClassAlertEmails = async ({
  targetIds,
  teacherName,
  className,
  moduleTitle,
  alertTitle,
  message,
  actionPath
}) => {
  if (!Array.isArray(targetIds) || targetIds.length === 0) return 0;
  const recipients = await User.find({ userId: { $in: targetIds } })
    .select('userId name email')
    .lean();
  const deliverable = recipients.filter(u => isDeliverableEmail(u.email));
  if (deliverable.length === 0) return 0;

  runInBackground(
    Promise.allSettled(
      deliverable.map(student =>
        sendHomeworkAlertEmail({
          email: student.email,
          recipientName: student.name || 'Student',
          teacherName,
          className,
          moduleTitle,
          alertTitle,
          message,
          actionPath
        })
      )
    ),
    'class-homework-alert-emails'
  );

  return deliverable.length;
};

const generateInviteCode = () => crypto.randomBytes(5).toString('hex').toUpperCase();

const getModuleQuizIds = (mod) => {
  const ids = new Set(Array.isArray(mod?.quizIds) ? mod.quizIds.filter(Boolean) : []);
  if (mod?.quizId) ids.add(mod.quizId);
  return Array.from(ids);
};

const unlockSubjectForUsers = async (userIds, subjectId) => {
  if (!subjectId || !Array.isArray(userIds) || userIds.length === 0) return;
  await User.updateMany(
    { userId: { $in: userIds } },
    { $addToSet: { unlockedTracks: String(subjectId) } }
  );
};

const unlockModulesForStudents = async (studentIds, trackId, moduleIdsToUnlock = []) => {
  if (!trackId || !Array.isArray(studentIds) || studentIds.length === 0 || !moduleIdsToUnlock.length) return 0;
  let updatedCount = 0;

  const existingDocs = await SkillTrackProgress.find({
    userId: { $in: studentIds },
    trackId
  });
  const docMap = new Map(existingDocs.map(d => [d.userId, d]));

  for (const studentId of studentIds) {
    let progress = docMap.get(studentId);
    if (!progress) {
      progress = new SkillTrackProgress({
        userId: studentId,
        trackId,
        completedModules: [],
        unlockedModules: [...new Set(moduleIdsToUnlock)],
        completedSubModules: []
      });
    } else {
      const currentSet = new Set(progress.unlockedModules || []);
      let changed = false;
      for (const mId of moduleIdsToUnlock) {
        if (!currentSet.has(mId)) {
          currentSet.add(mId);
          changed = true;
        }
      }
      if (changed) {
        progress.unlockedModules = Array.from(currentSet);
      }
    }
    progress.lastAccessed = new Date();
    await progress.save();

    const user = await User.findOne({ userId: studentId });
    if (user) {
      if (!user.skillTracks) user.skillTracks = [];
      const idx = user.skillTracks.findIndex(t => t.trackId === trackId);
      const summary = {
        trackId,
        completedModules: progress.completedModules || [],
        unlockedModules: progress.unlockedModules || [],
        completedSubModules: progress.completedSubModules || []
      };
      if (idx >= 0) {
        user.skillTracks[idx] = summary;
      } else {
        user.skillTracks.push(summary);
      }
      user.markModified('skillTracks');
      await user.save();
    }
    updatedCount++;
  }

  return updatedCount;
};

// ==========================================
// In-Memory TTL Cache (30s)
// ==========================================
class ClanTtlCache {
  constructor(defaultTtlMs = 30000, maxEntries = 500) {
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    const now = Date.now();
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      for (const [k, entry] of this.cache.entries()) {
        if (now > entry.expiry) this.cache.delete(k);
      }
      if (this.cache.size >= this.maxEntries) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey !== undefined) this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, {
      value,
      expiry: now + ttlMs
    });
  }

  del(key) {
    this.cache.delete(key);
  }

  invalidatePrefix(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateClan(clanId) {
    if (clanId) {
      this.del(`clan_detail_${clanId}`);
    }
    this.del('clan_leaderboard');
    this.invalidatePrefix('clan_search_');
  }

  clear() {
    this.cache.clear();
  }
}

export const clanCache = new ClanTtlCache(30000);
export const invalidateClanDetailCache = (clanId) => clanCache.invalidateClan(clanId);

export const createClan = async (req, res) => {
  try {
    const { name, tag, description, isPublic, logo, trackId, teacherId, studentIds } = req.body || {};
    const userId = req.user.userId;

    const caller = await User.findOne({ userId });
    if (!caller) return res.status(404).json({ message: 'User not found' });

    if (caller.role !== 'admin' && caller.isAdmin !== true) {
      return res.status(403).json({ message: 'Only administrators can create classes and assign teachers or students' });
    }

    if (!name || !String(name).trim() || !tag || !String(tag).trim()) {
      return res.status(400).json({ message: 'Class name and code tag are required' });
    }

    const existingClan = await Clan.findOne({ name: String(name).trim() });
    if (existingClan) {
      return res.status(409).json({ message: 'A class with this name already exists' });
    }

    // Resolve assigned teacher (default to admin creator if none specified)
    let assignedTeacherId = userId;
    if (teacherId && String(teacherId).trim()) {
      const targetTeacher = await User.findOne({ userId: String(teacherId).trim() }).lean();
      if (!targetTeacher) {
        return res.status(404).json({ message: 'Assigned teacher account not found' });
      }
      if (targetTeacher.role !== 'teacher' && targetTeacher.role !== 'admin' && targetTeacher.isAdmin !== true) {
        return res.status(400).json({ message: 'Selected user must have a teacher or admin role' });
      }
      assignedTeacherId = targetTeacher.userId;
    }

    let resolvedTrackId = null;
    let resolvedSubjectId = null;
    if (trackId) {
      const track = await SkillTrack.findOne({ trackId }).lean();
      if (!track) {
        return res.status(404).json({ message: 'Selected track not found' });
      }
      resolvedTrackId = track.trackId;
      resolvedSubjectId = track.subjectId ? String(track.subjectId) : null;
    }

    const uniqueStudentIds = Array.isArray(studentIds)
      ? [...new Set(studentIds.map(id => String(id).trim()).filter(id => id && id !== assignedTeacherId))]
      : [];

    const initialMembers = [
      { userId: assignedTeacherId, role: 'leader', contribution: 0 },
      ...uniqueStudentIds.map(sid => ({ userId: sid, role: 'member', contribution: 0 }))
    ];

    const newClan = new Clan({
      clanId: crypto.randomUUID(),
      name: String(name).trim(),
      tag: String(tag).trim().toUpperCase(),
      description: description || '',
      leaderId: assignedTeacherId,
      isPublic: isPublic !== undefined ? isPublic : false,
      members: initialMembers,
      announcements: [],
      chatMessages: [],
      logo: logo || undefined,
      inviteCode: generateInviteCode(),
      trackId: resolvedTrackId,
      subjectId: resolvedSubjectId,
      completedSessions: [],
      homeworkAlerts: []
    });

    await newClan.save();

    const allAssignedIds = [assignedTeacherId, ...uniqueStudentIds];
    await User.updateMany(
      {
        userId: { $in: allAssignedIds },
        $or: [{ clanId: null }, { clanId: { $exists: false } }, { clanId: '' }]
      },
      { $set: { clanId: newClan.clanId } }
    );

    if (resolvedSubjectId) {
      await unlockSubjectForUsers(allAssignedIds, resolvedSubjectId);
    }

    clanCache.invalidateClan(newClan.clanId);
    evaluateAndAwardBadges(assignedTeacherId).catch(() => {});

    res.status(201).json(newClan);
  } catch (error) {
    res.status(500).json({ message: 'Error creating class', error: error.message });
  }
};

export const getMyClasses = async (req, res) => {
  try {
    const userId = req.user.userId;
    const classes = await Clan.find({
      $or: [{ leaderId: userId }, { 'members.userId': userId }]
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!classes.length) {
      return res.json([]);
    }

    const leaderIds = [...new Set(classes.map(c => c.leaderId).filter(Boolean))];
    const trackIds = [...new Set(classes.map(c => c.trackId).filter(Boolean))];

    const [leaders, tracks] = await Promise.all([
      User.find({ userId: { $in: leaderIds } }).select('userId name').lean(),
      trackIds.length ? SkillTrack.find({ trackId: { $in: trackIds } }).select('trackId title icon modules').lean() : []
    ]);

    const leaderMap = new Map(leaders.map(l => [l.userId, l.name]));
    const trackMap = new Map(tracks.map(t => [t.trackId, t]));

    const enriched = await Promise.all(classes.map(async (c) => {
      let inviteCode = c.inviteCode;
      if (!inviteCode) {
        inviteCode = generateInviteCode();
        await Clan.updateOne({ clanId: c.clanId }, { $set: { inviteCode } }).catch(() => {});
      }
      const track = c.trackId ? trackMap.get(c.trackId) : null;
      return {
        clanId: c.clanId,
        name: c.name,
        tag: c.tag,
        description: c.description,
        leaderId: c.leaderId,
        leaderName: leaderMap.get(c.leaderId) || 'Teacher',
        isPublic: c.isPublic,
        logo: c.logo,
        inviteCode,
        trackId: c.trackId || null,
        subjectId: c.subjectId || null,
        trackTitle: track?.title || null,
        trackIcon: track?.icon || null,
        totalSessions: track?.modules?.length || 0,
        finishedSessionsCount: (c.completedSessions || []).length,
        memberCount: (c.members || []).length,
        myRole: c.leaderId === userId ? 'teacher' : 'student',
        createdAt: c.createdAt
      };
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching classes', error: error.message });
  }
};

export const getClan = async (req, res) => {
  try {
    const { clanId } = req.params;
    const cacheKey = `clan_detail_${clanId}`;
    const cached = clanCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const clan = await Clan.findOne({ clanId }).lean();
    if (!clan) return res.status(404).json({ message: 'Clan not found' });

    // Self-heal inviteCode if missing on legacy classes
    if (!clan.inviteCode) {
      clan.inviteCode = generateInviteCode();
      Clan.updateOne({ clanId }, { $set: { inviteCode: clan.inviteCode } }).catch(() => {});
    }

    // Self-heal leaderId if it ever drifted from the member with leader role
    const members = clan.members || [];
    const storedLeader = members.find(m => m.role === 'leader');
    if (storedLeader && clan.leaderId !== storedLeader.userId) {
      clan.leaderId = storedLeader.userId;
      Clan.updateOne({ clanId }, { $set: { leaderId: storedLeader.userId } }).catch(() => {});
    }
    
    // Enrich member data (names, avatars, xp, totalScore, role)
    const memberIds = members.map(m => m.userId);
    const requests = clan.activeJoinRequests || [];
    const requestIds = requests.map(r => r.userId);
    const allUserIds = [...new Set([...memberIds, ...requestIds].filter(Boolean))];

    const [users, assignedTrack] = await Promise.all([
      User.find({ userId: { $in: allUserIds } })
        .select('userId name email role avatar xp totalScore equippedBadgeId badges')
        .lean(),
      clan.trackId ? SkillTrack.findOne({ trackId: clan.trackId }).select('trackId title description icon category subjectId modules').lean() : null
    ]);
      
    const userMap = new Map(users.map(u => [u.userId, u]));

    const enrichedMembers = members.map(m => {
      const user = userMap.get(m.userId);
      const equippedBadge = user?.badges?.find(b => b.id === user?.equippedBadgeId);
      return {
        ...m,
        name: user?.name || m.name || 'Unknown',
        email: user?.email || '',
        userRole: user?.role || 'user',
        avatar: user?.avatar || m.avatar,
        xp: user?.xp ?? m.xp ?? 0,
        totalScore: user?.totalScore ?? m.totalScore ?? 0,
        equippedBadgeId: user?.equippedBadgeId || null,
        equippedBadge: equippedBadge ? {
          id: equippedBadge.id,
          name: equippedBadge.name,
          title: equippedBadge.title || equippedBadge.name,
          icon: equippedBadge.icon,
          rarity: equippedBadge.rarity || 'common'
        } : null
      };
    });

    const enrichedRequests = requests.map(r => {
      const user = userMap.get(r.userId);
      return {
        ...r,
        name: user?.name || 'Unknown',
        avatar: user?.avatar
      };
    });

    const result = {
      ...clan,
      track: assignedTrack || null,
      members: enrichedMembers,
      activeJoinRequests: enrichedRequests
    };

    clanCache.set(cacheKey, result, 30000);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clan', error: error.message });
  }
};

export const searchClans = async (req, res) => {
  try {
    const { query = '' } = req.query;
    const safeQuery = escapeRegex(query, 40);
    const cacheKey = `clan_search_${safeQuery.toLowerCase()}`;
    const cached = clanCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const queryFilter = safeQuery
      ? {
          $or: [
            { name: { $regex: safeQuery, $options: 'i' } },
            { tag: { $regex: safeQuery, $options: 'i' } }
          ]
        }
      : {};

    const clans = await Clan.find(queryFilter)
      .limit(20)
      .sort({ totalXP: -1 })
      .select('clanId name tag description level totalXP members isPublic logo leaderId')
      .lean();

    clanCache.set(cacheKey, clans, 30000);
    res.json(clans);
  } catch (error) {
    res.status(500).json({
      message: 'Error searching clans',
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

export const joinClan = async (req, res) => {
  try {
    const { clanId } = req.body || {};
    const userId = req.user.userId;

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Class not found' });

    if (clan.members?.some(m => m.userId === userId)) {
      return res.status(400).json({ message: 'You are already in this class' });
    }

    // Check if already requested
    const existingRequest = clan.activeJoinRequests?.find(r => r.userId === userId);
    if (existingRequest) return res.status(400).json({ message: 'Join request already pending' });

    if (!clan.isPublic) {
      if (!clan.activeJoinRequests) clan.activeJoinRequests = [];
      clan.activeJoinRequests.push({ userId });
      await clan.save();
      clanCache.invalidateClan(clanId);
      return res.json({ message: 'Join request sent', requestSent: true });
    }

    clan.members.push({ userId, role: 'member', contribution: 0 });
    await clan.save();

    if (!user.clanId) {
      user.clanId = clanId;
    }
    if (clan.subjectId) {
      const unlockedSet = new Set((user.unlockedTracks || []).map(String));
      unlockedSet.add(String(clan.subjectId));
      user.unlockedTracks = Array.from(unlockedSet);
    }
    await user.save();

    if (clan.trackId && clan.completedSessions?.length) {
      const finishedIds = clan.completedSessions.map(s => s.moduleId).filter(Boolean);
      unlockModulesForStudents([userId], clan.trackId, finishedIds).catch(() => {});
    }

    clanCache.invalidateClan(clanId);
    evaluateAndAwardBadges(userId).catch(() => {});

    res.json({ message: 'Joined class successfully', clan });
  } catch (error) {
    res.status(500).json({ message: 'Error joining class', error: error.message });
  }
};

export const leaveClan = async (req, res) => {
  try {
    const userId = req.user.userId;
    const requestedClanId = req.body?.clanId;
    const user = await User.findOne({ userId });
    
    const targetClanId = requestedClanId || user?.clanId;
    if (!user || !targetClanId) return res.status(400).json({ message: 'Not in a class' });

    const clan = await Clan.findOne({ clanId: targetClanId });
    if (clan) {
      const memberIndex = clan.members.findIndex(m => m.userId === userId);
      if (memberIndex !== -1) {
        const member = clan.members[memberIndex];
        if (member.role === 'leader') {
          if (clan.members.length === 1) {
            await Clan.deleteOne({ clanId: clan.clanId });
            const nextClass = await Clan.findOne({ 'members.userId': userId }).select('clanId').lean();
            user.clanId = nextClass?.clanId || null;
            await user.save();
            clanCache.invalidateClan(targetClanId);
            return res.json({ message: 'Class deleted' });
          } else {
            const newLeader = clan.members.find(m => m.userId !== userId);
            if (newLeader) {
              newLeader.role = 'leader';
              clan.leaderId = newLeader.userId;
            }
          }
        }
        clan.members.splice(memberIndex, 1);
        await clan.save();
      }
    }

    if (user.clanId === targetClanId) {
      const nextClass = await Clan.findOne({ 'members.userId': userId }).select('clanId').lean();
      user.clanId = nextClass?.clanId || null;
      await user.save();
    }

    clanCache.invalidateClan(targetClanId);
    
    res.json({ message: 'Left class' });
  } catch (error) {
    res.status(500).json({ message: 'Error leaving class', error: error.message });
  }
};

export const getClanLeaderboard = async (req, res) => {
  try {
    const cacheKey = 'clan_leaderboard';
    const cached = clanCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Fetch all clans sorted by totalXP (limit to top 100 for performance)
    const clans = await Clan.find({})
      .sort({ totalXP: -1, level: -1 })
      .limit(100)
      .select('clanId name tag description level totalXP members leaderId isPublic logo')
      .lean();

    // Get all unique leader IDs
    const leaderIds = [...new Set(clans.map(clan => clan.leaderId).filter(Boolean))];
    
    // Fetch all leaders in one query (optimized)
    const leaders = await User.find({ userId: { $in: leaderIds } })
      .select('userId name')
      .lean();
    
    // Create a map for quick lookup
    const leaderMap = new Map(leaders.map(leader => [leader.userId, leader.name]));

    // Enrich clan data
    const enrichedClans = clans.map((clan, index) => ({
      clanId: clan.clanId,
      name: clan.name,
      tag: clan.tag,
      description: clan.description,
      level: clan.level,
      totalXP: clan.totalXP,
      memberCount: (clan.members || []).length,
      leaderName: leaderMap.get(clan.leaderId) || 'Unknown',
      rank: index + 1,
      isPublic: clan.isPublic,
      logo: clan.logo
    }));

    clanCache.set(cacheKey, enrichedClans, 30000);
    res.json(enrichedClans);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leaderboard', error: error.message });
  }
};

export const updateClan = async (req, res) => {
  try {
    const { clanId } = req.params;
    const { name, description, isPublic, settings, announcementBanner, logo } = req.body || {};
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Clan not found' });

    const isAdmin = req.user?.role === 'admin' || req.user?.isAdmin === true;
    if (!isAdmin) {
      return res.status(403).json({ message: 'Only administrators can update class settings or metadata' });
    }

    if (name) clan.name = name;
    if (description !== undefined) clan.description = description;
    if (isPublic !== undefined) clan.isPublic = isPublic;
    if (settings) clan.settings = { ...clan.settings, ...settings };
    if (logo !== undefined) {
      clan.logo = typeof logo === 'object' ? { ...clan.logo, ...logo } : logo;
    }
    if (announcementBanner !== undefined) {
      const rawText = typeof announcementBanner.text === 'string' ? announcementBanner.text.trim().substring(0, 500) : '';
      const rawUrl = typeof announcementBanner.url === 'string' ? announcementBanner.url.trim() : '';
      const rawButtonText = typeof announcementBanner.buttonText === 'string' ? announcementBanner.buttonText.trim().substring(0, 40) : '';
      let validatedUrl = '';
      if (rawUrl) {
        if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
          validatedUrl = rawUrl;
        } else {
          try {
            const parsed = new URL(rawUrl);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
              validatedUrl = rawUrl;
            }
          } catch {}
        }
      }
      clan.announcementBanner = {
        text: rawText,
        url: validatedUrl,
        buttonText: rawButtonText,
        updatedAt: new Date()
      };
    }

    await clan.save();
    clanCache.invalidateClan(clanId);
    res.json(clan);
  } catch (error) {
    res.status(500).json({ message: 'Error updating clan', error: error.message });
  }
};

export const inviteToClan = async (req, res) => {
  try {
    const { targetUserId, clanId } = req.body || {};
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Class not found' });

    // Check permissions (Teacher/Leader or Elder or Admin)
    const member = clan.members.find(m => m.userId === userId);
    const isAllowed = clan.leaderId === userId || member?.role === 'leader' || member?.role === 'elder' || req.user?.role === 'admin';
    if (!isAllowed) {
      return res.status(403).json({ message: 'Only the class teacher can invite students' });
    }

    const targetUser = await User.findOne({ userId: targetUserId });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    if (clan.members?.some(m => m.userId === targetUserId)) {
      return res.status(400).json({ message: 'User is already in this class' });
    }

    // Check if already invited
    const existingInvite = targetUser.clanInvites?.find(inv => inv.clanId === clanId);
    if (existingInvite) {
      return res.status(400).json({ message: 'User already has a pending invite' });
    }

    if (!targetUser.clanInvites) targetUser.clanInvites = [];
    targetUser.clanInvites.push({
      clanId,
      clanName: clan.name,
      invitedBy: userId
    });

    await targetUser.save();

    // Send in-app notification + socket alert
    await createAndSendNotification(req.app, {
      recipientId: targetUserId,
      senderId: userId,
      senderName: req.user?.name || 'Teacher',
      type: 'class_invite',
      title: `Class Invitation: ${clan.name}`,
      message: `${req.user?.name || 'Your teacher'} invited you to join "${clan.name}" [${clan.tag}]`,
      link: '/clans',
      metadata: {
        clanId: clan.clanId,
        clanName: clan.name,
        inviteCode: clan.inviteCode
      }
    });

    const io = req.app?.get?.('io');
    if (io) {
      io.to(targetUserId).emit('class_invite_received', {
        clanId: clan.clanId,
        clanName: clan.name,
        inviterName: req.user?.name || 'Teacher'
      });
    }

    // Dispatch Class Invitation Email
    if (targetUser.email) {
      runInBackground(
        sendClanInviteEmail({
          email: targetUser.email,
          recipientName: targetUser.name || 'Student',
          inviterName: req.user?.name || member?.name || 'Your Teacher',
          clanName: clan.name,
          clanTag: clan.tag
        }),
        'class-invite-email'
      );
    }

    res.json({ message: 'Invitation sent' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending invitation', error: error.message });
  }
};

export const respondToClanInvite = async (req, res) => {
  try {
    const { clanId, accept } = req.body || {};
    const userId = req.user.userId;

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const inviteIndex = (user.clanInvites || []).findIndex(inv => inv.clanId === clanId);
    if (inviteIndex === -1) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (accept) {
      const clan = await Clan.findOne({ clanId });
      if (!clan) {
        user.clanInvites.splice(inviteIndex, 1);
        await user.save();
        return res.status(404).json({ message: 'Class no longer exists' });
      }

      if (!clan.members.some(m => m.userId === userId)) {
        clan.members.push({ userId, role: 'member', contribution: 0 });
        await clan.save();
      }
      
      if (!user.clanId) {
        user.clanId = clanId;
      }
      if (clan.subjectId) {
        const unlockedSet = new Set((user.unlockedTracks || []).map(String));
        unlockedSet.add(String(clan.subjectId));
        user.unlockedTracks = Array.from(unlockedSet);
      }

      clanCache.invalidateClan(clanId);
      evaluateAndAwardBadges(userId).catch(() => {});

      if (clan.trackId && clan.completedSessions?.length) {
        const finishedIds = clan.completedSessions.map(s => s.moduleId).filter(Boolean);
        unlockModulesForStudents([userId], clan.trackId, finishedIds).catch(() => {});
      }
    }

    // Remove invite regardless of accept/reject
    user.clanInvites.splice(inviteIndex, 1);
    await user.save();

    res.json({ message: accept ? 'Joined class successfully' : 'Invitation rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Error responding to invitation', error: error.message });
  }
};

export const handleJoinRequest = async (req, res) => {
  try {
    const { clanId, targetUserId, accept } = req.body || {};
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Clan not found' });

    // Check Permissions
    const requester = clan.members.find(m => m.userId === userId);
    if (!requester || (requester.role !== 'leader' && requester.role !== 'elder')) {
      return res.status(403).json({ message: 'No permission' });
    }

    const requestIndex = (clan.activeJoinRequests || []).findIndex(r => r.userId === targetUserId);
    if (requestIndex === -1) return res.status(404).json({ message: 'Request not found' });

    if (accept) {
      const targetUser = await User.findOne({ userId: targetUserId });
      if (!targetUser) return res.status(404).json({ message: 'User not found' });
      
      if (clan.members?.some(m => m.userId === targetUserId)) {
        clan.activeJoinRequests.splice(requestIndex, 1);
        await clan.save();
        clanCache.invalidateClan(clanId);
        return res.status(400).json({ message: 'User is already in this class' });
      }

      clan.members.push({ userId: targetUserId, role: 'member', contribution: 0 });
      if (!targetUser.clanId) {
        targetUser.clanId = clanId;
      }
      if (clan.subjectId) {
        const unlockedSet = new Set((targetUser.unlockedTracks || []).map(String));
        unlockedSet.add(String(clan.subjectId));
        targetUser.unlockedTracks = Array.from(unlockedSet);
      }
      await targetUser.save();
      evaluateAndAwardBadges(targetUserId).catch(() => {});

      if (clan.trackId && clan.completedSessions?.length) {
        const finishedIds = clan.completedSessions.map(s => s.moduleId).filter(Boolean);
        unlockModulesForStudents([targetUserId], clan.trackId, finishedIds).catch(() => {});
      }
    }

    clan.activeJoinRequests.splice(requestIndex, 1);
    await clan.save();
    clanCache.invalidateClan(clanId);

    res.json({ message: accept ? 'Request accepted' : 'Request rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Error handling request', error: error.message });
  }
};

export const kickMember = async (req, res) => {
  try {
    const { clanId, targetUserId } = req.body || {};
    const userId = req.user.userId;

    if (userId === targetUserId) {
      return res.status(403).json({ message: 'You cannot kick yourself' });
    }

    const clan = await Clan.findOne({ clanId });
    if (!clan) {
      return res.status(404).json({ message: 'Clan not found' });
    }

    const executor = clan.members.find(m => m.userId === userId);
    const target = clan.members.find(m => m.userId === targetUserId);

    if (!executor || !target) {
      return res.status(404).json({ message: 'Member not found in clan' });
    }

    const rolePower = {
      leader: 3,
      elder: 2,
      member: 1
    };

    if (rolePower[executor.role] <= rolePower[target.role]) {
      return res.status(403).json({ message: 'No permission to kick this member' });
    }

    const memberIndex = clan.members.findIndex(m => m.userId === targetUserId);
    if (memberIndex === -1) {
      return res.status(400).json({ message: 'Member not found - may have already left' });
    }

    clan.members.splice(memberIndex, 1);
    await clan.save();

    await User.updateOne(
      { userId: targetUserId, clanId: clanId },
      { $set: { clanId: null } }
    );

    clanCache.invalidateClan(clanId);

    const io = req.app?.get?.('io');
    if (io) {
      io.to(targetUserId).emit('kicked_from_clan', {
        clanId,
        clanName: clan.name,
        message: `You were removed from clan ${clan.name}`
      });
      io.to(`clan_${clanId}`).emit('member_kicked', {
        targetUserId,
        clanId
      });
    }

    res.json({ message: 'Member kicked successfully' });
  } catch (error) {
    console.error('Error kicking member:', error);
    res.status(500).json({
      message: 'Error kicking member',
      error: error.message
    });
  }
};

export const updateMemberRole = async (req, res) => {
  try {
    const { clanId, targetUserId, newRole } = req.body || {};
    const userId = req.user.userId;

    if (!['elder', 'member'].includes(newRole)) return res.status(400).json({ message: 'Invalid role' });

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Clan not found' });

    const actingMember = clan.members.find(m => m.userId === userId);
    const isLeader = actingMember?.role === 'leader' || clan.leaderId === userId;
    if (!isLeader) return res.status(403).json({ message: 'Only leader can change roles' });

    const target = clan.members.find(m => m.userId === targetUserId);
    if (!target) return res.status(404).json({ message: 'Member not found' });

    target.role = newRole;
    await clan.save();
    clanCache.invalidateClan(clanId);

    res.json({ message: 'Role updated' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating role', error: error.message });
  }
};

export const createClanAnnouncement = async (req, res) => {
  try {
    const { clanId } = req.params;
    const { content } = req.body || {};
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Clan not found' });

    const member = clan.members.find(m => m.userId === userId);
    if (!member || (member.role !== 'leader' && member.role !== 'elder')) {
      return res.status(403).json({ message: 'Only leaders and elders can post announcements' });
    }

    const user = await User.findOne({ userId });

    const newAnnouncement = {
      id: crypto.randomUUID(),
      authorId: userId,
      authorName: user?.name || 'Unknown',
      content,
      isPinned: false,
      createdAt: new Date()
    };

    if (!clan.announcements) clan.announcements = [];
    clan.announcements.unshift(newAnnouncement);
    
    if (clan.announcements.length > 50) {
      clan.announcements = clan.announcements.slice(0, 50);
    }

    await clan.save();
    clanCache.invalidateClan(clanId);
    res.status(201).json(newAnnouncement);
  } catch (error) {
    res.status(500).json({ message: 'Error creating announcement', error: error.message });
  }
};

export const deleteClanAnnouncement = async (req, res) => {
  try {
    const { clanId, announcementId } = req.params;
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Clan not found' });

    const member = clan.members.find(m => m.userId === userId);
    if (!member || (member.role !== 'leader' && member.role !== 'elder')) {
      return res.status(403).json({ message: 'No permission' });
    }

    if (!clan.announcements) return res.status(404).json({ message: 'Announcement not found' });

    const index = clan.announcements.findIndex(a => a.id === announcementId);
    if (index === -1) return res.status(404).json({ message: 'Announcement not found' });

    clan.announcements.splice(index, 1);
    await clan.save();
    clanCache.invalidateClan(clanId);
    res.json({ message: 'Announcement deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting announcement', error: error.message });
  }
};

export const pinClanAnnouncement = async (req, res) => {
  try {
    const { clanId, announcementId } = req.params;
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Clan not found' });

    const member = clan.members.find(m => m.userId === userId);
    if (!member || (member.role !== 'leader' && member.role !== 'elder')) {
      return res.status(403).json({ message: 'No permission' });
    }

    if (!clan.announcements) return res.status(404).json({ message: 'Announcement not found' });

    const announcement = clan.announcements.find(a => a.id === announcementId);
    if (!announcement) return res.status(404).json({ message: 'Announcement not found' });

    announcement.isPinned = !announcement.isPinned;
    
    clan.announcements.sort((a, b) => {
      if (a.isPinned === b.isPinned) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return a.isPinned ? -1 : 1;
    });

    await clan.save();
    clanCache.invalidateClan(clanId);
    res.json(announcement);
  } catch (error) {
    res.status(500).json({ message: 'Error toggling pin', error: error.message });
  }
};

// ==========================================
// REST Clan Chat Endpoints (Robust Fallback)
// ==========================================
export const getClanMessages = async (req, res) => {
  try {
    const { clanId } = req.params;
    const clan = await Clan.findOne({ clanId }).select('chatMessages members').lean();
    if (!clan) return res.status(404).json({ message: 'Clan not found' });

    const isMember = (clan.members || []).some(m => m.userId === req.user.userId);
    if (!isMember) {
      return res.status(403).json({ message: 'You must be a member to view clan chat' });
    }

    res.json(clan.chatMessages || []);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clan messages', error: error.message });
  }
};

export const sendClanMessage = async (req, res) => {
  try {
    const { clanId } = req.params;
    const { content } = req.body || {};
    const userId = req.user.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content cannot be empty' });
    }

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Clan not found' });

    const member = clan.members.find(m => m.userId === userId);
    if (!member) {
      return res.status(403).json({ message: 'You must be a member to chat' });
    }

    const user = await User.findOne({ userId }).select('name avatar equippedBadgeId badges').lean();
    const equippedBadge = user?.badges?.find(b => b.id === user?.equippedBadgeId);

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: userId,
      senderName: user?.name || member.name || 'Clan Member',
      senderAvatar: user?.avatar || member.avatar || null,
      senderRole: member.role || 'member',
      senderBadge: equippedBadge ? {
        id: equippedBadge.id,
        name: equippedBadge.name,
        title: equippedBadge.title || equippedBadge.name,
        icon: equippedBadge.icon,
        rarity: equippedBadge.rarity || 'common'
      } : null,
      content: content.trim().substring(0, 500),
      createdAt: new Date()
    };

    if (!clan.chatMessages) clan.chatMessages = [];
    clan.chatMessages.push(message);
    if (clan.chatMessages.length > 100) {
      clan.chatMessages = clan.chatMessages.slice(-100);
    }

    await clan.save();
    clanCache.invalidateClan(clanId);

    const io = req.app?.get?.('io');
    if (io) {
      io.to(`clan_${clanId}`).emit('new_clan_message', message);
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Error sending clan message', error: error.message });
  }
};

export const editClanMessage = async (req, res) => {
  try {
    const { clanId, messageId } = req.params;
    const { content } = req.body || {};
    const userId = req.user.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content cannot be empty' });
    }

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Clan not found' });

    const member = clan.members.find(m => m.userId === userId);
    const message = (clan.chatMessages || []).find(m => m.id === messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const isLeader = member?.role === 'leader' || clan.leaderId === userId;
    const isElder = member?.role === 'elder';
    const isSender = message.senderId === userId;

    if (!isSender && !isLeader && !isElder) {
      return res.status(403).json({ message: 'No permission to edit this message' });
    }

    message.content = content.trim().substring(0, 500);
    message.isEdited = true;
    message.updatedAt = new Date();

    await clan.save();
    clanCache.invalidateClan(clanId);

    const io = req.app?.get?.('io');
    if (io) {
      io.to(`clan_${clanId}`).emit('clan_message_edited', {
        messageId,
        newContent: message.content,
        isEdited: true,
        updatedAt: message.updatedAt
      });
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: 'Error editing clan message', error: error.message });
  }
};

export const deleteClanMessage = async (req, res) => {
  try {
    const { clanId, messageId } = req.params;
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Clan not found' });

    const member = clan.members.find(m => m.userId === userId);
    const messageIndex = (clan.chatMessages || []).findIndex(m => m.id === messageId);
    if (messageIndex === -1) return res.status(404).json({ message: 'Message not found' });

    const message = clan.chatMessages[messageIndex];
    const isLeader = member?.role === 'leader' || clan.leaderId === userId;
    const isElder = member?.role === 'elder';
    const isSender = message.senderId === userId;

    if (!isSender && !isLeader && !isElder) {
      return res.status(403).json({ message: 'No permission to delete this message' });
    }

    clan.chatMessages.splice(messageIndex, 1);
    await clan.save();
    clanCache.invalidateClan(clanId);

    const io = req.app?.get?.('io');
    if (io) {
      io.to(`clan_${clanId}`).emit('clan_message_deleted', { messageId });
    }

    res.json({ message: 'Message deleted successfully', messageId });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting clan message', error: error.message });
  }
};

// ==========================================
// Class Mode: Invite Link, Track, Sessions & Homework Alerts
// ==========================================

export const getClassByInviteCode = async (req, res) => {
  try {
    const rawCode = String(req.params.inviteCode || '').trim().toUpperCase();
    if (!rawCode) return res.status(400).json({ message: 'Invite code is required' });

    const clan = await Clan.findOne({ inviteCode: rawCode }).lean();
    if (!clan) return res.status(404).json({ message: 'Invalid or expired class invite link' });

    const [leader, track] = await Promise.all([
      User.findOne({ userId: clan.leaderId }).select('userId name avatar').lean(),
      clan.trackId ? SkillTrack.findOne({ trackId: clan.trackId }).select('trackId title icon category modules').lean() : null
    ]);

    const userId = req.user?.userId;
    const isMember = Boolean(userId && (clan.leaderId === userId || (clan.members || []).some(m => m.userId === userId)));

    res.json({
      clanId: clan.clanId,
      name: clan.name,
      tag: clan.tag,
      description: clan.description,
      logo: clan.logo,
      inviteCode: clan.inviteCode,
      leaderId: clan.leaderId,
      leaderName: leader?.name || 'Teacher',
      memberCount: (clan.members || []).length,
      trackId: clan.trackId || null,
      trackTitle: track?.title || null,
      trackIcon: track?.icon || null,
      totalSessions: track?.modules?.length || 0,
      isMember
    });
  } catch (error) {
    res.status(500).json({ message: 'Error loading class invite', error: error.message });
  }
};

export const joinClassByInvite = async (req, res) => {
  try {
    const rawCode = String(req.body?.inviteCode || '').trim().toUpperCase();
    const userId = req.user.userId;

    if (!rawCode) return res.status(400).json({ message: 'Invite code is required' });

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const clan = await Clan.findOne({ inviteCode: rawCode });
    if (!clan) return res.status(404).json({ message: 'Invalid or expired class invite link' });

    if (clan.leaderId === userId || clan.members.some(m => m.userId === userId)) {
      return res.json({ message: 'You are already in this class', clan, alreadyMember: true });
    }

    clan.members.push({ userId, role: 'member', contribution: 0 });
    if (Array.isArray(clan.activeJoinRequests)) {
      clan.activeJoinRequests = clan.activeJoinRequests.filter(r => r.userId !== userId);
    }
    await clan.save();

    if (!user.clanId) {
      user.clanId = clan.clanId;
    }
    if (Array.isArray(user.clanInvites)) {
      user.clanInvites = user.clanInvites.filter(inv => inv.clanId !== clan.clanId);
    }
    if (clan.subjectId) {
      const unlockedSet = new Set((user.unlockedTracks || []).map(String));
      unlockedSet.add(String(clan.subjectId));
      user.unlockedTracks = Array.from(unlockedSet);
    }
    await user.save();

    if (clan.trackId) {
      const finishedIds = (clan.completedSessions || []).map(s => s.moduleId).filter(Boolean);
      const track = await SkillTrack.findOne({ trackId: clan.trackId }).lean();
      const firstModId = track?.modules?.[0]?.moduleId;
      const toUnlock = [...new Set([...finishedIds, ...(firstModId ? [firstModId] : [])])];
      if (toUnlock.length) {
        await unlockModulesForStudents([userId], clan.trackId, toUnlock).catch(() => {});
      }
    }

    clanCache.invalidateClan(clan.clanId);
    evaluateAndAwardBadges(userId).catch(() => {});

    res.json({ message: `Joined ${clan.name} successfully!`, clan });
  } catch (error) {
    res.status(500).json({ message: 'Error joining class via invite link', error: error.message });
  }
};

export const regenerateInviteCode = async (req, res) => {
  try {
    const { clanId } = req.params;
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Class not found' });

    const isTeacherOwner = clan.leaderId === userId || req.user?.role === 'admin';
    if (!isTeacherOwner) {
      return res.status(403).json({ message: 'Only the class teacher can regenerate the invite link' });
    }

    clan.inviteCode = generateInviteCode();
    await clan.save();
    clanCache.invalidateClan(clanId);

    res.json({ inviteCode: clan.inviteCode });
  } catch (error) {
    res.status(500).json({ message: 'Error regenerating invite link', error: error.message });
  }
};

export const setClassTrack = async (req, res) => {
  try {
    const { clanId } = req.params;
    const { trackId } = req.body || {};
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Class not found' });

    const isAdmin = req.user?.role === 'admin' || req.user?.isAdmin === true;
    if (!isAdmin) {
      return res.status(403).json({ message: 'Only administrators can assign or change a class curriculum track' });
    }

    if (!trackId) {
      clan.trackId = null;
      clan.subjectId = null;
      clan.completedSessions = [];
      await clan.save();
      clanCache.invalidateClan(clanId);
      return res.json({ message: 'Class track cleared', clan });
    }

    const track = await SkillTrack.findOne({ trackId }).lean();
    if (!track) return res.status(404).json({ message: 'Track not found' });

    if (clan.trackId !== track.trackId) {
      clan.completedSessions = [];
    }

    clan.trackId = track.trackId;
    clan.subjectId = track.subjectId ? String(track.subjectId) : null;
    await clan.save();
    clanCache.invalidateClan(clanId);

    // Unlock the track's subject for all class members + teacher
    const allMemberIds = [...new Set([clan.leaderId, ...(clan.members || []).map(m => m.userId)].filter(Boolean))];
    if (clan.subjectId) {
      await unlockSubjectForUsers(allMemberIds, clan.subjectId);
    }

    // Unlock first module for students so they can start
    const studentIds = (clan.members || []).map(m => m.userId).filter(id => id && id !== clan.leaderId);
    const firstModId = track.modules?.[0]?.moduleId;
    if (studentIds.length && firstModId) {
      await unlockModulesForStudents(studentIds, track.trackId, [firstModId]).catch(() => {});
    }

    res.json({ message: `Track "${track.title}" assigned to class`, clan, track });
  } catch (error) {
    res.status(500).json({ message: 'Error assigning class track', error: error.message });
  }
};

export const toggleClassSession = async (req, res) => {
  try {
    const { clanId, moduleId } = req.params;
    const { completed = true, note = '', notifyStudents = true } = req.body || {};
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Class not found' });

    const isTeacherOwner = clan.leaderId === userId || req.user?.role === 'admin';
    if (!isTeacherOwner) {
      return res.status(403).json({ message: 'Only the class teacher can finish sessions' });
    }

    if (!clan.trackId) {
      return res.status(400).json({ message: 'Please choose a track for this class first' });
    }

    const track = await SkillTrack.findOne({ trackId: clan.trackId }).lean();
    if (!track) return res.status(404).json({ message: 'Assigned track not found' });

    const sortedModules = [...(track.modules || [])].sort((a, b) => (a.level || 0) - (b.level || 0));
    const modIndex = sortedModules.findIndex(m => m.moduleId === moduleId);
    if (modIndex === -1) {
      return res.status(404).json({ message: 'Session (module) not found in assigned track' });
    }

    const targetModule = sortedModules[modIndex];
    if (!Array.isArray(clan.completedSessions)) clan.completedSessions = [];

    const existingIdx = clan.completedSessions.findIndex(s => s.moduleId === moduleId);
    let unlockedCount = 0;
    const studentIds = (clan.members || []).map(m => m.userId).filter(id => id && id !== clan.leaderId);

    if (completed) {
      if (existingIdx === -1) {
        clan.completedSessions.push({
          moduleId,
          completedAt: new Date(),
          completedBy: userId,
          note: String(note || '').slice(0, 300)
        });
      } else if (note !== undefined) {
        clan.completedSessions[existingIdx].note = String(note || '').slice(0, 300);
      }

      // Unlock this session (and the next one in sequence) for all students in the class
      const modulesToUnlock = [moduleId];
      if (modIndex < sortedModules.length - 1) {
        modulesToUnlock.push(sortedModules[modIndex + 1].moduleId);
      }

      if (clan.subjectId && studentIds.length) {
        await unlockSubjectForUsers(studentIds, clan.subjectId);
      }
      if (studentIds.length) {
        unlockedCount = await unlockModulesForStudents(studentIds, clan.trackId, modulesToUnlock);
      }

      // Notify students if session has homework and notifyStudents is true
      const moduleQuizIds = getModuleQuizIds(targetModule);
      if (notifyStudents && studentIds.length) {
        const hwMessage = moduleQuizIds.length > 0
          ? `${req.user?.name || 'Your teacher'} finished session "${targetModule.title}" in ${clan.name}. Complete your ${moduleQuizIds.length} homework quiz${moduleQuizIds.length > 1 ? 'zes' : ''}!`
          : `${req.user?.name || 'Your teacher'} finished session "${targetModule.title}" in ${clan.name}.`;

        const link = moduleQuizIds.length === 1
          ? `/quiz/${encodeURIComponent(moduleQuizIds[0])}`
          : '/clans';

        await Promise.all(studentIds.map(studentId =>
          createAndSendNotification(req.app, {
            recipientId: studentId,
            senderId: userId,
            senderName: req.user?.name || 'Teacher',
            type: moduleQuizIds.length > 0 ? 'homework_alert' : 'system',
            title: `Session Finished: ${targetModule.title}`,
            message: hwMessage,
            link,
            skipEmail: true,
            metadata: {
              clanId: clan.clanId,
              className: clan.name,
              moduleId,
              moduleTitle: targetModule.title,
              quizId: moduleQuizIds[0] || ''
            }
          })
        ));

        await dispatchClassAlertEmails({
          targetIds: studentIds,
          teacherName: req.user?.name || 'Teacher',
          className: clan.name,
          moduleTitle: targetModule.title,
          alertTitle: `Session Finished: ${targetModule.title}`,
          message: hwMessage,
          actionPath: link
        }).catch(() => 0);
      }
    } else {
      if (existingIdx !== -1) {
        clan.completedSessions.splice(existingIdx, 1);
      }
    }

    await clan.save();
    clanCache.invalidateClan(clanId);

    const io = req.app?.get?.('io');
    if (io) {
      io.to(`clan_${clanId}`).emit('class_session_updated', {
        clanId,
        moduleId,
        completed: Boolean(completed),
        completedSessions: clan.completedSessions
      });
    }

    res.json({
      message: completed ? `Session "${targetModule.title}" marked as finished` : `Session "${targetModule.title}" reopened`,
      completedSessions: clan.completedSessions,
      unlockedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating class session', error: error.message });
  }
};

export const getClassHomeworkStatus = async (req, res) => {
  try {
    const { clanId } = req.params;
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId }).lean();
    if (!clan) return res.status(404).json({ message: 'Class not found' });

    const isMember = clan.leaderId === userId || (clan.members || []).some(m => m.userId === userId) || req.user?.role === 'admin';
    if (!isMember) {
      return res.status(403).json({ message: 'You must be a member of this class to view curriculum status' });
    }

    if (!clan.trackId) {
      return res.json({
        track: null,
        sessions: [],
        students: [],
        homeworkAlerts: [...(clan.homeworkAlerts || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      });
    }

    const track = await SkillTrack.findOne({ trackId: clan.trackId }).lean();
    if (!track) {
      return res.json({
        track: null,
        sessions: [],
        students: [],
        homeworkAlerts: [...(clan.homeworkAlerts || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      });
    }

    const sortedModules = [...(track.modules || [])].sort((a, b) => (a.level || 0) - (b.level || 0));
    const allQuizIds = [...new Set(sortedModules.flatMap(m => getModuleQuizIds(m)))];

    const studentMembers = (clan.members || []).filter(m => m.userId !== clan.leaderId);
    const studentIds = studentMembers.map(m => m.userId);

    const [quizzes, attempts, studentUsers] = await Promise.all([
      allQuizIds.length ? Quiz.find({ id: { $in: allQuizIds } }).select('id title passingScore timeLimit questions').lean() : [],
      (studentIds.length && allQuizIds.length)
        ? Attempt.find({ userId: { $in: studentIds }, quizId: { $in: allQuizIds } })
            .select('userId quizId percentage score passed completedAt')
            .sort({ completedAt: -1 })
            .lean()
        : [],
      studentIds.length
        ? User.find({ userId: { $in: studentIds } }).select('userId name email avatar xp totalScore').lean()
        : []
    ]);

    const quizMap = new Map(quizzes.map(q => [q.id, q]));
    const userMap = new Map(studentUsers.map(u => [u.userId, u]));
    const finishedMap = new Map((clan.completedSessions || []).map(s => [s.moduleId, s]));

    // Map attempts by `${userId}:${quizId}`
    const attemptStatsMap = new Map();
    for (const att of attempts) {
      const key = `${att.userId}:${att.quizId}`;
      const existing = attemptStatsMap.get(key) || {
        attemptsCount: 0,
        bestPercentage: 0,
        passed: false,
        lastAttemptAt: null
      };
      existing.attemptsCount += 1;
      if ((att.percentage || 0) > existing.bestPercentage) {
        existing.bestPercentage = att.percentage || 0;
      }
      const quizObj = quizMap.get(att.quizId);
      const passThreshold = quizObj?.passingScore ?? 70;
      if (att.passed || (att.percentage || 0) >= passThreshold) {
        existing.passed = true;
      }
      if (!existing.lastAttemptAt || new Date(att.completedAt) > new Date(existing.lastAttemptAt)) {
        existing.lastAttemptAt = att.completedAt;
      }
      attemptStatsMap.set(key, existing);
    }

    const students = studentMembers.map(member => {
      const userObj = userMap.get(member.userId);
      const sessionProgress = {};
      let finishedHomeworkSessions = 0;
      let totalHomeworkSessions = 0;

      for (const mod of sortedModules) {
        const modQuizIds = getModuleQuizIds(mod);
        const isFinished = finishedMap.has(mod.moduleId);

        if (modQuizIds.length === 0) {
          sessionProgress[mod.moduleId] = {
            status: 'no_homework',
            quizzes: []
          };
          continue;
        }

        if (isFinished) {
          totalHomeworkSessions += 1;
        }

        const quizStatuses = modQuizIds.map(qId => {
          const qObj = quizMap.get(qId);
          const stat = attemptStatsMap.get(`${member.userId}:${qId}`);
          return {
            quizId: qId,
            title: qObj?.title || qId,
            passingScore: qObj?.passingScore ?? 70,
            attempted: Boolean(stat),
            passed: Boolean(stat?.passed),
            bestPercentage: stat?.bestPercentage ?? 0,
            attemptsCount: stat?.attemptsCount ?? 0,
            lastAttemptAt: stat?.lastAttemptAt || null
          };
        });

        const allPassed = quizStatuses.every(q => q.passed);
        const anyAttempted = quizStatuses.some(q => q.attempted);

        if (allPassed && isFinished) {
          finishedHomeworkSessions += 1;
        }

        sessionProgress[mod.moduleId] = {
          status: allPassed ? 'completed' : anyAttempted ? 'in_progress' : 'not_started',
          quizzes: quizStatuses
        };
      }

      return {
        userId: member.userId,
        name: userObj?.name || 'Student',
        email: userObj?.email || '',
        avatar: userObj?.avatar || null,
        xp: userObj?.xp || 0,
        totalScore: userObj?.totalScore || 0,
        sessionProgress,
        finishedHomeworkSessions,
        totalHomeworkSessions
      };
    });

    const sessions = sortedModules.map(mod => {
      const modQuizIds = getModuleQuizIds(mod);
      const finishedInfo = finishedMap.get(mod.moduleId);
      const sessionQuizzes = modQuizIds.map(qId => {
        const q = quizMap.get(qId);
        return {
          id: qId,
          title: q?.title || qId,
          passingScore: q?.passingScore ?? 70,
          questionsCount: q?.questions?.length || 0
        };
      });

      const incompleteStudentIds = modQuizIds.length > 0
        ? students
            .filter(s => s.sessionProgress[mod.moduleId]?.status !== 'completed')
            .map(s => s.userId)
        : [];

      const completedStudentsCount = modQuizIds.length > 0
        ? students.length - incompleteStudentIds.length
        : 0;

      return {
        moduleId: mod.moduleId,
        title: mod.title,
        description: mod.description || '',
        level: mod.level || 0,
        type: mod.type || 'core',
        isFinished: Boolean(finishedInfo),
        finishedAt: finishedInfo?.completedAt || null,
        note: finishedInfo?.note || '',
        subModulesCount: (mod.subModules || []).length,
        subModules: (mod.subModules || []).map(sm => ({ id: sm.id, title: sm.title })),
        quizzes: sessionQuizzes,
        completedStudentsCount,
        totalStudentsCount: students.length,
        incompleteStudentIds
      };
    });

    const sortedAlerts = [...(clan.homeworkAlerts || [])].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({
      track: {
        trackId: track.trackId,
        title: track.title,
        description: track.description || '',
        icon: track.icon || '🗺️',
        category: track.category || 'General',
        subjectId: track.subjectId ? String(track.subjectId) : null
      },
      sessions,
      students,
      homeworkAlerts: sortedAlerts
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching class homework status', error: error.message });
  }
};

export const sendHomeworkAlert = async (req, res) => {
  try {
    const { clanId } = req.params;
    const { moduleId, quizId = '', targetUserIds, message } = req.body || {};
    const userId = req.user.userId;

    const clan = await Clan.findOne({ clanId });
    if (!clan) return res.status(404).json({ message: 'Class not found' });

    const isTeacherOwner = clan.leaderId === userId || req.user?.role === 'admin';
    if (!isTeacherOwner) {
      return res.status(403).json({ message: 'Only the class teacher can send homework alerts' });
    }

    if (!clan.trackId) {
      return res.status(400).json({ message: 'No track assigned to this class yet' });
    }

    const track = await SkillTrack.findOne({ trackId: clan.trackId }).lean();
    if (!track) return res.status(404).json({ message: 'Assigned track not found' });

    const targetModule = (track.modules || []).find(m => m.moduleId === moduleId);
    if (!targetModule) {
      return res.status(404).json({ message: 'Session (module) not found in assigned track' });
    }

    const modQuizIds = getModuleQuizIds(targetModule);
    const checkQuizIds = quizId ? [quizId] : modQuizIds;

    const studentIds = (clan.members || [])
      .map(m => m.userId)
      .filter(id => id && id !== clan.leaderId);

    if (studentIds.length === 0) {
      return res.status(400).json({ message: 'No students enrolled in this class yet' });
    }

    let resolvedTargetIds = [];
    if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      const validSet = new Set(studentIds);
      resolvedTargetIds = [...new Set(targetUserIds.filter(id => validSet.has(id)))];
    } else if (checkQuizIds.length > 0) {
      const [quizzes, attempts] = await Promise.all([
        Quiz.find({ id: { $in: checkQuizIds } }).select('id passingScore').lean(),
        Attempt.find({ userId: { $in: studentIds }, quizId: { $in: checkQuizIds } })
          .select('userId quizId percentage passed')
          .lean()
      ]);
      const passMap = new Map(quizzes.map(q => [q.id, q.passingScore ?? 70]));
      const passedPairs = new Set();
      for (const att of attempts) {
        const threshold = passMap.get(att.quizId) ?? 70;
        if (att.passed || (att.percentage || 0) >= threshold) {
          passedPairs.add(`${att.userId}:${att.quizId}`);
        }
      }
      resolvedTargetIds = studentIds.filter(sId =>
        checkQuizIds.some(qId => !passedPairs.has(`${sId}:${qId}`))
      );
    } else {
      resolvedTargetIds = studentIds;
    }

    if (resolvedTargetIds.length === 0) {
      return res.json({
        alertedCount: 0,
        alertedUserIds: [],
        message: 'All students have already completed this homework!'
      });
    }

    const primaryQuizId = quizId || modQuizIds[0] || '';
    const link = primaryQuizId ? `/quiz/${encodeURIComponent(primaryQuizId)}` : '/clans';
    const customNote = typeof message === 'string' ? message.trim().slice(0, 300) : '';
    const alertTitle = `📚 Homework Reminder: ${targetModule.title}`;
    const alertBody = customNote || `Your teacher ${req.user?.name || 'Teacher'} reminded you to finish the homework for "${targetModule.title}" in ${clan.name}.`;

    const io = req.app?.get?.('io');

    await Promise.all(resolvedTargetIds.map(async (studentId) => {
      await createAndSendNotification(req.app, {
        recipientId: studentId,
        senderId: userId,
        senderName: req.user?.name || 'Teacher',
        type: 'homework_alert',
        title: alertTitle,
        message: alertBody,
        note: customNote,
        link,
        skipEmail: true,
        metadata: {
          clanId: clan.clanId,
          className: clan.name,
          moduleId: targetModule.moduleId,
          moduleTitle: targetModule.title,
          quizId: primaryQuizId
        }
      });

      if (io) {
        io.to(studentId).emit('homework_alert', {
          clanId: clan.clanId,
          className: clan.name,
          moduleId: targetModule.moduleId,
          moduleTitle: targetModule.title,
          quizId: primaryQuizId,
          title: alertTitle,
          message: alertBody,
          link,
          teacherName: req.user?.name || 'Teacher'
        });
      }
    }));

    const emailedCount = await dispatchClassAlertEmails({
      targetIds: resolvedTargetIds,
      teacherName: req.user?.name || 'Teacher',
      className: clan.name,
      moduleTitle: targetModule.title,
      alertTitle,
      message: alertBody,
      actionPath: link
    }).catch(() => 0);

    const alertRecord = {
      alertId: crypto.randomUUID(),
      moduleId: targetModule.moduleId,
      moduleTitle: targetModule.title,
      quizId: primaryQuizId,
      targetUserIds: resolvedTargetIds,
      message: alertBody,
      createdBy: userId,
      createdAt: new Date()
    };

    if (!Array.isArray(clan.homeworkAlerts)) clan.homeworkAlerts = [];
    clan.homeworkAlerts.unshift(alertRecord);
    if (clan.homeworkAlerts.length > 50) {
      clan.homeworkAlerts = clan.homeworkAlerts.slice(0, 50);
    }

    await clan.save();
    clanCache.invalidateClan(clanId);

    res.json({
      message: `Sent homework reminder to ${resolvedTargetIds.length} student${resolvedTargetIds.length === 1 ? '' : 's'}${emailedCount > 0 ? ` (emailed ${emailedCount})` : ''}`,
      alertedCount: resolvedTargetIds.length,
      emailedCount,
      alertedUserIds: resolvedTargetIds,
      alertRecord
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending homework alert', error: error.message });
  }
};

// ==========================================
// Admin Class Provisioning & Assignment
// ==========================================
export const adminGetAllClasses = async (_req, res) => {
  try {
    const classes = await Clan.find().sort({ createdAt: -1 }).lean();
    if (!classes.length) return res.json([]);

    const allMemberIds = [...new Set(classes.flatMap(c => [c.leaderId, ...(c.members || []).map(m => m.userId)]).filter(Boolean))];
    const trackIds = [...new Set(classes.map(c => c.trackId).filter(Boolean))];

    const [users, tracks] = await Promise.all([
      User.find({ userId: { $in: allMemberIds } }).select('userId name email role avatar').lean(),
      trackIds.length ? SkillTrack.find({ trackId: { $in: trackIds } }).select('trackId title icon modules').lean() : []
    ]);

    const userMap = new Map(users.map(u => [u.userId, u]));
    const trackMap = new Map(tracks.map(t => [t.trackId, t]));

    const enriched = classes.map(c => {
      const teacher = userMap.get(c.leaderId);
      const track = c.trackId ? trackMap.get(c.trackId) : null;
      const studentMembers = (c.members || []).filter(m => m.userId !== c.leaderId);
      return {
        clanId: c.clanId,
        name: c.name,
        tag: c.tag,
        description: c.description || '',
        leaderId: c.leaderId,
        leaderName: teacher?.name || 'Unassigned',
        leaderEmail: teacher?.email || '',
        isPublic: Boolean(c.isPublic),
        logo: c.logo,
        inviteCode: c.inviteCode,
        trackId: c.trackId || null,
        subjectId: c.subjectId || null,
        trackTitle: track?.title || null,
        trackIcon: track?.icon || null,
        totalSessions: track?.modules?.length || 0,
        finishedSessionsCount: (c.completedSessions || []).length,
        memberCount: (c.members || []).length,
        studentIds: studentMembers.map(m => m.userId),
        students: studentMembers.map(m => {
          const u = userMap.get(m.userId);
          return {
            userId: m.userId,
            name: u?.name || m.userId,
            email: u?.email || '',
            role: m.role || 'member',
            avatar: u?.avatar
          };
        }),
        createdAt: c.createdAt
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load classes', error: error.message });
  }
};

export const adminAssignClass = async (req, res) => {
  try {
    const { clanId } = req.params;
    const { teacherId, studentIds, trackId, name, description, isPublic, logo } = req.body || {};

    const cls = await Clan.findOne({ clanId });
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const previousLeaderId = cls.leaderId;
    let nextLeaderId = cls.leaderId;

    if (teacherId && String(teacherId).trim()) {
      const targetTeacher = await User.findOne({ userId: String(teacherId).trim() }).lean();
      if (!targetTeacher) {
        return res.status(404).json({ message: 'Selected teacher account not found' });
      }
      if (targetTeacher.role !== 'teacher' && targetTeacher.role !== 'admin' && targetTeacher.isAdmin !== true) {
        return res.status(400).json({ message: 'Assigned teacher must have teacher or admin role' });
      }
      nextLeaderId = targetTeacher.userId;
      cls.leaderId = nextLeaderId;
    }

    const existingMemberMap = new Map((cls.members || []).map(m => [m.userId, m]));

    if (Array.isArray(studentIds)) {
      const nextStudentIds = [...new Set(
        studentIds.map(id => String(id).trim()).filter(id => id && id !== nextLeaderId)
      )];
      const prevStudentIds = (cls.members || [])
        .map(m => m.userId)
        .filter(id => id !== previousLeaderId && id !== nextLeaderId);
      const nextSet = new Set(nextStudentIds);
      const removedIds = prevStudentIds.filter(id => !nextSet.has(id));

      const teacherExisting = existingMemberMap.get(nextLeaderId);
      const updatedMembers = [
        {
          userId: nextLeaderId,
          role: 'leader',
          joinedAt: teacherExisting?.joinedAt || new Date(),
          contribution: teacherExisting?.contribution || 0
        },
        ...nextStudentIds.map(sid => {
          const existing = existingMemberMap.get(sid);
          return {
            userId: sid,
            role: existing?.role === 'elder' ? 'elder' : 'member',
            joinedAt: existing?.joinedAt || new Date(),
            contribution: existing?.contribution || 0
          };
        })
      ];

      cls.members = updatedMembers;

      if (removedIds.length > 0) {
        await User.updateMany(
          { userId: { $in: removedIds }, clanId },
          { $set: { clanId: null } }
        );
      }
      await User.updateMany(
        {
          userId: { $in: [nextLeaderId, ...nextStudentIds] },
          $or: [{ clanId: null }, { clanId: { $exists: false } }, { clanId: '' }]
        },
        { $set: { clanId } }
      );
    } else if (nextLeaderId !== previousLeaderId) {
      const withoutOldLeader = (cls.members || []).filter(m => m.userId !== previousLeaderId && m.userId !== nextLeaderId);
      const existingNewTeacher = existingMemberMap.get(nextLeaderId);
      cls.members = [
        {
          userId: nextLeaderId,
          role: 'leader',
          joinedAt: existingNewTeacher?.joinedAt || new Date(),
          contribution: existingNewTeacher?.contribution || 0
        },
        ...withoutOldLeader
      ];

      if (previousLeaderId) {
        await User.updateMany({ userId: previousLeaderId, clanId }, { $set: { clanId: null } });
      }
      await User.updateMany(
        {
          userId: nextLeaderId,
          $or: [{ clanId: null }, { clanId: { $exists: false } }, { clanId: '' }]
        },
        { $set: { clanId } }
      );
    }

    if (name !== undefined && String(name).trim()) {
      cls.name = String(name).trim();
    }
    if (description !== undefined) {
      cls.description = String(description);
    }
    if (isPublic !== undefined) {
      cls.isPublic = Boolean(isPublic);
    }
    if (logo !== undefined) {
      cls.logo = logo;
    }
    if (trackId !== undefined) {
      if (!trackId) {
        cls.trackId = null;
        cls.subjectId = null;
      } else {
        const track = await SkillTrack.findOne({ trackId }).lean();
        if (!track) return res.status(404).json({ message: 'Selected track not found' });
        cls.trackId = track.trackId;
        cls.subjectId = track.subjectId ? String(track.subjectId) : null;
      }
    }

    await cls.save();

    if (cls.subjectId) {
      const memberIds = (cls.members || []).map(m => m.userId);
      await unlockSubjectForUsers(memberIds, cls.subjectId);
    }

    clanCache.invalidateClan(clanId);
    res.json({ message: 'Class assignments updated', clan: cls });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update class assignments', error: error.message });
  }
};

export const adminDeleteClass = async (req, res) => {
  try {
    const { clanId } = req.params;
    const deleted = await Clan.findOneAndDelete({ clanId }).lean();
    if (!deleted) return res.status(404).json({ message: 'Class not found' });

    await User.updateMany({ clanId }, { $set: { clanId: null } });
    clanCache.invalidateClan(clanId);
    res.json({ message: 'Class deleted', clanId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete class', error: error.message });
  }
};
