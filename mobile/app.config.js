const appJson = require('./app.json');

/** Expo config — injects Google Maps API key for native react-native-maps builds. */

module.exports = () => {
  const mapApiKey = process.env.EXPO_PUBLIC_MAP_API_KEY ?? '';

  return {
    ...appJson,

    expo: {
      ...appJson.expo,

      // EAS configuration
      owner: 'hrithik7378',

      extra: {
        ...(appJson.expo.extra ?? {}),
        eas: {
          ...(appJson.expo.extra?.eas ?? {}),
          projectId: '5f6a61b8-5400-4fca-870b-c80940426f80',
        },
      },

      android: {
        ...appJson.expo.android,
        package: 'com.digimess.rider',

        config: {
          ...(appJson.expo.android?.config ?? {}),

          googleMaps: {
            apiKey: mapApiKey,
          },
        },
      },

      ios: {
        ...appJson.expo.ios,
        bundleIdentifier: 'com.digimess.rider',

        config: {
          ...(appJson.expo.ios?.config ?? {}),

          googleMapsApiKey: mapApiKey,
        },
      },
    },
  };
};