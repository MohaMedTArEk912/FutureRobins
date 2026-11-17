import express from 'express';
import * as classroomController from '../controllers/classroomController.js';

const router = express.Router();

router.get('/active', classroomController.listActiveRooms);
router.post('/rooms', classroomController.createRoom);
router.post('/rooms/:pin/join', classroomController.joinRoom);
router.get('/rooms/:pin/state', classroomController.getRoomState);
router.patch('/rooms/:pin/settings', classroomController.updateRoomSettings);
router.post('/rooms/:pin/bot', classroomController.togglePracticeBot);
router.post('/rooms/:pin/start', classroomController.startRoom);
router.post('/rooms/:pin/submit', classroomController.submitAnswer);
router.post('/rooms/:pin/reveal', classroomController.revealQuestion);
router.post('/rooms/:pin/next', classroomController.nextQuestion);
router.post('/rooms/:pin/invite', classroomController.inviteToRoom);
router.post('/rooms/:pin/leave', classroomController.leaveRoom);
router.delete('/rooms/:pin', classroomController.closeRoom);

export default router;
