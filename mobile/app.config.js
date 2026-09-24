const appJson = require('./app.json');

/** Expo config — injects Google Maps API key for native react-native-maps builds. */

module.exports = () => {
  const mapApiKey = process.env.EXPO_PUBLIC_MAP_API_KEY ?? '';

  return {
    ...appJson,

    expo: {
      ...appJson.expo,

      owner: 'hrithik7378',

      plugins: [
        ...(appJson.expo.plugins ?? []),
        [
          'react-native-maps',
          {
            androidGoogleMapsApiKey: mapApiKey,
            iosGoogleMapsApiKey: mapApiKey,
          },
        ],
        [
          'expo-location',
          {
            locationWhenInUsePermission:
              'Khana Delivery uses your location to show your position on the delivery map and share live tracking with the customer while you are on a trip.',
            locationAlwaysAndWhenInUsePermission:
              'Khana Delivery shares your live location with ops and customers every few seconds while you are online — including when the app is in the background — so deliveries can be tracked in real time.',
            isIosBackgroundLocationEnabled: true,
            isAndroidBackgroundLocationEnabled: true,
            isAndroidForegroundServiceEnabled: true,
          },
        ],
      ],

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
          googleMaps: { apiKey: mapApiKey },
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
