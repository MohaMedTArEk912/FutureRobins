import { useState } from 'react';
import { Lock, Eye, EyeOff, X, Check, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';

interface AdminSettingsProps {
    adminEmail: string;
    onClose: () => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ adminEmail, onClose }) => {
    const { isBento } = useTheme();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters long');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        setLoading(true);

        try {
            await api.changePassword(adminEmail, currentPassword, newPassword);
            setSuccess('Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`app-dialog-overlay fixed inset-0 flex items-center justify-center z-[150] p-4 ${
            isBento ? 'bg-black/60' : 'bg-gray-900/50 dark:bg-black/80 backdrop-blur-sm'
        }`}>
            <div className={`app-dialog-panel app-dialog-panel--padded w-full max-w-md p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar ${
                isBento
                    ? 'bg-white text-black border-[3px] border-black rounded-2xl shadow-[8px_8px_0px_#000]'
                    : 'bg-[#141210] text-[#f5f3ec] border-[1.5px] border-[#2e2924] rounded-2xl shadow-[0_8px_0_#050504]'
            }`}>
                <button
                    onClick={onClose}
                    className={`absolute top-5 right-5 sm:top-6 sm:right-6 transition-all cursor-pointer ${
                        isBento
                            ? 'p-1.5 rounded-xl border-2 border-black bg-white hover:bg-[#fed7aa] text-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                            : 'p-1.5 rounded-xl bg-[#1c1917] border border-[#2e2924] text-[#a8a29e] hover:border-[#bef264] hover:text-[#f5f3ec]'
                    }`}
                >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <div className="mb-8">
                    <h2 className={`text-2xl font-black mb-1 ${isBento ? 'text-black' : 'text-[#f5f3ec]'}`}>Admin Settings</h2>
                    <p className={`text-sm ${isBento ? 'text-gray-700 font-bold' : 'text-[#a8a29e] font-medium'}`}>Change your admin password</p>
                </div>

                {error && (
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                        isBento
                            ? 'bg-[#fee2e2] border-2 border-black text-black font-bold shadow-[3px_3px_0px_#000]'
                            : 'bg-[#251317] border border-[#fb7185]/45 text-[#fb7185]'
                    }`}>
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-bold text-sm">{error}</span>
                    </div>
                )}

                {success && (
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                        isBento
                            ? 'bg-[#dcfce7] border-2 border-black text-black font-bold shadow-[3px_3px_0px_#000]'
                            : 'bg-[#171d14] border border-[#bef264]/45 text-[#bef264]'
                    }`}>
                        <Check className="w-5 h-5" />
                        <span className="font-bold text-sm">{success}</span>
                    </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-5">
                    <div>
                        <label className={`block text-xs uppercase tracking-wider mb-2 font-black ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                            Current Password
                        </label>
                        <div className="relative">
                            <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isBento ? 'text-black' : 'text-[#78716c]'}`} />
                            <input
                                type={showCurrentPassword ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className={`w-full pl-12 pr-12 py-3 rounded-xl transition-all font-medium ${
                                    isBento
                                        ? 'border-2 border-black bg-white text-black placeholder-gray-500 shadow-[2px_2px_0px_#000] focus:outline-none'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] focus:outline-none text-[#f5f3ec] placeholder-[#78716c]'
                                }`}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className={`absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer ${isBento ? 'text-black' : 'text-[#a8a29e] hover:text-[#f5f3ec]'}`}
                            >
                                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={`block text-xs uppercase tracking-wider mb-2 font-black ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                            New Password
                        </label>
                        <div className="relative">
                            <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isBento ? 'text-black' : 'text-[#78716c]'}`} />
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className={`w-full pl-12 pr-12 py-3 rounded-xl transition-all font-medium ${
                                    isBento
                                        ? 'border-2 border-black bg-white text-black placeholder-gray-500 shadow-[2px_2px_0px_#000] focus:outline-none'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] focus:outline-none text-[#f5f3ec] placeholder-[#78716c]'
                                }`}
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className={`absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer ${isBento ? 'text-black' : 'text-[#a8a29e] hover:text-[#f5f3ec]'}`}
                            >
                                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={`block text-xs uppercase tracking-wider mb-2 font-black ${isBento ? 'text-black' : 'text-[#a8a29e]'}`}>
                            Confirm New Password
                        </label>
                        <div className="relative">
                            <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isBento ? 'text-black' : 'text-[#78716c]'}`} />
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`w-full pl-12 pr-12 py-3 rounded-xl transition-all font-medium ${
                                    isBento
                                        ? 'border-2 border-black bg-white text-black placeholder-gray-500 shadow-[2px_2px_0px_#000] focus:outline-none'
                                        : 'bg-[#0e0d0b] border border-[#2e2924] focus:border-[#bef264] focus:outline-none text-[#f5f3ec] placeholder-[#78716c]'
                                }`}
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className={`absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer ${isBento ? 'text-black' : 'text-[#a8a29e] hover:text-[#f5f3ec]'}`}
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className={`flex-1 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                isBento
                                    ? 'bg-white hover:bg-gray-100 text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                    : 'bg-[#1c1917] border border-[#2e2924] text-[#d6d0c7] hover:bg-[#24201c] hover:text-[#f5f3ec]'
                            }`}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-1 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                isBento
                                    ? 'bg-[#bef264] hover:bg-[#a3e635] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5'
                                    : 'bg-[#bef264] hover:bg-[#d2fa8a] text-[#0a0908] shadow-[0_3px_0_#050504]'
                            }`}
                        >
                            {loading ? 'Changing...' : 'Change Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminSettings;
