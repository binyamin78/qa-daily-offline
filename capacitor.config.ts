import { CapacitorConfig } from '@capacitor/cli';

// Fix: Removed 'bundledWebRuntime' property which is no longer supported in the CapacitorConfig type for Capacitor 3+
const config: CapacitorConfig = {
  appId: 'com.dailyqa.offline.app',
  appName: 'QA Daily Offline',
  webDir: 'dist'
};

export default config;