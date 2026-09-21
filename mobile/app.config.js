const appJson = require('./app.json');

/** Expo config — injects Google Maps API key for native react-native-maps builds. */
module.exports = () => {
  const mapApiKey = process.env.EXPO_PUBLIC_MAP_API_KEY ?? '';

  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      android: {
        ...appJson.expo.android,
        config: {
          ...(appJson.expo.android?.config ?? {}),
          googleMaps: {
            apiKey: mapApiKey,
          },
        },
      },
      ios: {
        ...appJson.expo.ios,
        config: {
          ...(appJson.expo.ios?.config ?? {}),
          googleMapsApiKey: mapApiKey,
        },
      },
    },
  };
};
