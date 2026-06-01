import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.credencelend.app',
  appName: 'credencelend',
  webDir: 'dist',
  plugins: {
    Deeplinks: {
      scheme: 'credencelend',
      host:   'app',
    },
  },
};

export default config;