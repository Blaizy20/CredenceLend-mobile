import { Capacitor } from '@capacitor/core';

// On native Android/iOS, point directly to your Railway server.
// On web, use relative URLs (empty string) so the dev server proxy works.
const RAILWAY_URL = 'credencelend-mobile.up.railway.app';

export const API_BASE = Capacitor.isNativePlatform() ? RAILWAY_URL : 'credencelend-mobile.up.railway.app';