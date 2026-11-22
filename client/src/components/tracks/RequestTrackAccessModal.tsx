import React, { useState } from 'react';
import {
    Lock,
    Send,
    Clock,
    Sparkles,
    BookOpen,
    Monitor,
    Cpu,
    Database,
    Globe,
    Atom,
    FlaskConical,
    Calculator,
    Languages,
    FileText,
    Brain,
    Code,
    Terminal,
    AlertCircle,
    RotateCcw
} from 'lucide-react';
import Modal from '../common/Modal';
import type { Subject, TrackRequest } from '../../types';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';

const ICON_MAP: Record<string, React.ReactNode> = {
    'BookOpen': <BookOpen className="w-8 h-8" />,
    'Monitor': <Monitor className="w-8 h-8" />,
    'Cpu': <Cpu className="w-8 h-8" />,
    'Database': <Database className="w-8 h-8" />,
    'Globe': <Globe className="w-8 h-8" />,
    'Atom': <Atom className="w-8 h-8" />,
    'FlaskConical': <FlaskConical className="w-8 h-8" />,
    'Calculator': <Calculator className="w-8 h-8" />,
    'Languages': <Languages className="w-8 h-8" />,
    'FileText': <FileText className="w-8 h-8" />,
    'Brain': <Brain className="w-8 h-8" />,
    'Code': <Code className="w-8 h-8" />,
    'Terminal': <Terminal className="w-8 h-8" />,
};

const SubjectIcon: React.FC<{ icon: string }> = ({ icon }) => {
    if (ICON_MAP[icon]) {
        return <>{ICON_MAP[icon]}</>;
    }
    return <span className="text-3xl">{icon || '🗺️'}</span>;
};

interface RequestTrackAccessModalProps {
    subject: Subject;
    existingRequest?: TrackRequest | null;
    onClose: () => void;
    onSuccess: (newRequest: TrackRequest) => void;
    onNotification: (type: 'success' | 'error' | 'info', message: string) => void;
}

