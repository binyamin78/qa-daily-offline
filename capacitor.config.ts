import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dailyqa.offline.app',
  appName: 'QA Daily Offline',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_qa',
      iconColor: '#16a34a',
    },
  },
};

export default config;
