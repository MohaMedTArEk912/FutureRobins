import express from 'express';
import { verifyUser, verifyAdmin, extractOptionalUser } from '../middleware/authMiddleware.js';
import { 
  createClan,
  getMyClasses,
  getClan, 
  searchClans, 
  joinClan, 
  leaveClan, 
  getClanLeaderboard, 
  updateClan, 
  inviteToClan, 
  respondToClanInvite, 
  handleJoinRequest, 
  kickMember, 
  updateMemberRole, 
  createClanAnnouncement, 
  deleteClanAnnouncement, 
  pinClanAnnouncement,
  getClanMessages,
  sendClanMessage,
  editClanMessage,
  deleteClanMessage,
  getClassByInviteCode,
  joinClassByInvite,
  regenerateInviteCode,
  setClassTrack,
  toggleClassSession,
  getClassHomeworkStatus,
  sendHomeworkAlert,
  adminGetAllClasses,
  adminAssignClass,
  adminDeleteClass
} from '../controllers/classController.js';
import {
  getClassAnalyticsAndLogs,
  generateQuestionsFromSlides,
  publishGeneratedQuizToClass,
  generateTeacherAiToolOutput
} from '../controllers/teacherToolsController.js';

const router = express.Router();

// ===== ADMIN PROVISIONING & ASSIGNMENT ROUTES =====
router.get('/admin/all', verifyAdmin, adminGetAllClasses);
router.put('/admin/:clanId/assign', verifyAdmin, adminAssignClass);
router.delete('/admin/:clanId', verifyAdmin, adminDeleteClass);

// ===== STATIC ROUTES FIRST (before parameterized routes) =====
router.post('/create', verifyAdmin, createClan);
router.get('/my', verifyUser, getMyClasses);
router.get('/search', verifyUser, searchClans); // Query param ?query=
router.get('/leaderboard', getClanLeaderboard); // Public endpoint
router.get('/invite/:inviteCode', extractOptionalUser, getClassByInviteCode);
router.post('/join-by-invite', verifyUser, joinClassByInvite);
router.post('/join', verifyUser, joinClan);
router.post('/leave', verifyUser, leaveClan);
router.post('/invite', verifyUser, inviteToClan);
router.post('/respond-invite', verifyUser, respondToClanInvite);
router.post('/join-request', verifyUser, handleJoinRequest);
router.post('/kick', verifyUser, kickMember);
router.put('/role', verifyUser, updateMemberRole);

// ===== PARAMETERIZED ROUTES LAST =====
router.get('/:clanId', verifyUser, getClan);
router.put('/:clanId', verifyAdmin, updateClan);
router.post('/:clanId/regenerate-invite', verifyUser, regenerateInviteCode);
router.put('/:clanId/track', verifyAdmin, setClassTrack);
router.post('/:clanId/sessions/:moduleId/complete', verifyUser, toggleClassSession);
router.get('/:clanId/homework-status', verifyUser, getClassHomeworkStatus);
router.post('/:clanId/homework-alert', verifyUser, sendHomeworkAlert);
router.get('/:clanId/analytics', verifyUser, getClassAnalyticsAndLogs);
router.post('/:clanId/ai/generate-questions', verifyUser, generateQuestionsFromSlides);
router.post('/:clanId/ai/publish-quiz', verifyUser, publishGeneratedQuizToClass);
router.post('/:clanId/ai/toolkit', verifyUser, generateTeacherAiToolOutput);
router.post('/:clanId/announcements', verifyUser, createClanAnnouncement);
router.delete('/:clanId/announcements/:announcementId', verifyUser, deleteClanAnnouncement);
router.put('/:clanId/announcements/:announcementId/pin', verifyUser, pinClanAnnouncement);

// Clan Chat REST Endpoints
router.get('/:clanId/messages', verifyUser, getClanMessages);
router.post('/:clanId/messages', verifyUser, sendClanMessage);
router.put('/:clanId/messages/:messageId', verifyUser, editClanMessage);
router.delete('/:clanId/messages/:messageId', verifyUser, deleteClanMessage);

export default router;
