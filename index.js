// Custom entry so react-native-track-player can register its background playback service
// before the app starts. Without the native module (Expo Go, web) this is a no-op.
import { getTrackPlayer } from './lib/trackPlayer';
import { PlaybackService } from './lib/playbackService';

const rntp = getTrackPlayer();
if (rntp) rntp.default.registerPlaybackService(() => PlaybackService);

require('expo-router/entry');
