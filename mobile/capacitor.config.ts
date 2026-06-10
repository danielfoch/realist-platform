import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ca.realist.app",
  appName: "Realist",
  webDir: "www",

  server: {
    url: "https://realist.ca",
    cleartext: false,
    androidScheme: "https",
    iosScheme: "https",
    allowNavigation: [
      "realist.ca",
      "*.realist.ca",
      "*.replit.app",
      "*.replit.dev",
      "accounts.google.com",
      "*.googleapis.com",
      "*.gstatic.com",
      "checkout.stripe.com",
      "*.stripe.com",
      "ddfcdn.realtor.ca",
      "*.realtor.ca",
    ],
  },

  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: "#ffffff",
  },

  android: {
    allowMixedContent: false,
    captureInput: true,
    backgroundColor: "#ffffff",
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: "DEFAULT",
      backgroundColor: "#ffffff",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
