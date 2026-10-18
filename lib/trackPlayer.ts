import { NativeModules, Platform } from 'react-native';

type RNTP = typeof import('react-native-track-player');

/**
 * react-native-track-player is native code: it exists in a development / store build, not in
 * Expo Go or on web. Importing it without the native module crashes on iOS, so we only `require`
 * it when the module is really there and fall back to expo-audio otherwise.
 */
export const hasTrackPlayer = Platform.OS !== 'web' && Boolean(NativeModules.TrackPlayerModule);

export function getTrackPlayer(): RNTP | null {
  if (!hasTrackPlayer) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-track-player') as RNTP;
}
