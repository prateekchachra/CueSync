import { getTrackPlayer } from './trackPlayer';

/** Lock-screen / headphone / car controls for react-native-track-player. */
export async function PlaybackService() {
  const rntp = getTrackPlayer();
  if (!rntp) return;
  const { default: TrackPlayer, Event } = rntp;
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (e) => TrackPlayer.seekTo(e.position));
}
