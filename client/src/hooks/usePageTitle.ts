import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteMetadata {
    title: string;
    description: string;
}

const ROUTE_METADATA: Record<string, RouteMetadata> = {
    '/': {
        title: 'Quiz Platform | Computer Science Quizzes & Learning Roads',
        description: 'Master Computer Science concepts through interactive quizzes, progression roads, and daily challenges.'
    },
    '/leaderboard': {
        title: 'Global Leaderboard | Quiz Platform',
        description: 'Check global player rankings, high scores, streaks, and top scholars across all computer science subjects.'
    },
    '/tracks': {
        title: 'Skill Tracks & Tech Trees | Quiz Platform',
        description: 'Explore comprehensive computer science learning paths from Python basics to advanced system architecture.'
    },
    '/study': {
        title: 'Study Flashcards | Quiz Platform',
        description: 'Review bite-sized concepts, syntax cheatsheets, and flashcards to supercharge your memory retention.'
    },
    '/tournaments': {
        title: 'Live Tournaments & Arenas | Quiz Platform',
        description: 'Compete in scheduled and live multiplayer quiz tournaments to earn prestigious badges and rewards.'
    },
    '/live-arena': {
        title: 'Live Arena | Quiz Platform',
        description: 'Host or join real-time Turn-Based Duels and Everyone Answers live quiz battles.'
    },
    '/classroom': {
        title: 'Live Arena | Quiz Platform',
        description: 'Host or join real-time Turn-Based Duels and Everyone Answers live quiz battles.'
    },
    '/daily': {
        title: 'Daily Code Challenge | Quiz Platform',
        description: 'Solve the daily programming puzzle, maintain your streak, and earn bonus XP.'
    },
    '/shop': {
        title: 'Power-Up & Reward Shop | Quiz Platform',
        description: 'Redeem your earned coins for avatar items, streak freezes, double XP boosters, and profile frames.'
    },
    '/clans': {
        title: 'My Class & Classroom Hub | Quiz Platform',
        description: 'Open your class, join live interactive boards, review motion slides, and complete session homework.'
    },
    '/classes': {
        title: 'My Class & Classroom Hub | Quiz Platform',
        description: 'Open your class, join live interactive boards, review motion slides, and complete session homework.'
    },
    '/social': {
        title: 'Social Hub & 1v1 Duels | Quiz Platform',
        description: 'Connect with friends, challenge opponents to live 1v1 quiz battles, and track your rivalries.'
    },
    '/profile': {
        title: 'My Profile & Achievements | Quiz Platform',
        description: 'View your quiz statistics, verified certificates, earned badges, and custom avatar.'
    },
    '/login': {
        title: 'Sign In | Quiz Platform',
        description: 'Sign in to Quiz Platform to save your progress, earn XP, and compete on the global leaderboard.'
    },
    '/register': {
        title: 'Create Account | Quiz Platform',
        description: 'Join Quiz Platform for free and start your computer science learning journey today.'
    },
    '/forgot-password': {
        title: 'Reset Password | Quiz Platform',
        description: 'Reset your Quiz Platform account password securely.'
    },
    '/admin': {
        title: 'Admin Management Console | Quiz Platform',
        description: 'Admin dashboard to manage quizzes, questions, users, tournaments, and analytics.'
    },
    '/game/vs': {
        title: 'Live 1v1 Quiz Duel | Quiz Platform',
        description: 'Real-time head-to-head multiplayer quiz match.'
    },
    '/results': {
        title: 'Quiz Performance & Results | Quiz Platform',
        description: 'Detailed analysis of your quiz attempt, score, accuracy, and earned XP.'
    }
};

import { useOptionalAuth } from '../context/AuthContext';
import { useOptionalLanguage } from '../context/LanguageContext';