const RequestTrackAccessModal: React.FC<RequestTrackAccessModalProps> = ({
    subject,
    existingRequest,
    onClose,
    onSuccess,
    onNotification
}) => {
    const { isBento } = useTheme();
    const [reason, setReason] = useState(existingRequest?.reason || '');
    const [reRequestNote, setReRequestNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isPending = existingRequest?.status === 'pending';
    const isRejected = existingRequest?.status === 'rejected';

    const handleSendRequest = async () => {
        if (isPending) return;

        setIsSubmitting(true);
        try {
            if (isRejected && existingRequest?.requestId) {
                const res = await api.reRequestTrackAccess(
                    existingRequest.requestId,
                    reason.trim() || 'Re-requesting road access',
                    reRequestNote.trim()
                );
                if (res.success) {
                    onNotification('success', res.message || 'Re-request sent to administrator with your note!');
                    onSuccess(res.request);
                    onClose();
                }
            } else {
                const res = await api.requestTrackAccess(subject._id, reason.trim());
                if (res.success) {
                    onNotification('success', res.message || 'Request sent to administrator!');
                    onSuccess(res.request);
                    onClose();
                }
            }
        } catch (error) {
            console.error('Error requesting track access:', error);
            const msg = error instanceof Error ? error.message : 'Failed to send request';
            onNotification('error', msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Track Access Required"
            description="Learning Road is currently locked"
            maxWidth="max-w-lg"
            icon={<Lock className={`w-6 h-6 ${isBento ? 'text-black' : 'text-[#fde047]'}`} />}
            footer={
                <div className="flex items-center gap-3 w-full">
                    <button
                        type="button"
                        onClick={onClose}
                        className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer ${
                            isBento
                                ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#f5f3ec]'
                                : 'bg-[#1a1714] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                        }`}
                    >
                        Close
                    </button>
                    {!isPending ? (
                        <button
                            type="button"
                            onClick={handleSendRequest}
                            disabled={isSubmitting}
                            className={`flex-[2] py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:-translate-y-0.5'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] active:scale-95'
                            }`}
                        >
                            {isSubmitting ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : isRejected ? (
                                <>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Re-Submit Access Request</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Send Access Request</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <div className={`flex-[2] py-3 px-4 rounded-2xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 text-center ${
                            isBento
                                ? 'bg-[#60a5fa] border-2 border-black text-black'
                                : 'bg-blue-500/15 border border-blue-500/40 text-blue-400'
                        }`}>
                            <Clock className="w-4 h-4 animate-spin-slow" />
                            <span>Request Pending Approval</span>
                        </div>
                    )}
                </div>
            }
        >
            <div className="space-y-5">
                {/* Track Card Preview */}
                <div className={`relative p-6 rounded-3xl flex items-start gap-4 ${
                    isBento
                        ? 'bg-[#f5f3ec] border-2 border-black shadow-[3px_3px_0px_#000]'
                        : 'bg-[#1a1714] border border-[#2e2924]'
                }`}>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${
                        isBento
                            ? 'bg-[#fde047] border-2 border-black text-black'
                            : 'bg-[#1c2317] border border-[#bef264]/30 text-[#bef264]'
                    }`}>
                        <SubjectIcon icon={subject.icon} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                isBento
                                    ? 'bg-[#fde047] text-black border border-black'
                                    : 'bg-[#231f14] text-[#fde047] border border-[#fde047]/35'
                            }`}>
                                <Lock className="w-2.5 h-2.5" /> Locked Road
                            </span>
                        </div>
                        <h3 className={`text-xl font-black uppercase tracking-tight truncate ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>
                            {subject.title}
                        </h3>
                        <p className={`text-xs font-medium line-clamp-2 mt-1 ${isBento ? 'text-neutral-700' : 'text-[#a8a29e]'}`}>
                            {subject.description || 'Curated quizzes and lessons for this track.'}
                        </p>
                    </div>
                </div>

                {/* Status Notice */}
                {isPending ? (
                    <div className={`p-4 rounded-2xl flex items-start gap-3 ${
                        isBento
                            ? 'bg-[#dbeafe] border-2 border-black text-black'
                            : 'bg-blue-500/12 border border-blue-500/40'
                    }`}>
                        <Clock className={`w-5 h-5 shrink-0 mt-0.5 ${isBento ? 'text-black' : 'text-blue-400'}`} />
                        <div>
                            <div className={`text-xs font-black uppercase tracking-wide ${isBento ? 'text-black' : 'text-blue-400'}`}>
                                Access Request Under Review
                            </div>
                            <p className={`text-xs font-medium mt-1 leading-relaxed ${isBento ? 'text-neutral-800' : 'text-blue-100/90'}`}>
                                You requested access on {new Date(existingRequest.requestedAt).toLocaleDateString()}. The administrator has been notified and will review your request.
                            </p>
                        </div>
                    </div>
                ) : isRejected ? (
                    <div className={`p-4 rounded-2xl space-y-3 ${
                        isBento
                            ? 'bg-[#fee2e2] border-2 border-black text-black'
                            : 'bg-red-500/12 border border-red-500/40'
                    }`}>
                        <div className="flex items-start gap-3">
                            <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isBento ? 'text-black' : 'text-red-400'}`} />
                            <div>
                                <div className={`text-xs font-black uppercase tracking-wide ${isBento ? 'text-black' : 'text-red-400'}`}>
                                    Previous Request Declined
                                </div>
                                <p className={`text-xs font-medium mt-1 leading-relaxed ${isBento ? 'text-neutral-800' : 'text-red-100/90'}`}>
                                    Your previous request was reviewed by the administrator with feedback. You can address their notes and submit a re-request below.
                                </p>
                            </div>
                        </div>

                        {/* Admin Feedback Note Banner */}
                        {existingRequest?.adminNote && (
                            <div className={`p-3.5 rounded-xl text-xs ${
                                isBento
                                    ? 'bg-[#fca5a5] border-2 border-black text-black'
                                    : 'bg-red-500/15 border border-red-500/40 text-red-200'
                            }`}>
                                <span className={`font-black uppercase text-[10px] block mb-1 ${isBento ? 'text-black' : 'text-red-400'}`}>
                                    Admin Feedback Note:
                                </span>
                                "{existingRequest.adminNote}"
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={`p-4 rounded-2xl flex items-start gap-3 ${
                        isBento
                            ? 'bg-[#bae6fd] border-2 border-black text-black'
                            : 'bg-[#1c2317] border border-[#bef264]/30'
                    }`}>
                        <Sparkles className={`w-5 h-5 shrink-0 mt-0.5 ${isBento ? 'text-black' : 'text-[#bef264]'}`} />
                        <div>
                            <div className={`text-xs font-black uppercase tracking-wide ${isBento ? 'text-black' : 'text-[#bef264]'}`}>
                                Request Additional Track Access
                            </div>
                            <p className={`text-xs font-medium mt-1 leading-relaxed ${isBento ? 'text-neutral-800' : 'text-[#d6d0c7]'}`}>
                                Send a request to the platform administrator to unlock this track. Once approved, you'll receive an instant notification and all quizzes in this track will unlock.
                            </p>
                        </div>
                    </div>
                )}

                {/* Form Fields if Re-Requesting or Initial Request */}
                {isRejected && (
                    <div className="space-y-2">
                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-1 ${
                            isBento ? 'text-black' : 'text-[#bef264]'
                        }`}>
                            <RotateCcw className="w-3 h-3" /> Re-Request Follow-Up Note (Required)
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Address the admin's note above (e.g. I have completed the prerequisites / I need this for my upcoming exams)..."
                            value={reRequestNote}
                            onChange={(e) => setReRequestNote(e.target.value)}
                            className={`w-full rounded-2xl p-4 text-xs font-medium outline-none transition-all resize-none ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                            }`}
                        />
                    </div>
                )}

                {!isPending && !isRejected && (
                    <div className="space-y-2">
                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${
                            isBento ? 'text-black' : 'text-[#a8a29e]'
                        }`}>
                            Note to Administrator (Optional)
                        </label>
                        <textarea
                            rows={3}
                            placeholder="e.g., I have completed my primary track / I am preparing for frontend certifications..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className={`w-full rounded-2xl p-4 text-xs font-medium outline-none transition-all resize-none ${
                                isBento
                                    ? 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] placeholder:text-neutral-500'
                                    : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] text-[#f5f3ec] placeholder:text-[#78716c]'
                            }`}
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default RequestTrackAccessModal;
