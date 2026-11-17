import crypto from 'crypto';
import Groq from 'groq-sdk';
import { Class as Clan } from '../models/Class.js';
import { User } from '../models/User.js';
import { SkillTrack } from '../models/SkillTrack.js';
import { Quiz } from '../models/Quiz.js';
import { Attempt } from '../models/Attempt.js';
import { Presentation } from '../models/Presentation.js';
import { extractUserMistakes } from './analyticsController.js';
import { sanitizeQuestions } from './quizController.js';
import { createAndSendNotification } from './notificationController.js';
import { sendHomeworkAlertEmail, isDeliverableEmail } from '../services/emailService.js';
import { runInBackground } from '../utils/vercelUtils.js';
import { parsePresentationPayload } from '../utils/motionSlideParser.js';
import { smartTruncate } from '../utils/tokenOptimizer.js';

const getGroqClient = () => {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) return null;
  return new Groq({ apiKey: key });
};

const TEACHER_AI_MODELS = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b'
];

const getModuleQuizIds = (mod) => {
  const ids = new Set(Array.isArray(mod?.quizIds) ? mod.quizIds.filter(Boolean) : []);
  if (mod?.quizId) ids.add(mod.quizId);
  return Array.from(ids);
};

async function verifyTeacherClassAccess(clanId, user) {
  const clan = await Clan.findOne({ clanId }).lean();
  if (!clan) {
    return { errorStatus: 404, errorMessage: 'Class not found' };
  }
  const isTeacherOwner = clan.leaderId === user?.userId || user?.role === 'admin' || Boolean(user?.isAdmin);
  if (!isTeacherOwner) {
    return { errorStatus: 403, errorMessage: 'Only the class teacher or an admin can access teacher tools & analytics' };
  }
  return { clan };
}

async function callGroqJson(prompt, systemPrompt, temperature = 0.35) {
  const groq = getGroqClient();
  if (!groq) return null;

  for (const model of TEACHER_AI_MODELS) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        model,
        response_format: { type: 'json_object' },
        temperature
      });
      const content = completion.choices[0]?.message?.content;
      if (content) {
        return { parsed: JSON.parse(content), model };
      }
    } catch (err) {
      console.warn(`⚠️ [TeacherAI] Model ${model} failed:`, err.message);
    }
  }
  return null;
}

/**
 * Serializes a Motion Slide deck (JSON/XML) cleanly into rich instructional context
 * preserving wireframes, layouts, code snippets, bullets, and speaker notes.
 */
function formatSlidesForTeacherPrompt(deck) {
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  return slides.map((s, idx) => {
    const parts = [
      `Slide ${idx + 1} [${s.layout || 'bullets'}]: ${s.title || 'Untitled'}`
    ];
    if (s.subtitle) parts.push(`Subtitle: ${s.subtitle}`);
    if (s.body) parts.push(`Explanation: ${s.body}`);
    if (Array.isArray(s.bullets) && s.bullets.length > 0) {
      parts.push(`Key Points:\n${s.bullets.map(b => `  - ${b}`).join('\n')}`);
    }
    if (s.codeSnippet?.code) {
      parts.push(`Code Example (${s.codeSnippet.language || 'code'}):\n${s.codeSnippet.code}`);
    }
    if (s.visualBlock && typeof s.visualBlock === 'object') {
      parts.push(`Interactive Structure/Visual: ${JSON.stringify(s.visualBlock)}`);
    }
    if (s.callout) parts.push(`Key Takeaway: ${s.callout}`);
    if (s.speakerNotes) parts.push(`Teacher Notes: ${s.speakerNotes}`);
    if (s.checkupQuestion) {
      parts.push(`Existing Checkup Question (DO NOT duplicate verbatim): ${s.checkupQuestion.question}`);
    }
    return parts.join('\n');
  }).join('\n\n---\n\n');
}

/**
 * Builds reliable fallback questions directly from the slide deck when Groq API is unavailable.
 */
function buildFallbackQuestionsFromSlides(deck, count = 5) {
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  const generated = [];

  for (let i = 0; i < slides.length && generated.length < count; i++) {
    const slide = slides[i];
    if (slide.checkupQuestion && generated.length < count) {
      const cq = slide.checkupQuestion;
      generated.push({
        id: generated.length + 1,
        type: 'multiple-choice',
        question: cq.question,
        options: Array.isArray(cq.options) && cq.options.length >= 2 ? cq.options : ['True', 'False'],
        correctAnswer: Number.isInteger(Number(cq.correctAnswer)) ? Number(cq.correctAnswer) : 0,
        explanation: cq.explanation || `Directly reinforces "${slide.title}".`,
        points: 10,
        bloomLevel: 'Understand',
        sourceSlideTitle: slide.title
      });
      continue;
    }

    if (Array.isArray(slide.bullets) && slide.bullets.length >= 2) {
      const targetBullet = slide.bullets[0];
      const otherBullets = slides
        .flatMap(s => s.bullets || [])
        .filter(b => b !== targetBullet && b.length > 6);

      const distractors = [
        otherBullets[0] || 'Skip semantic HTML containers and use only inline spans',
        otherBullets[1] || 'Hardcode pixel heights so layout never adapts to screen size',
        'Avoid testing responsive layout alignment until final deployment'
      ];

      generated.push({
        id: generated.length + 1,
        type: 'multiple-choice',
        question: `In "${slide.title}", which guideline or step accurately applies to this section?`,
        options: [targetBullet, distractors[0], distractors[1], distractors[2]],
        correctAnswer: 0,
        explanation: `"${targetBullet}" is a core point covered in "${slide.title}". The remaining choices contradict the slide structure or belong to unrelated practices.`,
        points: 10,
        bloomLevel: 'Apply',
        sourceSlideTitle: slide.title,
        ...(slide.codeSnippet?.code ? { codeSnippet: slide.codeSnippet.code } : {})
      });
    }
  }

  return generated;
}

