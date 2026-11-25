import type { AttemptData, ChallengeData, Quiz, SkillTrack, UserData } from '../types';

export type BuddyTone = 'encourage' | 'mock' | 'hype' | 'tip';
export type BuddyMood = 'happy' | 'excited' | 'cool' | 'neutral';

export interface BuddyCta {
    label: string;
    action: 'open_buddy_chat' | 'navigate';
    target?: string;
    prompt?: string;
}

export interface BuddyComment {
    id: string;
    text: string;
    tone: BuddyTone;
    mood: BuddyMood;
    cta?: BuddyCta;
}

export interface BuddyArcadeStats {
    bestScore?: number;
    gamesPlayed?: number;
}

export interface BuddyMatrixInput {
    user: UserData | null;
    attempts: AttemptData[];
    quizzes: Quiz[];
    skillTracks: SkillTrack[];
    challenges: ChallengeData[];
    userWithRank: UserData | null;
    pathname: string;
    idleSeconds: number;
    pokeCount: number;
    language: 'en' | 'ar-EG';
    arcadeStats?: BuddyArcadeStats | null;
}

function getUserRank(userWithRank: UserData | null, user: UserData | null): number | null {
    const rank = userWithRank?.rank ?? user?.rank;
    return typeof rank === 'number' && rank > 0 ? rank : null;
}

function getLevelProgressRatio(xp: number): number {
    const level = Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
    const currentFloorXp = Math.pow(level - 1, 2) * 100;
    const nextFloorXp = Math.pow(level, 2) * 100;
    const span = Math.max(100, nextFloorXp - currentFloorXp);
    return (xp - currentFloorXp) / span;
}

/**
 * Multi-metric commentary engine evaluating 10+ live matrices to produce
 * encouraging or playfully mocking bilingual quips while avoiding recent repeats.
 */
