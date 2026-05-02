import { Capacitor } from '@capacitor/core';

const RAILWAY_URL = 'https://credencelend-mobile.up.railway.app';

// Native (Android/iOS APK): use full Railway URL — device has no local server
// Web / dev server: use empty string so Vite proxy handles /api/... calls
export const API_BASE = Capacitor.isNativePlatform() ? RAILWAY_URL : '';