/**
 * GET /api/clans/:clanId/analytics
 * Comprehensive teacher analytics & unified student activity/performance logs for the class.
 */
export const getClassAnalyticsAndLogs = async (req, res) => {
  try {
    const { clanId } = req.params;
    const access = await verifyTeacherClassAccess(clanId, req.user);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({ message: access.errorMessage });
    }
    const { clan } = access;

    const studentMembers = (clan.members || []).filter(m => m.userId !== clan.leaderId);
    const studentIds = studentMembers.map(m => m.userId);
    const joinedAtMap = new Map(studentMembers.map(m => [m.userId, m.joinedAt || clan.createdAt]));

    const [track, studentUsers, rawAttempts, allQuizzes] = await Promise.all([
      clan.trackId ? SkillTrack.findOne({ trackId: clan.trackId }).lean() : null,
      studentIds.length
        ? User.find({ userId: { $in: studentIds } })
            .select('userId name email avatar xp level streak totalScore totalAttempts totalTime lastLoginDate createdAt')
            .lean()
        : [],
      studentIds.length
        ? Attempt.find({ userId: { $in: studentIds } })
            .sort({ completedAt: -1 })
            .limit(800)
            .lean()
        : [],
      Quiz.find({}).select('id _id title category difficulty passingScore questions linkedTrackId linkedModuleId linkedClanId').lean()
    ]);

    const quizMap = new Map();
    allQuizzes.forEach(q => {
      if (q.id) quizMap.set(String(q.id), q);
      if (q._id) quizMap.set(String(q._id), q);
    });

    const userMap = new Map(studentUsers.map(u => [u.userId, u]));
    const sortedModules = track
      ? [...(track.modules || [])].sort((a, b) => (a.level || 0) - (b.level || 0))
      : [];
    const finishedSet = new Set((clan.completedSessions || []).map(s => s.moduleId));

    // Scope analytics strictly to quizzes belonging to this class's assigned track (or published directly for this class)
    const trackModuleIds = new Set(sortedModules.map(m => String(m.moduleId)));
    const trackQuizIds = new Set();
    sortedModules.forEach(mod => {
      getModuleQuizIds(mod).forEach(qId => trackQuizIds.add(String(qId)));
      (mod.subModules || []).forEach(sub => {
        if (sub?.quizId) trackQuizIds.add(String(sub.quizId));
      });
    });
    allQuizzes.forEach(q => {
      const matchesTrack = Boolean(
        track && (
          q.linkedTrackId === track.trackId
          || (q.linkedModuleId && trackModuleIds.has(String(q.linkedModuleId)))
        )
      );
      const matchesClass = Boolean(q.linkedClanId && q.linkedClanId === clan.clanId);
      if (matchesTrack || matchesClass) {
        if (q.id) trackQuizIds.add(String(q.id));
        if (q._id) trackQuizIds.add(String(q._id));
      }
    });

    const attempts = rawAttempts.filter(att => trackQuizIds.has(String(att.quizId)));

    // Pre-index attempts by student & quiz
    const attemptsByStudent = new Map();
    const attemptsByQuiz = new Map();
    for (const att of attempts) {
      if (!attemptsByStudent.has(att.userId)) attemptsByStudent.set(att.userId, []);
      attemptsByStudent.get(att.userId).push(att);

      if (!attemptsByQuiz.has(att.quizId)) attemptsByQuiz.set(att.quizId, []);
      attemptsByQuiz.get(att.quizId).push(att);
    }

    const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const homeworkModules = sortedModules.filter(m => getModuleQuizIds(m).length > 0 && finishedSet.has(m.moduleId));

    // Per-student metrics + personal mistakes/weak topics
    const classTopicErrorsMap = new Map();
    const studentsAnalytics = studentIds.map(sId => {
      const u = userMap.get(sId);
      const sAttempts = attemptsByStudent.get(sId) || [];
      const attemptsCount = sAttempts.length;

      const avgScore = attemptsCount > 0
        ? Math.round(sAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / attemptsCount)
        : 0;
      const passedCount = sAttempts.filter(a => {
        const q = quizMap.get(String(a.quizId));
        return Boolean(a.passed) || (a.percentage || 0) >= (q?.passingScore ?? 70);
      }).length;
      const passRate = attemptsCount > 0 ? Math.round((passedCount / attemptsCount) * 100) : 0;
      const totalTimeSeconds = sAttempts.reduce((sum, a) => sum + (a.timeTaken || 0), 0);

      // Trend calculation comparing latest 3 vs preceding 3 attempts
      let recentTrend = 'stable';
      if (sAttempts.length >= 4) {
        const recentAvg = sAttempts.slice(0, 3).reduce((s, a) => s + (a.percentage || 0), 0) / 3;
        const prevSlice = sAttempts.slice(3, 6);
        const prevAvg = prevSlice.reduce((s, a) => s + (a.percentage || 0), 0) / prevSlice.length;
        if (recentAvg - prevAvg >= 6) recentTrend = 'improving';
        else if (prevAvg - recentAvg >= 6) recentTrend = 'declining';
      }

      // Homework completion across finished sessions
      let finishedHomeworkSessions = 0;
      for (const mod of homeworkModules) {
        const qIds = getModuleQuizIds(mod);
        const passedAll = qIds.every(qId =>
          sAttempts.some(a => {
            if (a.quizId !== qId) return false;
            const q = quizMap.get(qId);
            return a.passed || (a.percentage || 0) >= (q?.passingScore ?? 70);
          })
        );
        if (passedAll) finishedHomeworkSessions += 1;
      }

      const homeworkCompletionRate = homeworkModules.length > 0
        ? Math.round((finishedHomeworkSessions / homeworkModules.length) * 100)
        : 100;

      // Mistakes & weak topics for this student
      const { wrongAnswers, weakTopics } = extractUserMistakes(sAttempts, quizMap);
      weakTopics.forEach(wt => {
        const existing = classTopicErrorsMap.get(wt.topic) || {
          topic: wt.topic,
          category: wt.category,
          quizId: wt.quizId,
          wrongCount: 0,
          totalAnswered: 0,
          affectedStudents: new Set(),
          sampleMistakes: []
        };
        existing.wrongCount += wt.wrongCount;
        existing.totalAnswered += wt.totalAnswered;
        existing.affectedStudents.add(sId);
        classTopicErrorsMap.set(wt.topic, existing);
      });

      wrongAnswers.slice(0, 4).forEach(wa => {
        const bucket = classTopicErrorsMap.get(wa.quizTitle);
        if (bucket && bucket.sampleMistakes.length < 3) {
          bucket.sampleMistakes.push({
            studentName: u?.name || 'Student',
            question: wa.question,
            userAnswer: wa.userAnswer,
            correctAnswer: wa.correctAnswer
          });
        }
      });

      const lastActiveAt = sAttempts[0]?.completedAt || u?.lastLoginDate || joinedAtMap.get(sId) || clan.createdAt;
      const isInactive = new Date(lastActiveAt).getTime() < weekAgoMs;

      let riskLevel = 'on_track';
      if ((homeworkModules.length > 0 && homeworkCompletionRate < 50) || (attemptsCount > 0 && avgScore < 55) || (attemptsCount === 0 && isInactive)) {
        riskLevel = 'at_risk';
      } else if ((homeworkModules.length > 0 && homeworkCompletionRate < 100) || (attemptsCount > 0 && avgScore < 72) || recentTrend === 'declining') {
        riskLevel = 'needs_attention';
      }

      const recentScores = sAttempts.slice(0, 8).reverse().map(a => ({
        quizId: a.quizId,
        quizTitle: a.quizTitle,
        percentage: Math.round(a.percentage || 0),
        passed: Boolean(a.passed),
        completedAt: a.completedAt
      }));

      return {
        userId: sId,
        name: u?.name || 'Student',
        email: u?.email || '',
        avatar: u?.avatar || null,
        xp: u?.xp || 0,
        level: u?.level || 1,
        streak: u?.streak || 0,
        lastActiveAt,
        attemptsCount,
        avgScore,
        passRate,
        totalTimeSeconds,
        finishedHomeworkSessions,
        totalHomeworkSessions: homeworkModules.length,
        homeworkCompletionRate,
        recentTrend,
        riskLevel,
        weakTopics,
        wrongAnswers: wrongAnswers.slice(0, 8),
        recentScores
      };
    });

    // Session analytics
    const sessionAnalytics = sortedModules.map(mod => {
      const modQuizIds = getModuleQuizIds(mod);
      let completedStudents = 0;
      let scoreSum = 0;
      let scoreCount = 0;
      let sessionAttemptsCount = 0;

      if (modQuizIds.length > 0) {
        studentIds.forEach(sId => {
          const sAtts = (attemptsByStudent.get(sId) || []).filter(a => modQuizIds.includes(a.quizId));
          sessionAttemptsCount += sAtts.length;
          if (sAtts.length > 0) {
            const bestForStudent = Math.max(...sAtts.map(a => a.percentage || 0));
            scoreSum += bestForStudent;
            scoreCount += 1;
          }
          const passedAll = modQuizIds.every(qId =>
            sAtts.some(a => a.quizId === qId && (a.passed || (a.percentage || 0) >= (quizMap.get(qId)?.passingScore ?? 70)))
          );
          if (passedAll) completedStudents += 1;
        });
      }

      return {
        moduleId: mod.moduleId,
        title: mod.title,
        level: mod.level || 0,
        isFinished: finishedSet.has(mod.moduleId),
        quizCount: modQuizIds.length,
        completedStudents,
        pendingStudents: Math.max(0, studentIds.length - completedStudents),
        completionRate: studentIds.length > 0 && modQuizIds.length > 0
          ? Math.round((completedStudents / studentIds.length) * 100)
          : 0,
        attemptsCount: sessionAttemptsCount,
        avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0
      };
    });

    // Aggregated weak topics
    const weakTopics = Array.from(classTopicErrorsMap.values())
      .map(t => ({
        topic: t.topic,
        category: t.category,
        quizId: t.quizId,
        wrongCount: t.wrongCount,
        totalAnswered: t.totalAnswered,
        errorRate: t.totalAnswered > 0 ? Math.round((t.wrongCount / t.totalAnswered) * 100) : 0,
        accuracy: t.totalAnswered > 0 ? Math.round(((t.totalAnswered - t.wrongCount) / t.totalAnswered) * 100) : 0,
        affectedStudentsCount: t.affectedStudents.size,
        sampleMistakes: t.sampleMistakes
      }))
      .sort((a, b) => b.errorRate - a.errorRate || b.wrongCount - a.wrongCount)
      .slice(0, 8);

    // Unified chronological Student Activity & Performance Log
    const activityLogs = [];

    attempts.slice(0, 150).forEach(att => {
      const q = quizMap.get(String(att.quizId));
      const u = userMap.get(att.userId);
      const passThreshold = q?.passingScore ?? 70;
      const isPassed = Boolean(att.passed) || (att.percentage || 0) >= passThreshold;
      activityLogs.push({
        id: `att_${att.attemptId || att._id}`,
        type: 'quiz_attempt',
        studentId: att.userId,
        studentName: u?.name || att.userName || 'Student',
        studentAvatar: u?.avatar || null,
        title: att.quizTitle || q?.title || 'Quiz Attempt',
        quizId: att.quizId,
        score: att.score,
        totalQuestions: att.totalQuestions,
        percentage: Math.round(att.percentage || 0),
        passed: isPassed,
        timeTaken: att.timeTaken || 0,
        integrityScore: att.telemetry?.integrityScore ?? 100,
        tabSwitches: att.telemetry?.tabSwitches ?? 0,
        timestamp: att.completedAt || att.createdAt || new Date()
      });
    });

    (clan.homeworkAlerts || []).forEach(alert => {
      (alert.targetUserIds || []).forEach(targetId => {
        const u = userMap.get(targetId);
        activityLogs.push({
          id: `alert_${alert.alertId}_${targetId}`,
          type: 'homework_alert',
          studentId: targetId,
          studentName: u?.name || 'Student',
          studentAvatar: u?.avatar || null,
          title: `Homework Reminder: ${alert.moduleTitle || 'Session'}`,
          message: alert.message || '',
          timestamp: alert.createdAt || new Date()
        });
      });
    });

    (clan.completedSessions || []).forEach(cs => {
      const mod = sortedModules.find(m => m.moduleId === cs.moduleId);
      activityLogs.push({
        id: `sess_${cs.moduleId}`,
        type: 'session_completed',
        studentId: clan.leaderId,
        studentName: req.user?.name || 'Teacher',
        studentAvatar: null,
        title: `Session Finished: ${mod?.title || cs.moduleId}`,
        message: cs.note || 'Unlocked session & homework for students',
        timestamp: cs.completedAt || new Date()
      });
    });

    studentMembers.forEach(m => {
      const u = userMap.get(m.userId);
      activityLogs.push({
        id: `join_${m.userId}`,
        type: 'member_joined',
        studentId: m.userId,
        studentName: u?.name || 'Student',
        studentAvatar: u?.avatar || null,
        title: 'Joined Class',
        message: `Enrolled in ${clan.name}`,
        timestamp: m.joinedAt || clan.createdAt || new Date()
      });
    });

    activityLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Overview KPIs
    const totalAttemptsCount = attempts.length;
    const classAvgScore = totalAttemptsCount > 0
      ? Math.round(attempts.reduce((s, a) => s + (a.percentage || 0), 0) / totalAttemptsCount)
      : 0;
    const totalPassed = attempts.filter(a => {
      const q = quizMap.get(String(a.quizId));
      return Boolean(a.passed) || (a.percentage || 0) >= (q?.passingScore ?? 70);
    }).length;
    const classPassRate = totalAttemptsCount > 0 ? Math.round((totalPassed / totalAttemptsCount) * 100) : 0;
    const activeStudents7d = studentsAnalytics.filter(s => new Date(s.lastActiveAt).getTime() >= weekAgoMs).length;
    const atRiskCount = studentsAnalytics.filter(s => s.riskLevel === 'at_risk').length;
    const homeworkCompletionRate = studentsAnalytics.length > 0
      ? Math.round(studentsAnalytics.reduce((s, st) => s + st.homeworkCompletionRate, 0) / studentsAnalytics.length)
      : 0;
    const totalTimeMinutes = Math.round(studentsAnalytics.reduce((s, st) => s + st.totalTimeSeconds, 0) / 60);

    res.json({
      overview: {
        totalStudents: studentsAnalytics.length,
        activeStudents7d,
        atRiskCount,
        classAvgScore,
        classPassRate,
        totalQuizAttempts: totalAttemptsCount,
        totalTimeMinutes,
        finishedSessionsCount: sortedModules.filter(m => finishedSet.has(m.moduleId)).length,
        totalSessionsCount: sortedModules.length,
        homeworkCompletionRate
      },
      sessionAnalytics,
      weakTopics,
      students: studentsAnalytics,
      activityLogs: activityLogs.slice(0, 120)
    });
  } catch (error) {
    console.error('❌ [TeacherAnalytics] Error:', error);
    res.status(500).json({ message: 'Error generating class analytics', error: error.message });
  }
};

