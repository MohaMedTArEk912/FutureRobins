import {
    Home,
    Compass,
    ShoppingBag,
    Calendar,
    Trophy,
    Users,
    Shield,
    Award
} from 'lucide-react';
import type { UserData } from '../types';

export const APP_NAME = "Future Robins";

export const NAV_ITEMS = [
    { path: '/', icon: Home, label: 'Home', color: 'bg-sky-500' },
    { path: '/tracks', icon: Compass, label: 'Tracks', color: 'bg-emerald-500' },
    { path: '/tournaments', icon: Trophy, label: 'Arenas', color: 'bg-amber-500' },
    { path: '/leaderboard', icon: Award, label: 'Rankings', color: 'bg-amber-500' },
    { path: '/daily', icon: Calendar, label: 'Daily', color: 'bg-orange-500' },
    { path: '/clans', icon: Shield, label: 'Classes', color: 'bg-sky-600' },
    { path: '/shop', icon: ShoppingBag, label: 'Shop', color: 'bg-teal-600' },
    { path: '/social', icon: Users, label: 'Social', color: 'bg-rose-500' },
];

export const GUEST_USER: UserData = {
    userId: 'guest',
    name: 'Explorer',
    email: '',
    role: 'user',
    totalScore: 0,
    totalTime: 0,
    totalAttempts: 0,
    rank: null,
    xp: 0,
    level: 1,
    streak: 0,
    lastLoginDate: new Date().toISOString(),
    badges: [],
    avatar: {
        skinColor: '#FCD34D',
        hairStyle: 'short',
        hairColor: '#1F2937',
        accessory: 'none',
        backgroundColor: '#0284C7',
        mood: 'happy',
        gender: 'male',
        clothing: 'tshirt',
        frame: 'none'
    },

    unlockedTracks: []
};

