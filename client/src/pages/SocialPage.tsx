import React from 'react';
import FriendList from '../components/social/FriendList';
import QuizSelectionModal from '../components/social/QuizSelectionModal';
import PageLayout from '../layouts/PageLayout';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import { api } from '../lib/api';
import type { ChallengeData } from '../types';
import { useLanguage } from '../context/LanguageContext';

const SocialPage: React.FC = () => {
    const { tx } = useLanguage();
    const { currentUser } = useAuth();
    const { allUsers, refreshData, challenges, availableQuizzes } = useData();
    const navigate = useNavigate();
    const { socket, connected } = useSocket();
    const { showNotification } = useNotification();

    const [showQuizModal, setShowQuizModal] = React.useState(false);
    const [selectedFriendId, setSelectedFriendId] = React.useState<string | null>(null);
    const [challengeType, setChallengeType] = React.useState<'live' | 'async' | null>(null);
    const [liveChallenges, setLiveChallenges] = React.useState<ChallengeData[]>([]);
    const userId = currentUser?.userId;

    const isLiveChallenge = (challenge: ChallengeData): challenge is ChallengeData & { type: 'live'; roomId: string } =>
        challenge.type === 'live' && Boolean(challenge.roomId);

    const initiateChallenge = (friendId: string, type: 'live' | 'async') => {
        setSelectedFriendId(friendId);
        setChallengeType(type);
        setShowQuizModal(true);
    };

    const handleQuizSelected = async (quizId: string) => {
        setShowQuizModal(false);
        if (!selectedFriendId || !currentUser) return;

        if (challengeType === 'live') {
            if (socket && connected) {
                // Listen for the room creation confirmation to join immediately (optional, or just navigate)
                // Actually, the server now emits 'challenge_created' to sender. 
                // We should assume we go to the game page in "waiting" mode.

                const handleChallengeCreated = ({ roomId }: { roomId: string }) => {
                    socket.off('challenge_created', handleChallengeCreated);
                    // Navigate to VS Page in waiting mode
                    // We need to resolve opponent name/data for the VS page
                    const opponent = allUsers.find(u => u.userId === selectedFriendId);

                    navigate('/game/vs', {
                        state: {
                            quizId,
                            opponent: {
                                id: selectedFriendId,
                                name: opponent?.name || tx('Opponent', 'المنافس'),
                                avatar: opponent?.avatar
                            },
                            roomId
                        }
                    });
                };

                socket.on('challenge_created', handleChallengeCreated);

                socket.emit('invite_friend', {
                    fromId: currentUser.userId,
                    toId: selectedFriendId,
                    fromName: currentUser.name,
                    quizId
                });

                // Also send a direct message so it appears in chat
                socket.emit('send_direct_message', {
                    id: crypto.randomUUID(),
                    senderId: currentUser.userId,
                    senderName: currentUser.name,
                    receiverId: selectedFriendId,
                    content: tx('I challenged you to a duel!', 'بتحداك في جولة لايف!'),
                    type: 'challenge',
                    challengeData: {
                        quizId,
                        quizTitle: availableQuizzes.find(q => q.id === quizId)?.title || tx('Quiz Challenge', 'تحدي كويز'),
                        roomId: 'pending_room_id'
                    },
                    createdAt: new Date().toISOString(),
                    isRead: false
                });

                // Trigger DirectChat callback to add message locally
                const quizTitle = availableQuizzes.find(q => q.id === quizId)?.title || tx('Quiz Challenge', 'تحدي كويز');
                if (window.__pendingChallengeCallback) {
                    window.__pendingChallengeCallback(quizId, quizTitle);
                    delete window.__pendingChallengeCallback;
                }

                showNotification('success', tx('Challenge sent! Waiting for opponent...', 'التحدي اتبعت! مستنيين المنافس...'));
            } else {
                showNotification('error', tx('Socket not connected. Cannot send challenge.', 'السيرفر مش متصل دلوقتي. مش قادرين نبعت التحدي.'));
            }
        } else if (challengeType === 'async') {
            try {
                const challenge = await api.createChallenge(selectedFriendId, quizId, currentUser.userId);
                refreshData();
                const link = `${window.location.origin}/challenge/${challenge.token}`;

                // Trigger DirectChat callback for async challenge
                const quizTitle = availableQuizzes.find(q => q.id === quizId)?.title || tx('Quiz Challenge', 'تحدي كويز');
                if (window.__pendingAsyncChallengeCallback) {
                    window.__pendingAsyncChallengeCallback(quizId, quizTitle);
                    delete window.__pendingAsyncChallengeCallback;
                }

                showNotification('success', tx('Link generated! Copy sent to clipboard.', 'اللينك اتعمل واتنسخ!'));
                try {
                    await navigator.clipboard.writeText(link);
                    showNotification('success', tx('Challenge link copied to clipboard!', 'لينك التحدي اتنسخ!'));
                } catch {
                    showNotification('info', tx(`Share this link: ${link}`, `شارك اللينك ده: ${link}`));
                }
            } catch (error) {
                console.error(error);
                showNotification('error', tx('Failed to create challenge link.', 'حصل مشكلة في عمل لينك التحدي.'));
            }
        }

        // Reset state
        setSelectedFriendId(null);
        setChallengeType(null);
    };

    // Listen for live invites
    React.useEffect(() => {
        if (!socket || !userId) return;

        const handleInvite = (data: { fromId: string, fromName: string, quizId: string, roomId: string }) => {
            const newChallenge: ChallengeData = {
                token: data.roomId, // Use roomId as token for live games
                fromId: data.fromId,
                fromName: data.fromName, // Store sender name for UI
                toId: userId,
                quizId: data.quizId,
                status: 'pending',
                type: 'live', // user-defined discriminator
                timestamp: Date.now(),
                roomId: data.roomId,
                createdAt: new Date().toISOString()
            };
            setLiveChallenges(prev => [...prev, newChallenge]);
            showNotification('success', tx(`Live challenge received from ${data.fromName}!`, `وصلك تحدي لايف من ${data.fromName}!`));
        };

        socket.on('game_invite', handleInvite);
        return () => {
            socket.off('game_invite', handleInvite);
        };
    }, [socket, userId, showNotification, tx]);

    const combinedChallenges = [...liveChallenges, ...challenges];

    if (!currentUser) return null;

    return (
        <PageLayout title={tx('Social', 'الأصدقاء')}>
            <div className="p-6">
                <div className="max-w-4xl mx-auto">
                    <FriendList
                        currentUser={currentUser}
                        allUsers={allUsers}
                        onRefresh={refreshData}
                        challenges={combinedChallenges}
                        onAsyncChallenge={(id) => initiateChallenge(id, 'async')}
                        onStartChallenge={(c) => {
                            if (isLiveChallenge(c)) {
                                // Join Live Game
                                const opponent = allUsers.find(u => u.userId === c.fromId);
                                navigate('/game/vs', {
                                    state: {
                                        quizId: c.quizId,
                                        opponent: {
                                            id: c.fromId,
                                            name: opponent?.name || c.fromName || tx('Challenger', 'المتحدي'),
                                            avatar: opponent?.avatar
                                        },
                                        roomId: c.roomId
                                    }
                                });
                            } else {
                                navigate(`/challenge/${c.token}`);
                            }
                        }}
                        onChallenge={(id) => initiateChallenge(id, 'live')}
                    />
                </div>
            </div>

            <QuizSelectionModal
                isOpen={showQuizModal}
                onClose={() => setShowQuizModal(false)}
                onSelect={handleQuizSelected}
                quizzes={availableQuizzes}
            />
        </PageLayout>
    );
};

export default SocialPage;