/**
 * POST /api/clans/:clanId/ai/generate-questions
 * Generates high-craft, Bloom-balanced teacher-quality assessment questions directly from Slides JSON / XML.
 */
export const generateQuestionsFromSlides = async (req, res) => {
  try {
    const { clanId } = req.params;
    const access = await verifyTeacherClassAccess(clanId, req.user);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({ message: access.errorMessage });
    }

    const {
      presentationId = '',
      slidesPayload = null,
      slideText = '',
      count = 6,
      difficulty = 'intermediate',
      questionTypes = ['multiple-choice'],
      focusTopics = '',
      pedagogyMode = 'balanced_bloom',
      language = 'en'
    } = req.body || {};

    let deck = null;
    if (slidesPayload) {
      deck = parsePresentationPayload(slidesPayload, 'Class Slides');
    } else if (presentationId) {
      const existing = await Presentation.findOne({ presentationId }).lean();
      if (!existing) return res.status(404).json({ message: 'Presentation not found' });
      deck = existing;
    }

    const formattedSlides = deck
      ? formatSlidesForTeacherPrompt(deck)
      : String(slideText || '').trim();

    if (!formattedSlides || formattedSlides.length < 20) {
      return res.status(400).json({ message: 'Please provide Slides JSON/XML, choose a saved deck, or paste slide content.' });
    }

    const targetCount = Math.max(3, Math.min(20, Number(count) || 6));
    const allowedTypes = Array.isArray(questionTypes) && questionTypes.length > 0
      ? questionTypes
      : ['multiple-choice'];

    const systemPrompt = `You are a Master Computer Science & Technical Educator and Assessment Architect with 15+ years of classroom teaching experience.
Your job is to craft classroom-ready questions directly from a teacher's slide deck that genuinely test student understanding—not shallow keyword memorization.

PEDAGOGICAL RULES YOU MUST OBEY:
1. SOURCE FIDELITY: Every question MUST be traceable to a specific concept, wireframe/layout, rule, or code snippet in the provided slides (set "sourceSlideTitle"). Never invent unrelated trivia.
2. BLOOM'S TAXONOMY MIX (${pedagogyMode}):
   - ~25% Understand/Concept Why ("Why is <section/pattern> structured this way?")
   - ~35% Apply/Code & Layout Prediction ("Given this HTML/CSS or logic, what happens or what rule produces this 2-column split?")
   - ~25% Debug/Spot the Student Mistake ("A student tried X and got Y wrong—what caused the bug?")
   - ~15% Analyze/Compare Decisions ("Why choose X over Y in this design?")
3. HIGH-CRAFT DISTRACTOR ENGINEERING (FOR MULTIPLE-CHOICE):
   - Exactly 4 plausible options per MCQ.
   - All 4 options MUST match in grammar, tone, and approximate length (do NOT make the right answer noticeably longer or more detailed!).
   - Every wrong option MUST represent a REAL misconception students make in class (e.g., swapping justify-content vs align-items, forgetting flex: 1 / gap, wrong semantic tag, off-by-one indexing).
   - STRICTLY BANNED: "All of the above", "None of the above", "Both A and B", silly joke options, or trivially false filler.
   - Vary "correctAnswer" index fairly across 0, 1, 2, 3 (do NOT cluster answers on index 0!).
4. TEACHER EXPLANATIONS:
   - Write an encouraging, crystal-clear "explanation" showing BOTH why the correct option works AND why the main trap option fails.
5. DIFFICULTY & LANGUAGE:
   - Target Difficulty: ${difficulty}.
   - Allowed Question Types: ${allowedTypes.join(', ')} (Note: debugging/code questions with 4 choices MUST use type "multiple-choice" with a "codeSnippet" field; open short-answer questions use type "text" with "correctAnswer" as expected concise answer string).
   - Language: ${language === 'ar' ? 'Arabic technical questions (keep code/HTML/CSS keywords in English)' : language === 'bilingual' ? 'Clear English stems with brief Arabic hints in brackets where helpful' : 'Clear, natural English'}.`;

    const userPrompt = `GENERATE ${targetCount} TEACHER-GRADE QUIZ QUESTIONS FROM THESE SLIDES.
${focusTopics ? `PRIORITY FOCUS FROM TEACHER: "${String(focusTopics).trim()}"\n` : ''}
SLIDES CONTENT:
"""
${smartTruncate(formattedSlides, 14000)}
"""

RETURN STRICT JSON ONLY matching this exact schema:
{
  "suggestedTitle": "Descriptive Quiz / Homework Title based on slides",
  "suggestedDescription": "1-sentence student-facing overview of what this assessment checks",
  "pedagogicalSummary": "2-sentence summary for the teacher explaining the Bloom coverage and targeted student misconceptions",
  "questions": [
    {
      "id": 1,
      "type": "multiple-choice",
      "question": "Clear, specific question stem referencing real scenario, layout, or code",
      "codeSnippet": "Optional concise HTML/CSS/JS/Python code snippet if relevant, otherwise empty string",
      "options": ["Option 0", "Option 1", "Option 2", "Option 3"],
      "correctAnswer": 2,
      "explanation": "Why Option 2 is right + why the most common trap option is wrong",
      "points": 10,
      "bloomLevel": "Understand | Apply | Debug | Analyze",
      "targetedMisconception": "Brief label of the student misconception tested",
      "sourceSlideTitle": "Exact slide title this question came from"
    }
  ]
}`;

    const aiRes = await callGroqJson(userPrompt, systemPrompt, 0.35);

    if (aiRes?.parsed && Array.isArray(aiRes.parsed.questions) && aiRes.parsed.questions.length > 0) {
      const normalizedQuestions = aiRes.parsed.questions.map((q, idx) => {
        const isTextType = q.type === 'text' && allowedTypes.includes('text');
        const options = !isTextType && Array.isArray(q.options) && q.options.length >= 2
          ? q.options.slice(0, 4).map(o => String(o).trim())
          : (!isTextType ? ['Option A', 'Option B', 'Option C', 'Option D'] : []);
        const correctAnswer = isTextType
          ? String(q.correctAnswer || '').trim()
          : Math.max(0, Math.min(Number(q.correctAnswer) || 0, Math.max(0, options.length - 1)));

        return {
          id: idx + 1,
          type: isTextType ? 'text' : 'multiple-choice',
          question: String(q.question || `Question ${idx + 1}`).trim(),
          ...(q.codeSnippet ? { codeSnippet: String(q.codeSnippet) } : {}),
          options,
          correctAnswer,
          explanation: String(q.explanation || '').trim(),
          points: Number(q.points) > 0 ? Number(q.points) : 10,
          bloomLevel: String(q.bloomLevel || 'Apply'),
          targetedMisconception: String(q.targetedMisconception || '').trim(),
          sourceSlideTitle: String(q.sourceSlideTitle || '').trim()
        };
      });

      return res.json({
        success: true,
        usedAi: true,
        model: aiRes.model,
        suggestedTitle: aiRes.parsed.suggestedTitle || `${deck?.title || 'Session'} — Teacher Checkup Quiz`,
        suggestedDescription: aiRes.parsed.suggestedDescription || 'Slide-grounded assessment with realistic misconception checks.',
        pedagogicalSummary: aiRes.parsed.pedagogicalSummary || '',
        questions: normalizedQuestions
      });
    }

    // Fallback if AI unavailable
    const fallbackQuestions = deck
      ? buildFallbackQuestionsFromSlides(deck, targetCount)
      : [{
          id: 1,
          type: 'multiple-choice',
          question: 'Which principle best summarizes the main focus of this session’s material?',
          options: [
            'Break UI/problems into clear structural sections before styling or coding details',
            'Write all code in one unstyled block first and skip semantic structure',
            'Avoid testing responsiveness until the end of the course',
            'Duplicate identical sections manually without reusable containers'
          ],
          correctAnswer: 0,
          explanation: 'Scanning and structuring sections first prevents layout and maintainability bugs.',
          points: 10,
          bloomLevel: 'Understand',
          sourceSlideTitle: 'Session Overview'
        }];

    res.json({
      success: true,
      usedAi: false,
      suggestedTitle: `${deck?.title || 'Session'} — Practice Quiz`,
      suggestedDescription: 'Generated directly from session slide structure.',
      pedagogicalSummary: 'Deterministic slide fallback used (configure GROQ_API_KEY for full AI distractor engineering).',
      questions: fallbackQuestions
    });
  } catch (error) {
    console.error('❌ [GenerateQuestionsFromSlides] Error:', error);
    res.status(500).json({ message: 'Error generating questions from slides', error: error.message });
  }
};

