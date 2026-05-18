import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.executiveflow.app',
  appName: 'Basil Daily',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
};

export default config;
