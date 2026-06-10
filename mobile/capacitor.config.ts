import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ca.realist.app',
  appName: 'Realist',
  webDir: 'www',
  server: {
    url: 'https://realist.ca',
    cleartext: false
  },
  ios: {
    contentInset: 'automatic'
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