/**
 * POST /api/clans/:clanId/ai/publish-quiz
 * Saves teacher-reviewed questions as a Quiz document and optionally attaches it to a Class Track session as Homework.
 */
export const publishGeneratedQuizToClass = async (req, res) => {
  try {
    const { clanId } = req.params;
    const access = await verifyTeacherClassAccess(clanId, req.user);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({ message: access.errorMessage });
    }
    const { clan } = access;

    const {
      title,
      description = 'Generated by Teacher AI from class session slides',
      category = 'Class Homework',
      difficulty = 'medium',
      timeLimit = 15,
      passingScore = 70,
      xpReward = 60,
      coinsReward = 15,
      moduleId = '',
      attachAsHomework = true,
      questions = []
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Quiz title is required' });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'At least one question is required to publish a quiz' });
    }

    const slug = String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 36);
    const quizId = `${slug || 'class-quiz'}-${crypto.randomBytes(3).toString('hex')}`;

    const sanitizedQuestions = sanitizeQuestions(questions, quizId);

    const newQuiz = new Quiz({
      id: quizId,
      title: String(title).trim(),
      description: String(description || title).trim(),
      category: String(category || 'Class Homework').trim(),
      difficulty: String(difficulty || 'medium').toLowerCase(),
      timeLimit: Number(timeLimit) >= 0 ? Number(timeLimit) : 15,
      passingScore: Number(passingScore) > 0 ? Number(passingScore) : 70,
      xpReward: Number(xpReward) >= 0 ? Number(xpReward) : 60,
      coinsReward: Number(coinsReward) >= 0 ? Number(coinsReward) : 15,
      icon: '🎓',
      quizType: 'quiz',
      shuffleQuestions: true,
      isVisible: true,
      subjectId: clan.subjectId ? String(clan.subjectId) : undefined,
      linkedTrackId: clan.trackId || undefined,
      linkedModuleId: moduleId || undefined,
      questions: sanitizedQuestions
    });

    await newQuiz.save();

    let attachedToSession = false;
    if (attachAsHomework && clan.trackId && moduleId) {
      const track = await SkillTrack.findOne({ trackId: clan.trackId });
      if (track) {
        const modIndex = (track.modules || []).findIndex(m => m.moduleId === moduleId);
        if (modIndex !== -1) {
          const existingIds = new Set(track.modules[modIndex].quizIds || []);
          existingIds.add(quizId);
          track.modules[modIndex].quizIds = Array.from(existingIds);
          await track.save();
          attachedToSession = true;
        }
      }
    }

    // Notify class students about the new class homework quiz (in-app & email)
    const studentIds = (clan.members || []).map(m => m.userId).filter(id => id && id !== clan.leaderId);
    if (studentIds.length > 0 && attachedToSession) {
      const notifTitle = `📝 New Class Homework: ${newQuiz.title}`;
      const notifMsg = `Your teacher added "${newQuiz.title}" (${sanitizedQuestions.length} questions) to ${clan.name}.`;
      const actionLink = `/quiz/${encodeURIComponent(quizId)}`;

      runInBackground(
        (async () => {
          await Promise.all(studentIds.map(studentId =>
            createAndSendNotification(req.app, {
              recipientId: studentId,
              senderId: req.user.userId,
              senderName: req.user?.name || 'Teacher',
              type: 'new_quiz',
              title: notifTitle,
              message: notifMsg,
              link: actionLink,
              skipEmail: true,
              metadata: { quizId, clanId: clan.clanId, moduleId }
            }).catch(() => {})
          ));

          const recipients = await User.find({ userId: { $in: studentIds } })
            .select('name email')
            .lean();
          await Promise.allSettled(
            recipients
              .filter(u => isDeliverableEmail(u.email))
              .map(u =>
                sendHomeworkAlertEmail({
                  email: u.email,
                  recipientName: u.name || 'Student',
                  teacherName: req.user?.name || 'Teacher',
                  className: clan.name,
                  moduleTitle: newQuiz.title,
                  alertTitle: notifTitle,
                  message: notifMsg,
                  actionPath: actionLink
                })
              )
          );
        })(),
        'publish-generated-quiz-alerts'
      );
    }

    res.status(201).json({
      success: true,
      quiz: newQuiz,
      attachedToSession,
      message: attachedToSession
        ? `Published "${newQuiz.title}" and attached as Session Homework!`
        : `Published quiz "${newQuiz.title}" (${sanitizedQuestions.length} questions)!`
    });
  } catch (error) {
    console.error('❌ [PublishGeneratedQuiz] Error:', error);
    res.status(500).json({ message: 'Error publishing generated quiz', error: error.message });
  }
};

