import express from 'express';
import multer from 'multer';
import { verifyUser } from '../middleware/authMiddleware.js';
import {
  getPresentations,
  getPresentationById,
  savePresentation,
  deletePresentation,
  assignPresentationToModules,
  getSamplePresentationJson,
  convertSlidesToMotion,
  exportPresentation
} from '../controllers/presentationController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/json',
      'application/xml',
      'text/xml'
    ];
    if (allowedMimes.includes(file.mimetype) || /\.(pdf|pptx|txt|md|json|xml)$/i.test(file.originalname || '')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid slide file format. Allowed: PDF, PPTX, TXT, MD, JSON, XML'));
    }
  }
});

router.get('/sample-json', getSamplePresentationJson);
router.get('/', verifyUser, getPresentations);
router.post('/', verifyUser, savePresentation);
router.post('/convert', verifyUser, upload.single('file'), convertSlidesToMotion);
router.patch('/:presentationId/assign', verifyUser, assignPresentationToModules);
router.get('/:presentationId/export', verifyUser, exportPresentation);
router.get('/:presentationId', verifyUser, getPresentationById);
router.delete('/:presentationId', verifyUser, deletePresentation);

export default router;