export function generateBuddyComment(
    input: BuddyMatrixInput,
    recentIds: string[] = []
): BuddyComment {
    const {
        user,
        attempts,
        quizzes,
        skillTracks,
        challenges,
        userWithRank,
        pathname,
        idleSeconds,
        pokeCount,
        language,
        arcadeStats,
    } = input;

    const ar = language === 'ar-EG';
    const firstName = (user?.name || (ar ? 'يا بطل' : 'Champ')).split(' ')[0];
    const streak = user?.streak ?? 0;
    const xp = user?.xp ?? 0;
    const level = user?.level ?? (Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
    const coins = user?.coins ?? 0;
    const totalAttempts = user?.totalAttempts ?? attempts.length;
    const rank = getUserRank(userWithRank, user);

    const userAttempts = user?.userId
        ? attempts.filter((a) => a.userId === user.userId)
        : attempts;
    const sortedAttempts = [...userAttempts].sort(
        (a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
    );
    const lastAttempt = sortedAttempts[0];
    const prevAttempt = sortedAttempts[1];

    const candidates: BuddyComment[] = [];

    // 1. Interaction Matrix (Highest immediacy on rapid pokes or idle nap)
    if (pokeCount >= 4) {
        candidates.push({
            id: 'interaction_poke_dizzy',
            tone: 'mock',
            mood: 'cool',
            text: ar
                ? `يا ${firstName} كفاية نقر! أنا بلف حوالين نفسي — ما تروح تنقر في كويز أحسن؟ 😵‍💫`
                : `Easy on the pokes, ${firstName}! You've got faster fingers here than in a timed quiz! 😵‍💫`,
            cta: {
                label: ar ? 'خد كويز سريع' : 'Take a Quiz',
                action: 'navigate',
                target: '/quizzes',
            },
        });
    }

    if (idleSeconds >= 45) {
        candidates.push({
            id: 'interaction_idle_zzz',
            tone: 'mock',
            mood: 'neutral',
            text: ar
                ? `Zzz... ${firstName} نمت على الكيبورد ولا إيه؟ خلّصنا كويز واحد قبل ما أشخّر! 😴`
                : `Zzz... Did you fall asleep on the keyboard, ${firstName}? One quick quiz wakes us both up! 😴`,
            cta: {
                label: ar ? 'اسألني خطة' : 'Ask Buddy',
                action: 'open_buddy_chat',
                prompt: ar ? 'اديني تحدي مذاكرة سريع في 5 دقايق' : 'Give me a 5-minute quick study sprint!',
            },
        });
    }

    // 2. Streak Matrix
    if (streak === 0) {
        candidates.push({
            id: 'streak_zero_roast',
            tone: 'mock',
            mood: 'cool',
            text: ar
                ? `ستريك 0 أيام؟ حتى السمكة الذهبية بتفتكر أكتر من كده يا ${firstName} — كويز واحد يولّع النار! 🔥`
                : `Streak: 0. Even a goldfish remembers better than that, ${firstName}—one quick quiz fixes it! 🔥`,
            cta: {
                label: ar ? 'ولّع الستريك' : 'Fix Streak',
                action: 'navigate',
                target: '/quizzes',
            },
        });
    } else if (streak >= 7) {
        candidates.push({
            id: 'streak_fire_hype',
            tone: 'hype',
            mood: 'excited',
            text: ar
                ? `${streak} أيام ستريك متواصلة يا ${firstName}! أنت حرفياً ماكينة مذاكرة ما بتهداش! 🚀`
                : `${streak}-day streak, ${firstName}?! You are an unstoppable study machine right now! 🚀`,
        });
    } else if (streak >= 3) {
        candidates.push({
            id: 'streak_building_encourage',
            tone: 'encourage',
            mood: 'happy',
            text: ar
                ? `ستريك ${streak} أيام شغال زي الفل يا ${firstName} — كمّل عشان نوصل للأسبوع الذهبي!`
                : `Solid ${streak}-day streak, ${firstName}! Keep the momentum rolling today!`,
        });
    }

    // 3. Recent Accuracy & Score Matrix
    if (lastAttempt) {
        const pct = Math.round(lastAttempt.percentage ?? 0);
        if (pct === 100) {
            candidates.push({
                id: 'score_perfect_hype',
                tone: 'hype',
                mood: 'excited',
                text: ar
                    ? `100% في "${lastAttempt.quizTitle}"?! تاج الملوك على راسك يا ${firstName}! 👑`
                    : `100% on "${lastAttempt.quizTitle}"?! Bow down to the royalty, ${firstName}! 👑`,
            });
        } else if (pct < 50) {
            candidates.push({
                id: 'score_low_roast',
                tone: 'mock',
                mood: 'cool',
                text: ar
                    ? `${pct}% في "${lastAttempt.quizTitle}"؟ الكويز ضربنا جامد... يلا نراجع غلطاتك ونردها له! 🛠️`
                    : `${pct}% on "${lastAttempt.quizTitle}"? Ouch—that quiz swung back! Let's fix those weak spots together.`,
                cta: {
                    label: ar ? 'خطط المراجعة' : 'Fix Weak Spots',
                    action: 'open_buddy_chat',
                    prompt: ar
                        ? `جبت ${pct}% في ${lastAttempt.quizTitle}، أراجع إيه عشان أتحسن؟`
                        : `I scored ${pct}% on "${lastAttempt.quizTitle}". Build me a fast recovery plan!`,
                },
            });
        } else if (prevAttempt && pct + 10 < Math.round(prevAttempt.percentage ?? 0)) {
            candidates.push({
                id: 'score_declining_tip',
                tone: 'tip',
                mood: 'neutral',
                text: ar
                    ? `تركيزك نزل شوية عن الكويز اللي فات (${pct}%). شوف التحليلات عشان نلقط النقطة اللي وقعت.`
                    : `Accuracy dipped to ${pct}% from your previous run. Peek at Analytics so we patch that leak early!`,
                cta: {
                    label: ar ? 'افتح التحليلات' : 'Open Analytics',
                    action: 'navigate',
                    target: '/analytics',
                },
            });
        }
    }

    // 4. Level & XP Momentum Matrix
    const lvlRatio = getLevelProgressRatio(xp);
    if (totalAttempts === 0) {
        candidates.push({
            id: 'xp_rookie_nudge',
            tone: 'encourage',
            mood: 'happy',
            text: ar
                ? `لسه مفيش محاولات كويز يا ${firstName}؟ اختار أول كويز وخلّينا نجيب أول XP سوا! ⚡`
                : `Zero quiz attempts so far, ${firstName}? Pick your first quiz and let's farm that opening XP! ⚡`,
            cta: {
                label: ar ? 'ابدأ أول كويز' : 'Start First Quiz',
                action: 'navigate',
                target: '/quizzes',
            },
        });
    } else if (lvlRatio >= 0.8) {
        candidates.push({
            id: 'xp_almost_levelup',
            tone: 'hype',
            mood: 'excited',
            text: ar
                ? `فاضلك تكّة صغيرة وتطلع Level ${level + 1} يا ${firstName}! كويز واحد وتفرقع! 💥`
                : `You're ${Math.round(lvlRatio * 100)}% to Level ${level + 1}, ${firstName}! One more quiz and you level up! 💥`,
        });
    } else if (level >= 10) {
        candidates.push({
            id: 'xp_high_level_flex',
            tone: 'hype',
            mood: 'cool',
            text: ar
                ? `Level ${level} يا ${firstName}؟ هيبة! بس التحدي الحقيقي لسه في المسارات المتقدمة. 😎`
                : `Level ${level} flex, ${firstName}! Ready to test that brainpower on a Skill Track? 😎`,
        });
    }

    // 5. Coins & Shop Matrix
    if (coins === 0) {
        candidates.push({
            id: 'coins_broke_mock',
            tone: 'mock',
            mood: 'cool',
            text: ar
                ? `رصيدك 0 كوينز يا ${firstName}... المحفظة بتصفر! يلا نحل كويز ونكسب دهب! 🪙`
                : `0 coins in the vault, ${firstName}—my pockets are echoing! Let's go earn some gold! 🪙`,
            cta: {
                label: ar ? 'كسب كوينز' : 'Earn Coins',
                action: 'navigate',
                target: '/daily',
            },
        });
    } else if (coins >= 400) {
        candidates.push({
            id: 'coins_hoarder_mock',
            tone: 'mock',
            mood: 'excited',
            text: ar
                ? `قاعد على ${coins} كوينز زي التنين يا ${firstName}؟ روح المتجر وهاتلي إكسسوار جامد! 👑`
                : `Sitting on ${coins} coins like a dragon, ${firstName}—visit the Shop and buy your buddy a crown! 👑`,
            cta: {
                label: ar ? 'افتح المتجر' : 'Visit Shop',
                action: 'navigate',
                target: '/shop',
            },
        });
    }

    // 6. Rank Matrix
    if (rank === 1) {
        candidates.push({
            id: 'rank_first_hype',
            tone: 'hype',
            mood: 'excited',
            text: ar
                ? `المركز #1 على المنصة يا ${firstName}! اوعى تنام عشان اللي وراك بيطاردوك! 🏆`
                : `#1 on the leaderboard, ${firstName}! Stay sharp—everyone below is chasing your crown! 🏆`,
        });
    } else if (rank && rank <= 5) {
        candidates.push({
            id: 'rank_top5_encourage',
            tone: 'encourage',
            mood: 'excited',
            text: ar
                ? `أنت في التوب 5 (المركز #${rank})! فاضل خطوة على الصدارة يا وحش!`
                : `Top 5 status (Rank #${rank})! Keep grinding and #1 is right in reach!`,
        });
    } else if (rank && rank > 10) {
        candidates.push({
            id: 'rank_outside_top10_mock',
            tone: 'mock',
            mood: 'cool',
            text: ar
                ? `المركز #${rank}؟ ليه سايب التوب 10 فاضي كده؟ تعال نعمل خطة نطير بيها لفوق! 📈`
                : `Rank #${rank}? Why are we letting the Top 10 chill without us? Let's plan a climb! 📈`,
            cta: {
                label: ar ? 'اعمل خطة صعود' : 'Plan My Climb',
                action: 'open_buddy_chat',
                prompt: ar
                    ? 'عايز خطة أرفع بيها ترتيبي وأدخل التوب 10'
                    : 'Make me a study plan to climb into the Top 10 leaderboard!',
            },
        });
    }

    // 7. Daily Challenge Matrix
    if (user?.dailyChallengeCompleted) {
        candidates.push({
            id: 'daily_done_hype',
            tone: 'hype',
            mood: 'happy',
            text: ar
                ? `تحدي اليوم خلص بنجاح! كده يومك الدراسي متأمن 100%. ✅`
                : `Daily Challenge cleared! Today's study streak is officially locked in. ✅`,
        });
    } else if (challenges.length > 0 || user) {
        candidates.push({
            id: 'daily_pending_tip',
            tone: 'tip',
            mood: 'happy',
            text: ar
                ? `تحدي النهاردة لسه مستنيك يا ${firstName} — بيدي XP وكوينز ببلاش تقريباً! ⚡`
                : `Today's Daily Challenge is still waiting, ${firstName}—easy XP and coins on the table! ⚡`,
            cta: {
                label: ar ? 'تحدي اليوم' : 'Daily Challenge',
                action: 'navigate',
                target: '/daily',
            },
        });
    }

    // 8. Time-of-Day Matrix
    const hour = new Date().getHours();
    if (hour >= 1 && hour < 5) {
        candidates.push({
            id: 'time_night_owl_mock',
            tone: 'mock',
            mood: 'cool',
            text: ar
                ? `الساعة ${hour} الفجر ولسه بتذاكر يا ${firstName}؟ يا عيني ع الدحيح! بس نام شوية عشان مخك يحفظ! 🦉`
                : `Studying at ${hour} AM, ${firstName}?! Respect the night-owl grind—just don't forget sleep locks in memory! 🦉`,
        });
    } else if (hour >= 6 && hour < 11) {
        candidates.push({
            id: 'time_morning_encourage',
            tone: 'encourage',
            mood: 'excited',
            text: ar
                ? `صباح الفل والتركيز العالي يا ${firstName}! مذاكرة الصبح بتثبت ضعف المعلومات. ☀️`
                : `Morning grind unlocked, ${firstName}! Early sessions lock in concepts twice as fast. ☀️`,
        });
    }

    // 9. Arcade Distraction Matrix
    const gamesPlayed = arcadeStats?.gamesPlayed ?? 0;
    const bestArcade = arcadeStats?.bestScore ?? 0;
    if ((gamesPlayed >= 3 || bestArcade >= 100) && totalAttempts < 3) {
        candidates.push({
            id: 'arcade_distraction_mock',
            tone: 'mock',
            mood: 'cool',
            text: ar
                ? `سكور ${bestArcade} في الأركيد بس لسه ${totalAttempts} كويزات؟ أنا شايفك بتلعب من ورايا! 🎮😂`
                : `Arcade high score of ${bestArcade} while quizzes sit at ${totalAttempts}? I saw you sneaking into the arcade! 🎮😂`,
            cta: {
                label: ar ? 'رجوع للكويزات' : 'Back to Quizzes',
                action: 'navigate',
                target: '/quizzes',
            },
        });
    }

    // 10. Route Context Matrix
    if (pathname.startsWith('/analytics')) {
        candidates.push({
            id: 'route_analytics_tip',
            tone: 'tip',
            mood: 'cool',
            text: ar
                ? `بنفتش في الأرقام! لو عايز نحول أضعف نقطة عندك لجدول مذاكرة، كلمني في الشات.`
                : `Inspecting the stats! Want me to turn your weakest topic into a step-by-step study plan?`,
            cta: {
                label: ar ? 'خطط معايا' : 'Plan With Me',
                action: 'open_buddy_chat',
                prompt: ar
                    ? 'راجع تحليلاتي واعملي خطة مذاكرة لأضعف مواضيعي'
                    : 'Review my analytics and build a study plan for my weakest topics.',
            },
        });
    } else if (pathname.startsWith('/tracks')) {
        candidates.push({
            id: 'route_tracks_encourage',
            tone: 'encourage',
            mood: 'happy',
            text: ar
                ? `عندنا ${skillTracks.length || 'عدة'} مسارات مهارات! ركّز على مسار واحد تخلصه للأخر بدل ما تتشتت.`
                : `${skillTracks.length || 'Awesome'} Skill Tracks ready! Mastering one track end-to-end beats jumping around.`,
        });
    } else if (pathname.startsWith('/shop')) {
        candidates.push({
            id: 'route_shop_tip',
            tone: 'tip',
            mood: 'excited',
            text: ar
                ? `تلميح: الإطارات والإكسسوارات اللي بتشتريها بتظهر عليا هنا طول الوقت! دلّعني! ✨`
                : `Pro tip: frames and gear you unlock here show up right on me across the whole site! ✨`,
        });
    } else if (pathname.startsWith('/leaderboard')) {
        candidates.push({
            id: 'route_leaderboard_hype',
            tone: 'hype',
            mood: 'excited',
            text: ar
                ? `بص على اللي فوقينا... كويزين بالتركيز ده وهنعديهم! 👀`
                : `Checking out the competition? Two focused quizzes and we're climbing past them! 👀`,
        });
    } else if (pathname.startsWith('/daily')) {
        candidates.push({
            id: 'route_daily_encourage',
            tone: 'encourage',
            mood: 'happy',
            text: ar
                ? `تحدي اليوم هو أسرع طريق للـ XP والستريك — خد نفس وركّز في كل سطر!`
                : `Daily Challenge is the fastest XP boost around—read carefully and nail it!`,
        });
    } else if (quizzes.length > 0) {
        candidates.push({
            id: 'route_general_chat',
            tone: 'tip',
            mood: 'happy',
            text: ar
                ? `محتاج خطة مذاكرة أو ترشيح كويز من ${quizzes.length} كويز متاحين؟ دوس عليا وندردش! 💬`
                : `Need a study plan or quiz pick from ${quizzes.length} live quizzes? Tap me to chat! 💬`,
            cta: {
                label: ar ? 'دردش مع رفيقك' : 'Chat with Buddy',
                action: 'open_buddy_chat',
            },
        });
    }

    // Fallback safety line
    if (candidates.length === 0) {
        candidates.push({
            id: 'fallback_buddy_ready',
            tone: 'encourage',
            mood: 'happy',
            text: ar
                ? `أهلاً يا ${firstName}! جاهز أساعدك تخطط مذاكرتك أو أشجعك في الكويز الجاي! ⚡`
                : `Hey ${firstName}! Ready to plan your study session or cheer on your next quiz! ⚡`,
            cta: {
                label: ar ? 'دردش معايا' : 'Chat with Me',
                action: 'open_buddy_chat',
            },
        });
    }

    // Filter out recently spoken lines first, keeping highest priority interaction lines intact if critical
    const fresh = candidates.filter((c) => !recentIds.includes(c.id));
    const pool = fresh.length > 0 ? fresh : candidates;

    // Immediate interaction lines win when triggered
    const immediate = pool.find((c) => c.id.startsWith('interaction_'));
    if (immediate) return immediate;

    // Otherwise pick semi-randomly from top pool for lively variety
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
}