const ROUTE_METADATA_AR: Record<string, RouteMetadata> = {
    '/': {
        title: 'منصة الكويزات | اختبر نفسك وتعلم برمجة بطريقة ممتعة',
        description: 'طور مستواك في البرمجة وعلوم الحاسب من خلال كويزات تفاعلية ومسارات تعلم وتحديات يومية.'
    },
    '/leaderboard': {
        title: 'لوحة المتصدرين | منصة الكويزات',
        description: 'شوف ترتيبك بين كل الطلاب والسكور وسلسلة الانتصارات.'
    },
    '/tracks': {
        title: 'مسارات التعلم والمهارات | منصة الكويزات',
        description: 'استكشف مسارات البرمجة خطوة بخطوة من الأساسيات لحد الاحتراف.'
    },
    '/study': {
        title: 'كروت المذاكرة | منصة الكويزات',
        description: 'راجع المفاهيم السريعة والملخصات عشان تثبت المعلومة في دماغك.'
    },
    '/tournaments': {
        title: 'البطولات والتحديات المباشرة | منصة الكويزات',
        description: 'نافس زمايلك في بطولات كويزات مباشرة واكسب شارات وجوائز.'
    },
    '/live-arena': {
        title: 'الساحة المباشرة | منصة الكويزات',
        description: 'اعمل غرفة مباشرة أو ادخل بـ PIN ونافس في تحدي الأدوار أو الكل يجاوب.'
    },
    '/classroom': {
        title: 'الساحة المباشرة | منصة الكويزات',
        description: 'اعمل غرفة مباشرة أو ادخل بـ PIN ونافس في تحدي الأدوار أو الكل يجاوب.'
    },
    '/daily': {
        title: 'تحدي النهارده | منصة الكويزات',
        description: 'حل تحدي النهارده وحافظ على الستريك بتاعك واكسب XP إضافي.'
    },
    '/shop': {
        title: 'متجر الجوائز والقدرات | منصة الكويزات',
        description: 'اصرف عملاتك في أشكال أفاتار جديدة وشارات ومساعدات.'
    },
    '/clans': {
        title: 'كلاسي واستوديو الحصة | منصة الكويزات',
        description: 'افتح الكلاس بتاعك وتابع السيشنات والواجبات والشات المباشر.'
    },
    '/classes': {
        title: 'كلاسي واستوديو الحصة | منصة الكويزات',
        description: 'افتح الكلاس بتاعك وتابع السيشنات والواجبات والشات المباشر.'
    },
    '/social': {
        title: 'الأصدقاء والمواجهات 1v1 | منصة الكويزات',
        description: 'ضيف أصحابك وتحداهم في ماتشات مباشرة 1 ضد 1.'
    },
    '/profile': {
        title: 'ملفي الشخصي وإنجازاتي | منصة الكويزات',
        description: 'شوف إحصائياتك وشهاداتك وشاراتك وإعدادات حسابك.'
    },
    '/login': {
        title: 'تسجيل الدخول | منصة الكويزات',
        description: 'سجل دخول عشان تحفظ تقدمك وتنافس مع زمايلك.'
    },
    '/register': {
        title: 'إنشاء حساب جديد | منصة الكويزات',
        description: 'اعمل حساب مجاني وابدأ رحلتك في تعلم البرمجة دلوقتي.'
    },
    '/forgot-password': {
        title: 'استعادة كلمة السر | منصة الكويزات',
        description: 'رجع كلمة السر لحسابك بأمان.'
    },
    '/admin': {
        title: 'لوحة تحكم الإدارة | منصة الكويزات',
        description: 'إدارة الكويزات والأسئلة والمستخدمين والكلاسات.'
    },
    '/game/vs': {
        title: 'مواجهة مباشرة 1 ضد 1 | منصة الكويزات',
        description: 'مباراة كويز مباشرة بينك وبين منافسك.'
    },
    '/results': {
        title: 'نتيجة الكويز والتحليل | منصة الكويزات',
        description: 'راجع إجاباتك ودرجتك والـ XP اللي كسبته بالتفصيل.'
    }
};

