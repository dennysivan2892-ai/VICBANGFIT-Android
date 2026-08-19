import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vicbangfit.app',
  appName: 'VICBANGFIT',
  webDir: 'dist',
  android: {
    allowMixedContent: false
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