/**
 * POST /api/clans/:clanId/ai/toolkit
 * Teacher AI Copilot supporting:
 * - 'class_coach': Real data-driven re-teach & student intervention advice
 * - 'lesson_plan': Teaching script, live demo steps & timings from slides JSON
 * - 'homework_rubric': Step-by-step student project rubric & checklist from slides JSON
 */
export const generateTeacherAiToolOutput = async (req, res) => {
  try {
    const { clanId } = req.params;
    const access = await verifyTeacherClassAccess(clanId, req.user);
    if (access.errorStatus) {
      return res.status(access.errorStatus).json({ message: access.errorMessage });
    }
    const { clan } = access;

    const {
      mode = 'class_coach',
      presentationId = '',
      slidesPayload = null,
      slideText = '',
      customGoal = '',
      studentSummaries = [],
      weakTopics = []
    } = req.body || {};

    let deck = null;
    if (slidesPayload) {
      deck = parsePresentationPayload(slidesPayload, 'Session Slides');
    } else if (presentationId) {
      deck = await Presentation.findOne({ presentationId }).lean();
    }

    const slideContext = deck ? formatSlidesForTeacherPrompt(deck) : String(slideText || '').trim();

    if (mode === 'class_coach') {
      const systemPrompt = `You are an elite instructional coach advising a classroom teacher on student performance and targeted interventions.
Base EVERY recommendation strictly on the provided student metrics and misconception data. Be practical, concise, and actionable.`;

      const userPrompt = `CLASS: "${clan.name}" (${studentSummaries.length} students summary provided)
${customGoal ? `TEACHER QUESTION/GOAL: "${customGoal}"\n` : ''}
TOP CLASS WEAK TOPICS / MISCONCEPTIONS:
${JSON.stringify(weakTopics.slice(0, 6), null, 2)}

STUDENT PERFORMANCE SNAPSHOT:
${JSON.stringify(studentSummaries.slice(0, 20), null, 2)}

RETURN STRICT JSON ONLY:
{
  "headline": "1-sentence diagnosis of class health right now",
  "reteachTopics": [
    { "topic": "string", "whyStudentsStruggle": "root misconception", "boardDemoIdea": "quick 5-min Teaching Board demo to fix it" }
  ],
  "studentInterventions": [
    { "studentName": "string", "statusSummary": "specific observation", "recommendedAction": "concrete next step", "draftMessage": "friendly personalized reminder or encouragement message" }
  ],
  "nextSessionOpening": "2-sentence warm-up hook for next class"
}`;

      const aiRes = await callGroqJson(userPrompt, systemPrompt, 0.35);
      if (aiRes?.parsed) {
        return res.json({ success: true, usedAi: true, mode, data: aiRes.parsed });
      }

      return res.json({
        success: true,
        usedAi: false,
        mode,
        data: {
          headline: `Class "${clan.name}" has ${studentSummaries.length} tracked students — focus on reinforcing low-scoring homework topics first.`,
          reteachTopics: weakTopics.slice(0, 3).map(wt => ({
            topic: wt.topic,
            whyStudentsStruggle: `${wt.errorRate}% error rate across ${wt.affectedStudentsCount || 1} student(s).`,
            boardDemoIdea: `Walk through the top missed question on the Interactive Teaching Board step-by-step.`
          })),
          studentInterventions: studentSummaries
            .filter(s => s.riskLevel !== 'on_track')
            .slice(0, 5)
            .map(s => ({
              studentName: s.name,
              statusSummary: `Avg ${s.avgScore}% • HW ${s.homeworkCompletionRate}%`,
              recommendedAction: 'Send targeted homework reminder and review weak topics',
              draftMessage: `Hi ${s.name}! Let’s finish your pending session homework and review the tricky spots together before next class.`
            })),
          nextSessionOpening: 'Start with a quick 3-minute live check-up recap on the Teaching Board before introducing new sections.'
        }
      });
    }

    if (mode === 'lesson_plan') {
      if (!slideContext) {
        return res.status(400).json({ message: 'Provide slides JSON/XML or slide notes to generate a teaching plan.' });
      }

      const systemPrompt = `You are a master coding instructor writing a tight, engaging live-teaching script for the Interactive Teaching Board.`;
      const userPrompt = `CREATE A LIVE TEACHING SCRIPT & LESSON PLAN FROM THESE SLIDES:
${customGoal ? `TEACHER NOTES / DURATION GOAL: "${customGoal}"\n` : ''}
SLIDES:
"""
${smartTruncate(slideContext, 12000)}
"""

RETURN STRICT JSON ONLY:
{
  "lessonTitle": "string",
  "estimatedMinutes": 45,
  "warmupHook": "Engaging 2-minute opening question/prompt to ask students",
  "segments": [
    { "phase": "e.g. Live Wireframe Walkthrough", "minutes": 15, "teacherMoves": "What to point out or draw on the board", "checkForUnderstanding": "Quick verbal or checkup poll question" }
  ],
  "commonMistakesToWatch": ["Common beginner trap 1", "Common beginner trap 2"],
  "exitTicketQuestion": "1 final wrap-up question before dismissal"
}`;

      const aiRes = await callGroqJson(userPrompt, systemPrompt, 0.4);
      if (aiRes?.parsed) {
        return res.json({ success: true, usedAi: true, mode, data: aiRes.parsed });
      }

      return res.json({
        success: true,
        usedAi: false,
        mode,
        data: {
          lessonTitle: deck?.title || 'Session Teaching Guide',
          estimatedMinutes: 45,
          warmupHook: 'Show the finished layout first and ask students to identify all major visual containers.',
          segments: (deck?.slides || []).slice(0, 5).map((s, idx) => ({
            phase: `Part ${idx + 1}: ${s.title}`,
            minutes: 8,
            teacherMoves: s.speakerNotes || s.body || (s.bullets || []).join(' • ') || 'Walk through on board with laser pointer',
            checkForUnderstanding: s.checkupQuestion?.question || `Ask a student to summarize the key takeaway of "${s.title}".`
          })),
          commonMistakesToWatch: ['Skipping container structure planning before writing CSS', 'Mixing up parent vs child flex rules'],
          exitTicketQuestion: 'Which CSS property or structural pattern from today will you apply first in your homework?'
        }
      });
    }

    // Default: 'homework_rubric'
    if (!slideContext) {
      return res.status(400).json({ message: 'Provide slides JSON/XML or slide notes to build a homework rubric.' });
    }

    const systemPrompt = `You are a veteran coding teacher turning lecture slides into a clear, motivating Homework Assignment Brief + Grading Rubric + Student Checklist.`;
    const userPrompt = `TURN THESE SLIDES INTO A PRACTICAL STUDENT HOMEWORK BRIEF & RUBRIC:
${customGoal ? `EXTRA ASSIGNMENT REQUIREMENTS: "${customGoal}"\n` : ''}
SLIDES:
"""
${smartTruncate(slideContext, 12000)}
"""

RETURN STRICT JSON ONLY:
{
  "assignmentTitle": "Clear homework title",
  "objective": "What students will build or master",
  "checklist": ["Step-by-step student requirement 1", "Requirement 2", "Requirement 3", "Requirement 4"],
  "rubric": [
    { "criterion": "e.g. Layout Structure & Semantics", "points": 30, "excellent": "Clean semantic tags + balanced columns", "needsWork": "Missing wrapper or overlapping elements" }
  ],
  "starterHints": ["Helpful hint 1 without giving away full solution", "Hint 2"]
}`;

    const aiRes = await callGroqJson(userPrompt, systemPrompt, 0.35);
    if (aiRes?.parsed) {
      return res.json({ success: true, usedAi: true, mode, data: aiRes.parsed });
    }

    return res.json({
      success: true,
      usedAi: false,
      mode,
      data: {
        assignmentTitle: `${deck?.title || 'Session'} — Applied Homework`,
        objective: 'Build and style the target section cleanly using semantic HTML structure and responsive Flexbox/Grid rules.',
        checklist: [
          'Sketch or inspect the page container boundaries before styling',
          'Use semantic HTML tags with clear class names',
          'Verify column spacing, alignment, and responsiveness on desktop & mobile',
          'Complete the linked Session Quiz to lock in concepts'
        ],
        rubric: [
          { criterion: 'Structure & Semantic Markup', points: 40, excellent: 'Clean hierarchy & meaningful tags', needsWork: 'Unstructured nested divs' },
          { criterion: 'Layout & Visual Spacing', points: 40, excellent: 'Balanced columns & clean spacing', needsWork: 'Clipped or misaligned boxes' },
          { criterion: 'Clean Code & Checklist Completion', points: 20, excellent: 'Readable CSS rules & all requirements met', needsWork: 'Incomplete sections' }
        ],
        starterHints: ['Start by sketching outer parent rows/columns before adding icons or colors.']
      }
    });
  } catch (error) {
    console.error('❌ [TeacherAiToolkit] Error:', error);
    res.status(500).json({ message: 'Error running Teacher AI tool', error: error.message });
  }
};
