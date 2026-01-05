import express from 'express';
import {
  getTemplates,
  getTemplatePreview,
  sendTestEmail,
} from '../Controller/emailTemplateController.js';
import { verifyToken, isSuperAdmin } from '../Middleware/auth.js';

const router = express.Router();

// All routes require super admin
router.use(verifyToken, isSuperAdmin);

// Get list of all email templates
router.get('/', getTemplates);

// Get preview of a specific template
router.get('/preview/:templateId', getTemplatePreview);

// Send test email
router.post('/send-test/:templateId', sendTestEmail);

export default router;
