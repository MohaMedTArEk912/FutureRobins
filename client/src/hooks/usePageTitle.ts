import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getPublicPath, PUBLIC_PAGES } from '../seo';

interface RouteMetadata {
    title: string;
    description: string;
}

const ROUTE_METADATA: Record<string, RouteMetadata> = {
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
    '/admin/json-studio': {
        title: 'AI JSON Refiner Studio | Quiz Platform',
        description: 'Audit, repair, and upgrade platform JSON files with split-screen Old vs. New comparison.'
    },
    '/json-studio': {
        title: 'AI JSON Refiner Studio | Quiz Platform',
        description: 'Audit, repair, and upgrade platform JSON files with split-screen Old vs. New comparison.'
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
    '/admin/json-studio': {
        title: 'استوديو تحسين JSON بالذكاء الاصطناعي | منصة الكويزات',
        description: 'مراجعة وتصليح وتطوير ملفات JSON بمقارنة مباشرة بين القديم والجديد.'
    },
    '/json-studio': {
        title: 'استوديو تحسين JSON بالذكاء الاصطناعي | منصة الكويزات',
        description: 'مراجعة وتصليح وتطوير ملفات JSON بمقارنة مباشرة بين القديم والجديد.'
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
        const pathname = location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
        const publicPath = getPublicPath(pathname);

        const englishMetadata = publicPath ? PUBLIC_PAGES[publicPath] : ROUTE_METADATA[pathname];
        let meta = isArabic ? (ROUTE_METADATA_AR[publicPath ?? pathname] ?? englishMetadata) : englishMetadata;

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

        document.title = finalTitle;
        for (const [selector, content] of [
            ['meta[name="description"]', meta.description],
            ['meta[property="og:title"]', finalTitle],
            ['meta[property="og:description"]', meta.description],
            ['meta[property="og:locale"]', isArabic ? 'ar_EG' : 'en_US'],
            ['meta[name="twitter:title"]', finalTitle],
            ['meta[name="twitter:description"]', meta.description]
        ]) {
            document.querySelector(selector)?.setAttribute('content', content);
        }

        let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
        const socialImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
        if (publicPath && socialImage) {
            const url = new URL(publicPath, socialImage).href;
            if (!canonical) {
                canonical = document.createElement('link');
                canonical.rel = 'canonical';
                document.head.append(canonical);
            }
            if (!ogUrl) {
                ogUrl = document.createElement('meta');
                ogUrl.setAttribute('property', 'og:url');
                document.head.append(ogUrl);
            }
            canonical.href = url;
            ogUrl.content = url;
        } else {
            canonical?.remove();
            ogUrl?.remove();
        }
    }, [location.pathname, currentUser, isArabic]);
};

export default usePageTitle;