export const usePageTitle = () => {
    const location = useLocation();
    const auth = useOptionalAuth();
    const langCtx = useOptionalLanguage();
    const isArabic = langCtx?.isArabic ?? false;
    const currentUser = auth?.currentUser;

    useEffect(() => {
        const pathname = location.pathname;

        const baseMeta = isArabic ? (ROUTE_METADATA_AR[pathname] || ROUTE_METADATA[pathname]) : ROUTE_METADATA[pathname];
        let meta = baseMeta;

        // Match dynamic routes
        if (!meta) {
            if (pathname.startsWith('/quiz/')) {
                meta = isArabic
                    ? {
                        title: 'جلسة الكويز | منصة الكويزات',
                        description: 'كويز برمجة تفاعلي — اختبر سرعتك ودقتك.'
                    }
                    : {
                        title: 'Quiz Session | Quiz Platform',
                        description: 'Interactive computer science quiz session. Test your speed and accuracy.'
                    };
            } else if (pathname.startsWith('/challenge/')) {
                meta = isArabic
                    ? {
                        title: 'تحدي كويز خاص | منصة الكويزات',
                        description: 'اقبل التحدي وحل الكويز بأعلى سكور.'
                    }
                    : {
                        title: 'Quiz Challenge Duel | Quiz Platform',
                        description: 'Take on a custom quiz challenge invited by a fellow programmer.'
                    };
            } else if (pathname.startsWith('/badge-tree/')) {
                meta = isArabic
                    ? {
                        title: 'شجرة المهارات والشارات | منصة الكويزات',
                        description: 'خريطة تفاعلية للشارات ومهارات التعلم.'
                    }
                    : {
                        title: 'Skill Tree Progression | Quiz Platform',
                        description: 'Interactive visual tech tree and skill mastery road.'
                    };
            } else if (pathname.startsWith('/profile/')) {
                meta = isArabic
                    ? {
                        title: 'الملف الشخصي للاعب | منصة الكويزات',
                        description: 'شوف ملف اللاعب وإنجازاته ونشاطه.'
                    }
                    : {
                        title: 'User Profile | Quiz Platform',
                        description: 'View public dossier, achievements, study activity, and challenges.'
                    };
            } else {
                meta = isArabic
                    ? {
                        title: 'منصة الكويزات - اختبر معلوماتك',
                        description: 'منصة تعليمية تفاعلية لتعلم البرمجة والكويزات.'
                    }
                    : {
                        title: 'Quiz Platform - Test Your Knowledge',
                        description: 'Interactive computer science quiz platform with gamified learning tracks and 1v1 duels.'
                    };
            }
        }

        // Apply dynamic user context
        let finalTitle = meta.title;
        if (currentUser && currentUser.userId !== 'guest' && currentUser.name) {
            if (pathname === '/profile') {
                finalTitle = isArabic
                    ? `ملف ${currentUser.name} | منصة الكويزات`
                    : `${currentUser.name}'s Profile | Quiz Platform`;
            } else if (pathname === '/admin' && currentUser.role === 'admin') {
                finalTitle = isArabic
                    ? `لوحة الإدارة (${currentUser.name}) | منصة الكويزات`
                    : `Admin Console (${currentUser.name}) | Quiz Platform`;
            }
        }

        // Update document title
        document.title = finalTitle;

        // Update meta description
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.setAttribute('content', meta.description);
        }

        // Update Open Graph tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            ogTitle.setAttribute('content', finalTitle);
        }

        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription) {
            ogDescription.setAttribute('content', meta.description);
        }

        // Update Twitter Card tags
        const twitterTitle = document.querySelector('meta[property="twitter:title"]') || document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) {
            twitterTitle.setAttribute('content', finalTitle);
        }

        const twitterDescription = document.querySelector('meta[property="twitter:description"]') || document.querySelector('meta[name="twitter:description"]');
        if (twitterDescription) {
            twitterDescription.setAttribute('content', meta.description);
        }
    }, [location.pathname, currentUser, isArabic]);
};

export default usePageTitle;
