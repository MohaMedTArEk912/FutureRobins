import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GraduationCap, Users, BookOpen, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { ClanEmblem } from '../components/social/ClassEmblem';
import type { ClassInvitePreview } from '../types';

const JoinClassPage: React.FC = () => {
    const { inviteCode } = useParams<{ inviteCode: string }>();
    const navigate = useNavigate();
    const { currentUser, refreshUser } = useAuth();
    const { showNotification } = useNotification();
    const { isBento } = useTheme();

    const [preview, setPreview] = useState<ClassInvitePreview | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            if (!inviteCode) {
                setError('Missing class invite code.');
                setLoading(false);
                return;
            }
            try {
                const data = await api.getClassByInviteCode(inviteCode, currentUser?.userId);
                setPreview(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Invalid or expired class invite link');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [inviteCode, currentUser?.userId]);

    const handleJoin = async () => {
        if (!inviteCode || !currentUser) return;
        setJoining(true);
        try {
            const res = await api.joinClassByInvite(inviteCode, currentUser.userId);
            await refreshUser();
            showNotification('success', res.message || 'Joined class successfully!');
            navigate('/classes', { replace: true });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to join class';
            setError(msg);
            showNotification('error', msg);
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0a0a0b]">
            <div className={`w-full max-w-lg rounded-[2rem] p-8 transition-all ${
                isBento
                    ? 'bg-white text-black border-[3px] border-black shadow-[8px_8px_0px_#000]'
                    : 'bg-white dark:bg-[#13141f] border border-gray-200 dark:border-white/10 shadow-2xl text-gray-900 dark:text-white'
            }`}>
                {loading ? (
                    <div className="py-16 text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto mb-4" />
                        <p className="text-sm font-bold text-gray-500">Loading class invitation...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-8 space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Invite Unavailable</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
                        <button
                            type="button"
                            onClick={() => navigate('/classes')}
                            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer ${
                                isBento
                                    ? 'bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                        >
                            Go to Classes
                        </button>
                    </div>
                ) : preview ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${
                                isBento
                                    ? 'bg-[#fde047] text-black border border-black'
                                    : 'bg-indigo-500/15 text-indigo-500 border border-indigo-500/30'
                            }`}>
                                <GraduationCap className="w-3.5 h-3.5" />
                                Class Invite
                            </span>
                            <span className="text-xs font-mono font-bold opacity-60">Code: {preview.inviteCode}</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <ClanEmblem logo={preview.logo} tag={preview.tag} name={preview.name} size="lg" />
                            <div className="min-w-0">
                                <h1 className="text-2xl font-black tracking-tight truncate">
                                    [{preview.tag}] {preview.name}
                                </h1>
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">
                                    Teacher: <span className="text-indigo-500 font-black">{preview.leaderName}</span>
                                </p>
                            </div>
                        </div>

                        {preview.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                {preview.description}
                            </p>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className={`p-3.5 rounded-2xl ${
                                isBento ? 'bg-slate-50 border-2 border-black' : 'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10'
                            }`}>
                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                                    Class Size
                                </div>
                                <div className="text-base font-black">{preview.memberCount} Members</div>
                            </div>

                            <div className={`p-3.5 rounded-2xl ${
                                isBento ? 'bg-slate-50 border-2 border-black' : 'bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10'
                            }`}>
                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                                    <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                                    Track
                                </div>
                                <div className="text-sm font-black truncate">
                                    {preview.trackTitle ? `${preview.trackIcon || '🗺️'} ${preview.trackTitle}` : 'No track assigned yet'}
                                </div>
                            </div>
                        </div>

                        {preview.isMember ? (
                            <div className="space-y-3">
                                <div className={`p-3.5 rounded-2xl flex items-center gap-2 text-xs font-bold ${
                                    isBento ? 'bg-[#bef264] text-black border-2 border-black' : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                }`}>
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>You are already enrolled in this class!</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate('/classes')}
                                    className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer ${
                                        isBento
                                            ? 'bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                    }`}
                                >
                                    <span>Open Class Dashboard</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate('/classes')}
                                    className={`flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider cursor-pointer ${
                                        isBento
                                            ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200'
                                    }`}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={joining}
                                    onClick={handleJoin}
                                    className={`flex-[2] py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                                        isBento
                                            ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                            : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25'
                                    }`}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>{joining ? 'Joining...' : 'Join Class Now'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default JoinClassPage;
