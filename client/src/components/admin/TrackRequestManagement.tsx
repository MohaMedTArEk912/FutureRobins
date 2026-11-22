import React, { useState, useEffect, useCallback } from 'react';
import {
    Inbox,
    CheckCircle2,
    XCircle,
    Clock,
    Search,
    RefreshCw,
    Mail,
    Route,
    Check,
    X,
    RotateCcw,
    AlertCircle
} from 'lucide-react';
import Modal from '../common/Modal';
import type { UserData, TrackRequest } from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface TrackRequestManagementProps {
    currentUser: UserData;
    onNotification: (type: 'success' | 'error' | 'warning', message: string) => void;
    onRefresh?: () => void | Promise<void>;
}

interface ActionModalState {
    type: 'approve' | 'reject';
    request: TrackRequest;
}

const TrackRequestManagement: React.FC<TrackRequestManagementProps> = ({
    currentUser,
    onNotification,
    onRefresh
}) => {
    const { isBento } = useTheme();
    const { tx } = useLanguage();
    const [requests, setRequests] = useState<TrackRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [actionModal, setActionModal] = useState<ActionModalState | null>(null);
    const [adminNoteInput, setAdminNoteInput] = useState('');

    const loadRequests = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.getTrackRequests(undefined, currentUser.userId);
            setRequests(Array.isArray(res.requests) ? res.requests : []);
        } catch (error) {
            console.error('Error loading track requests:', error);
            onNotification('error', 'Failed to load track requests');
        } finally {
            setIsLoading(false);
        }
    }, [currentUser.userId, onNotification]);

    useEffect(() => {
        void loadRequests();
    }, [loadRequests]);

    const openActionModal = (type: 'approve' | 'reject', request: TrackRequest) => {
        setActionModal({ type, request });
        setAdminNoteInput(
            type === 'approve'
                ? 'Your request has been approved! Enjoy learning.'
                : 'Please complete prerequisite tracks and quizzes before requesting this road.'
        );
    };

    const confirmAction = async () => {
        if (!actionModal) return;
        const { type, request } = actionModal;
        setProcessingId(request.requestId);

        try {
            if (type === 'approve') {
                const res = await api.approveTrackRequest(request.requestId, currentUser.userId, adminNoteInput);
                if (res.success) {
                    onNotification('success', res.message || 'Request approved and track unlocked!');
                }
            } else {
                const res = await api.rejectTrackRequest(request.requestId, currentUser.userId, adminNoteInput);
                if (res.success) {
                    onNotification('warning', res.message || 'Request rejected with feedback note');
                }
            }
            setActionModal(null);
            await loadRequests();
            if (onRefresh) await Promise.resolve(onRefresh());
        } catch (error) {
            console.error('Error processing track request:', error);
            const msg = error instanceof Error ? error.message : 'Action failed';
            onNotification('error', msg);
        } finally {
            setProcessingId(null);
        }
    };

    const totalRequests = requests.length;
    const pendingCount = requests.filter((r) => r.status === 'pending').length;
    const approvedCount = requests.filter((r) => r.status === 'approved').length;
    const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

    const filteredRequests = requests.filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
            (r.userName || '').toLowerCase().includes(q) ||
            (r.userEmail || '').toLowerCase().includes(q) ||
            (r.subjectTitle || '').toLowerCase().includes(q) ||
            (r.reason || '').toLowerCase().includes(q) ||
            (r.adminNote || '').toLowerCase().includes(q) ||
            (r.reRequestNote || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                <div
                    className={`p-5 relative overflow-hidden ${
                        isBento
                            ? 'bg-[#dbeafe] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'bg-[#11151b] rounded-3xl border border-blue-500/35 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className={`p-3 rounded-2xl ${isBento ? 'bg-[#60a5fa] border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'}`}>
                            <Clock className="w-5 h-5" />
                        </div>
                        {pendingCount > 0 && (
                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse ${
                                    isBento ? 'bg-[#60a5fa] text-black border border-black' : 'bg-blue-600 text-white'
                                }`}
                            >
                                Active
                            </span>
                        )}
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isBento ? 'text-black' : 'text-blue-300/80'}`}>
                        {tx('Pending Requests', 'طلبات معلقة')}
                    </div>
                    <div className={`text-3xl font-black ${isBento ? 'text-black' : 'text-blue-400'}`}>
                        {pendingCount}
                    </div>
                </div>

                <div
                    className={`p-5 relative overflow-hidden ${
                        isBento
                            ? 'bg-[#dcfce7] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'bg-[#111813] rounded-3xl border border-emerald-500/35 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className={`p-3 rounded-2xl ${isBento ? 'bg-[#4ade80] border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}>
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isBento ? 'text-black' : 'text-emerald-300/80'}`}>
                        {tx('Approved', 'تمت الموافقة')}
                    </div>
                    <div className={`text-3xl font-black ${isBento ? 'text-black' : 'text-emerald-400'}`}>
                        {approvedCount}
                    </div>
                </div>

                <div
                    className={`p-5 relative overflow-hidden ${
                        isBento
                            ? 'bg-[#fee2e2] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'bg-[#181112] rounded-3xl border border-red-500/35 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className={`p-3 rounded-2xl ${isBento ? 'bg-[#f87171] border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                            <XCircle className="w-5 h-5" />
                        </div>
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isBento ? 'text-black' : 'text-red-300/80'}`}>
                        {tx('Rejected', 'مرفوضة')}
                    </div>
                    <div className={`text-3xl font-black ${isBento ? 'text-black' : 'text-red-400'}`}>
                        {rejectedCount}
                    </div>
                </div>

                <div
                    className={`p-5 relative overflow-hidden ${
                        isBento
                            ? 'bg-[#f5f3ec] rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                            : 'bg-[#141210] rounded-3xl border border-[#2e2924] shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className={`p-3 rounded-2xl ${isBento ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_#000]' : 'bg-[#1a1714] text-[#f5f3ec] border border-[#2e2924]'}`}>
                            <Inbox className="w-5 h-5" />
                        </div>
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                        {tx('Total Requests', 'إجمالي الطلبات')}
                    </div>
                    <div className={`text-3xl font-black ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                        {totalRequests}
                    </div>
                </div>
            </div>

            {/* Action & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
                {/* Single-Border Search */}
                <div
                    className={`flex-1 px-4 py-2.5 flex items-center gap-3 ${
                        isBento
                            ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[4px_4px_0px_#000]'
                            : 'bg-[#141210] rounded-2xl border border-[#2e2924] shadow-sm focus-within:border-[#bef264]/60'
                    }`}
                >
                    <Search className={`w-4 h-4 shrink-0 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`} />
                    <input
                        type="text"
                        placeholder={tx('Search by student, email, notes, or track...', 'ابحث بالطالب أو الإيميل أو المسار...')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`chat-bare-input flex-1 bg-transparent border-none focus:ring-0 font-bold text-xs outline-none ${
                            isBento ? 'text-black placeholder:text-slate-500' : 'text-[#f5f3ec] placeholder:text-[#78716c]'
                        }`}
                    />
                </div>

                {/* Status Filter Tabs & Refresh */}
                <div className="flex flex-wrap items-center gap-2">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => {
                        const active = statusFilter === status;
                        const bentoClass = active
                            ? status === 'pending'
                                ? 'bg-[#60a5fa] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                : status === 'approved'
                                  ? 'bg-[#4ade80] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                  : status === 'rejected'
                                    ? 'bg-[#f87171] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                    : 'bg-black text-white rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                            : status === 'pending'
                              ? 'bg-[#dbeafe] hover:bg-[#93c5fd] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                              : status === 'approved'
                                ? 'bg-[#dcfce7] hover:bg-[#86efac] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                : status === 'rejected'
                                  ? 'bg-[#fee2e2] hover:bg-[#fca5a5] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                  : 'bg-white hover:bg-[#f5f3ec] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]';

                        const darkClass = active
                            ? status === 'pending'
                                ? 'bg-blue-600 text-white rounded-xl border border-blue-400 shadow-lg shadow-blue-500/25'
                                : status === 'approved'
                                  ? 'bg-emerald-600 text-white rounded-xl border border-emerald-400 shadow-lg shadow-emerald-500/25'
                                  : status === 'rejected'
                                    ? 'bg-red-600 text-white rounded-xl border border-red-400 shadow-lg shadow-red-500/25'
                                    : 'bg-[#f5f3ec] text-[#0a0908] rounded-xl border border-[#f5f3ec]'
                            : status === 'pending'
                              ? 'bg-blue-500/12 text-blue-400 border border-blue-500/35 rounded-xl hover:bg-blue-500/20'
                              : status === 'approved'
                                ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/35 rounded-xl hover:bg-emerald-500/20'
                                : status === 'rejected'
                                  ? 'bg-red-500/12 text-red-400 border border-red-500/35 rounded-xl hover:bg-red-500/20'
                                  : 'bg-[#1a1714] text-[#d6d0c7] border border-[#2e2924] rounded-xl hover:bg-[#24201c] hover:text-[#f5f3ec]';

                        return (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setStatusFilter(status)}
                                className={`btn-unstyled px-4 py-2.5 font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                                    isBento ? bentoClass : darkClass
                                }`}
                            >
                                {status === 'all' ? tx('All', 'الكل') : status}
                                {status === 'pending' && pendingCount > 0 && (
                                    <span
                                        className={`ms-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                                            isBento
                                                ? 'bg-black text-white'
                                                : active
                                                  ? 'bg-white text-blue-700'
                                                  : 'bg-blue-500/25 text-blue-200'
                                        }`}
                                    >
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}

                    <button
                        type="button"
                        onClick={() => void loadRequests()}
                        disabled={isLoading}
                        className={`btn-unstyled p-2.5 transition-all cursor-pointer shrink-0 ${
                            isBento
                                ? 'bg-[#fef08a] hover:bg-[#fde047] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'rounded-xl bg-[#1a1714] hover:bg-[#24201c] text-[#f5f3ec] border border-[#2e2924]'
                        }`}
                        title={tx('Refresh requests', 'تحديث الطلبات')}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Requests List */}
            <div className="space-y-3">
                {filteredRequests.map((req) => {
                    const isProcessing = processingId === req.requestId;
                    const dateFormatted = new Date(req.requestedAt).toLocaleString();
                    const isPendingReq = req.status === 'pending';
                    const isApprovedReq = req.status === 'approved';

                    return (
                        <div
                            key={req.requestId}
                            className={`p-5 sm:p-6 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 group ${
                                isBento
                                    ? isPendingReq
                                        ? 'bg-white rounded-2xl border-[2.5px] border-black border-l-[8px] border-l-[#3b82f6] shadow-[5px_5px_0px_#000] hover:-translate-y-0.5'
                                        : isApprovedReq
                                          ? 'bg-white rounded-2xl border-[2.5px] border-black border-l-[8px] border-l-[#22c55e] shadow-[5px_5px_0px_#000] hover:-translate-y-0.5'
                                          : 'bg-white rounded-2xl border-[2.5px] border-black border-l-[8px] border-l-[#ef4444] shadow-[5px_5px_0px_#000] hover:-translate-y-0.5'
                                    : isPendingReq
                                      ? 'bg-[#11151b] rounded-[2rem] border border-blue-500/40 hover:border-blue-400/75 shadow-sm'
                                      : isApprovedReq
                                        ? 'bg-[#111813] rounded-[2rem] border border-emerald-500/40 hover:border-emerald-400/75 shadow-sm'
                                        : 'bg-[#181112] rounded-[2rem] border border-red-500/40 hover:border-red-400/75 shadow-sm'
                            }`}
                        >
                            {/* Left: User & Track details */}
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg uppercase shrink-0 ${
                                        isBento
                                            ? isPendingReq
                                                ? 'bg-[#60a5fa] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : isApprovedReq
                                                  ? 'bg-[#4ade80] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                                  : 'bg-[#f87171] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                            : isPendingReq
                                              ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                                              : isApprovedReq
                                                ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                                                : 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                    }`}
                                >
                                    {(req.userName || req.userId || 'U').charAt(0)}
                                </div>

                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className={`font-black uppercase tracking-tight text-base truncate ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                                            {req.userName || req.userId}
                                        </h4>
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                                isBento
                                                    ? isPendingReq
                                                        ? 'bg-[#60a5fa] text-black border-2 border-black'
                                                        : isApprovedReq
                                                          ? 'bg-[#4ade80] text-black border-2 border-black'
                                                          : 'bg-[#f87171] text-black border-2 border-black'
                                                    : isPendingReq
                                                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                                                      : isApprovedReq
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                                        : 'bg-red-500/20 text-red-400 border border-red-500/50'
                                            }`}
                                        >
                                            {isPendingReq ? <Clock className="w-3 h-3" /> : isApprovedReq ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                            {req.status}
                                        </span>

                                        {req.reRequestCount && req.reRequestCount > 0 ? (
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                                    isBento
                                                        ? 'bg-[#dbeafe] text-black border border-black'
                                                        : 'bg-blue-500/15 text-blue-300 border border-blue-500/35'
                                                }`}
                                            >
                                                <RotateCcw className="w-2.5 h-2.5" /> Re-Request ({req.reRequestCount})
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className={`flex flex-wrap items-center gap-3 text-xs font-medium ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                                        <span className="flex items-center gap-1">
                                            <Mail className="w-3 h-3" />
                                            {req.userEmail}
                                        </span>
                                        <span>•</span>
                                        <span
                                            className={`flex items-center gap-1 font-bold ${
                                                isBento
                                                    ? 'text-black'
                                                    : isPendingReq
                                                      ? 'text-blue-400'
                                                      : isApprovedReq
                                                        ? 'text-emerald-400'
                                                        : 'text-red-400'
                                            }`}
                                        >
                                            <Route className="w-3.5 h-3.5" />
                                            Road: {req.subjectTitle}
                                        </span>
                                        <span>•</span>
                                        <span className="text-[11px] opacity-75">{dateFormatted}</span>
                                    </div>

                                    {req.reason && (
                                        <div
                                            className={`mt-2 p-3 rounded-xl text-xs font-medium ${
                                                isBento
                                                    ? 'bg-[#f5f3ec] border-2 border-black text-black'
                                                    : 'bg-[#0e0d0b] border border-[#2e2924] text-[#d6d0c7]'
                                            }`}
                                        >
                                            <span className={`font-black uppercase text-[10px] block mb-0.5 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>Student Reason:</span>
                                            "{req.reason}"
                                        </div>
                                    )}

                                    {req.reRequestNote && (
                                        <div
                                            className={`mt-2 p-3 rounded-xl text-xs font-medium ${
                                                isBento
                                                    ? 'bg-[#dbeafe] border-2 border-black text-black'
                                                    : 'bg-blue-500/10 border border-blue-500/30 text-blue-200'
                                            }`}
                                        >
                                            <span className={`font-black uppercase text-[10px] block mb-0.5 ${isBento ? 'text-black' : 'text-blue-400'}`}>
                                                Student Re-Request Follow-Up Note:
                                            </span>
                                            "{req.reRequestNote}"
                                        </div>
                                    )}

                                    {req.adminNote && (
                                        <div
                                            className={`mt-2 p-3 rounded-xl text-xs font-medium ${
                                                isBento
                                                    ? isPendingReq
                                                        ? 'bg-[#dbeafe] border-2 border-black text-black'
                                                        : isApprovedReq
                                                          ? 'bg-[#dcfce7] border-2 border-black text-black'
                                                          : 'bg-[#fee2e2] border-2 border-black text-black'
                                                    : isPendingReq
                                                      ? 'bg-blue-500/10 border border-blue-500/30 text-blue-200'
                                                      : isApprovedReq
                                                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
                                                        : 'bg-red-500/10 border border-red-500/30 text-red-200'
                                            }`}
                                        >
                                            <span
                                                className={`font-black uppercase text-[10px] block mb-0.5 ${
                                                    isBento
                                                        ? 'text-black'
                                                        : isPendingReq
                                                          ? 'text-blue-400'
                                                          : isApprovedReq
                                                            ? 'text-emerald-400'
                                                            : 'text-red-400'
                                                }`}
                                            >
                                                Admin Feedback / Decision Note:
                                            </span>
                                            "{req.adminNote}"
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                {isPendingReq ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => openActionModal('approve', req)}
                                            disabled={isProcessing}
                                            className={`btn-unstyled px-4 py-2.5 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                                                isBento
                                                    ? 'bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl border border-emerald-400/50 shadow-lg shadow-emerald-600/20 active:scale-95'
                                            }`}
                                        >
                                            <Check className="w-4 h-4" />
                                            <span>{tx('Approve...', 'موافقة...')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openActionModal('reject', req)}
                                            disabled={isProcessing}
                                            className={`btn-unstyled px-4 py-2.5 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                                                isBento
                                                    ? 'bg-[#f87171] hover:bg-[#ef4444] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]'
                                                    : 'bg-red-600/20 hover:bg-red-600/35 text-red-400 border border-red-500/45 rounded-xl active:scale-95'
                                            }`}
                                        >
                                            <X className="w-4 h-4" />
                                            <span>{tx('Reject...', 'رفض...')}</span>
                                        </button>
                                    </>
                                ) : req.status === 'rejected' ? (
                                    <button
                                        type="button"
                                        onClick={() => openActionModal('approve', req)}
                                        disabled={isProcessing}
                                        className={`btn-unstyled px-4 py-2 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                            isBento
                                                ? 'bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'
                                                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 rounded-xl'
                                        }`}
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>{tx('Re-Approve...', 'إعادة موافقة...')}</span>
                                    </button>
                                ) : (
                                    <div
                                        className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl ${
                                            isBento
                                                ? 'bg-[#4ade80] text-black border-2 border-black'
                                                : 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/40'
                                        }`}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>{tx('Unlocked for User', 'مفتوح للطالب')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {filteredRequests.length === 0 && !isLoading && (
                    <div
                        className={`py-20 text-center ${
                            isBento
                                ? 'bg-white rounded-2xl border-[2.5px] border-black shadow-[5px_5px_0px_#000]'
                                : 'bg-[#141210] rounded-[2.5rem] border-2 border-dashed border-[#2e2924]'
                        }`}
                    >
                        <Inbox className={`w-14 h-14 mx-auto mb-3 ${isBento ? 'text-black' : 'text-[#78716c]'}`} />
                        <h4 className={`text-lg font-black uppercase tracking-tight ${isBento ? 'text-black' : 'text-[#d6d0c7]'}`}>
                            {tx('No track requests found', 'مفيش طلبات مسارات حالياً')}
                        </h4>
                        <p className={`text-xs font-medium mt-1 ${isBento ? 'text-neutral-700 font-semibold' : 'text-[#a8a29e]'}`}>
                            {statusFilter !== 'all'
                                ? `No ${statusFilter} requests match your filter`
                                : tx('When students request additional roads, they will appear here.', 'لما طالب يطلب فتح مسار جديد هيظهرلك هنا.')}
                        </p>
                    </div>
                )}
            </div>

            {/* Decision Confirmation Modal with Admin Note input */}
            {actionModal && (
                <Modal
                    isOpen={true}
                    onClose={() => setActionModal(null)}
                    title={actionModal.type === 'approve' ? 'Approve Track Access' : 'Reject Track Access'}
                    description={`Review request for ${actionModal.request.userName} on ${actionModal.request.subjectTitle}`}
                    maxWidth="max-w-lg"
                    icon={actionModal.type === 'approve'
                        ? <CheckCircle2 className={`w-6 h-6 ${isBento ? 'text-black' : 'text-emerald-400'}`} />
                        : <AlertCircle className={`w-6 h-6 ${isBento ? 'text-black' : 'text-red-400'}`} />}
                    iconContainerClassName={
                        isBento
                            ? actionModal.type === 'approve'
                                ? 'bg-[#4ade80] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                : 'bg-[#f87171] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                            : actionModal.type === 'approve'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40'
                                : 'bg-red-500/15 text-red-400 border border-red-500/40'
                    }
                    footer={
                        <div className="flex items-center gap-3 w-full">
                            <button
                                type="button"
                                onClick={() => setActionModal(null)}
                                className={`btn-unstyled flex-1 py-3 font-black text-xs uppercase tracking-wider transition-all cursor-pointer rounded-xl ${
                                    isBento
                                        ? 'bg-white hover:bg-[#f5f3ec] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#1a1714] hover:bg-[#24201c] border border-[#2e2924] text-[#d6d0c7]'
                                }`}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmAction()}
                                disabled={processingId !== null}
                                className={`btn-unstyled flex-1 py-3 font-black text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 rounded-xl ${
                                    isBento
                                        ? actionModal.type === 'approve'
                                            ? 'bg-[#4ade80] hover:bg-[#22c55e] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                            : 'bg-[#f87171] hover:bg-[#ef4444] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                        : actionModal.type === 'approve'
                                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50'
                                          : 'bg-red-600 hover:bg-red-500 text-white border border-red-400/50'
                                }`}
                            >
                                {processingId ? 'Processing...' : actionModal.type === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                            </button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div
                            className={`p-4 rounded-2xl space-y-1 text-xs ${
                                isBento
                                    ? 'bg-[#f5f3ec] border-2 border-black text-black'
                                    : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7]'
                            }`}
                        >
                            <div className="font-bold">
                                Student: <span className="font-normal">{actionModal.request.userName} ({actionModal.request.userEmail})</span>
                            </div>
                            <div className="font-bold">
                                Requested Road: <span className={`font-black ${isBento ? 'text-black' : 'text-[#bef264]'}`}>{actionModal.request.subjectTitle}</span>
                            </div>
                            {actionModal.request.reason && (
                                <div className="font-bold pt-1">
                                    Student Note: <span className="font-normal italic">"{actionModal.request.reason}"</span>
                                </div>
                            )}
                            {actionModal.request.reRequestNote && (
                                <div className="font-bold pt-1">
                                    Re-Request Note: <span className="font-normal italic">"{actionModal.request.reRequestNote}"</span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className={`block text-xs font-black uppercase tracking-wider mb-1.5 ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                                Feedback / Decision Note for Student:
                            </label>
                            <textarea
                                rows={3}
                                value={adminNoteInput}
                                onChange={(e) => setAdminNoteInput(e.target.value)}
                                placeholder="Write a guidance note explaining approval or reasons for rejection..."
                                className={`w-full p-3.5 rounded-xl text-xs font-medium focus:outline-none transition-all resize-none ${
                                    isBento
                                        ? 'bg-white border-2 border-black text-black placeholder:text-gray-400 shadow-[2px_2px_0px_#000]'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] text-[#f5f3ec] placeholder:text-[#78716c] focus:border-[#bef264]'
                                }`}
                            />
                            <p className={`text-[10px] mt-1 ${isBento ? 'text-slate-600 font-semibold' : 'text-[#a8a29e]'}`}>
                                This note will be sent directly to the student in their in-app Notification Center and displayed in their road access modal.
                            </p>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default TrackRequestManagement;
