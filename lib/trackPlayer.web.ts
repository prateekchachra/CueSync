// Web always uses expo-audio; keeping react-native-track-player out of the web bundle.
export const hasTrackPlayer = false;

export function getTrackPlayer(): typeof import('react-native-track-player') | null {
  return null;
}
