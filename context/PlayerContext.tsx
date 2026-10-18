import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { getTrackPlayer, hasTrackPlayer } from '@/lib/trackPlayer';
import type { PlayableTrack } from '@/lib/types';

type PlayerContextValue = {
  current: PlayableTrack | null;
  queue: PlayableTrack[];
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  /** Play a track (toggles if it's already the current one). Pass the list it came from as the queue. */
  play: (track: PlayableTrack, queue?: PlayableTrack[]) => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  next: () => void;
  previous: () => void;
  stop: () => void;
  /** Which engine is playing: native track player (dev/store builds) or expo-audio (Expo Go, web). */
  engine: 'track-player' | 'expo-audio';
};

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

function ExpoAudioProvider({ children }: PropsWithChildren) {
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<PlayableTrack | null>(null);
  const [queue, setQueue] = useState<PlayableTrack[]>([]);
  const finishedFor = useRef<string | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  const load = useCallback(
    (track: PlayableTrack) => {
      if (!track.audio_url) return;
      finishedFor.current = null;
      setCurrent(track);
      player.replace({ uri: track.audio_url });
      player.play();
    },
    [player]
  );

  const playable = useCallback(
    (list: PlayableTrack[]) => list.filter((t) => Boolean(t.audio_url)),
    []
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!current) return;
      const list = playable(queue);
      const index = list.findIndex((t) => t.id === current.id);
      const target = list[index + direction];
      if (target) load(target);
      else if (direction === -1) player.seekTo(0).catch(() => undefined);
    },
    [current, queue, playable, load, player]
  );

  // Auto-advance when a track ends.
  useEffect(() => {
    if (status.didJustFinish && current && finishedFor.current !== current.id) {
      finishedFor.current = current.id;
      const list = playable(queue);
      const index = list.findIndex((t) => t.id === current.id);
      const target = list[index + 1];
      if (target) load(target);
      else player.seekTo(0).catch(() => undefined);
    }
  }, [status.didJustFinish, current, queue, playable, load, player]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      queue,
      isPlaying: status.playing,
      isBuffering: status.isBuffering,
      position: status.currentTime ?? 0,
      duration: status.duration ?? 0,
      play: (track, nextQueue) => {
        if (nextQueue) setQueue(nextQueue);
        else if (!queue.some((t) => t.id === track.id)) setQueue([track]);
        if (current?.id === track.id) {
          if (status.playing) player.pause();
          else player.play();
          return;
        }
        load(track);
      },
      toggle: () => {
        if (!current) return;
        if (status.playing) player.pause();
        else player.play();
      },
      seek: (seconds) => {
        player.seekTo(Math.max(0, seconds)).catch(() => undefined);
      },
      next: () => step(1),
      previous: () => {
        if ((status.currentTime ?? 0) > 3) player.seekTo(0).catch(() => undefined);
        else step(-1);
      },
      stop: () => {
        player.pause();
        setCurrent(null);
      },
      engine: 'expo-audio',
    }),
    [current, queue, status.playing, status.isBuffering, status.currentTime, status.duration, player, load, step]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

/* ------------------------------------------------------------------ */
/* react-native-track-player engine: background audio, lock-screen     */
/* controls and a real native queue. Same context API as above.        */
/* ------------------------------------------------------------------ */

function TrackPlayerProvider({ children }: PropsWithChildren) {
  const rntp = getTrackPlayer()!;
  const { default: TP, Event, State, Capability } = rntp;
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<PlayableTrack | null>(null);
  const [queue, setQueue] = useState<PlayableTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const queueRef = useRef<PlayableTrack[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await TP.setupPlayer({ autoHandleInterruptions: true });
      } catch {
        // Already set up (fast refresh) — fine.
      }
      await TP.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.Stop,
        ],
        compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
      }).catch(() => undefined);
      if (alive) setReady(true);
    })();

    const subs = [
      TP.addEventListener(Event.PlaybackState, ({ state }) => {
        setIsPlaying(state === State.Playing);
        setIsBuffering(state === State.Buffering || state === State.Loading);
      }),
      TP.addEventListener(Event.PlaybackActiveTrackChanged, ({ track }) => {
        const match = queueRef.current.find((t) => t.id === track?.id);
        if (match) setCurrent(match);
      }),
    ];
    return () => {
      alive = false;
      subs.forEach((s) => s.remove());
    };
  }, [TP, Event, State, Capability]);

  // Poll progress only while something is loaded.
  useEffect(() => {
    if (!current) return;
    const id = setInterval(() => {
      TP.getProgress()
        .then((p) => {
          setPosition(p.position);
          setDuration(p.duration);
        })
        .catch(() => undefined);
    }, 500);
    return () => clearInterval(id);
  }, [TP, current]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      queue,
      isPlaying,
      isBuffering,
      position,
      duration,
      engine: 'track-player',
      play: (track, nextQueue) => {
        if (!ready || !track.audio_url) return;
        if (current?.id === track.id) {
          (isPlaying ? TP.pause() : TP.play()).catch(() => undefined);
          return;
        }
        const list = (nextQueue ?? [track]).filter((t) => Boolean(t.audio_url));
        const index = Math.max(0, list.findIndex((t) => t.id === track.id));
        queueRef.current = list;
        setQueue(list);
        setCurrent(track);
        (async () => {
          await TP.reset();
          await TP.add(
            list.map((t) => ({
              id: t.id,
              url: t.audio_url!,
              title: t.title,
              artist: t.subtitle,
              artwork: t.poster_url ?? undefined,
            }))
          );
          if (index > 0) await TP.skip(index);
          await TP.play();
        })().catch(() => undefined);
      },
      toggle: () => {
        if (!current) return;
        (isPlaying ? TP.pause() : TP.play()).catch(() => undefined);
      },
      seek: (seconds) => {
        TP.seekTo(Math.max(0, seconds)).catch(() => undefined);
      },
      next: () => {
        TP.skipToNext().catch(() => undefined);
      },
      previous: () => {
        if (position > 3) TP.seekTo(0).catch(() => undefined);
        else TP.skipToPrevious().catch(() => TP.seekTo(0));
      },
      stop: () => {
        TP.reset().catch(() => undefined);
        queueRef.current = [];
        setQueue([]);
        setCurrent(null);
        setPosition(0);
        setDuration(0);
      },
    }),
    [TP, ready, current, queue, isPlaying, isBuffering, position, duration]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

/** Uses react-native-track-player when the native module is in the build, else expo-audio. */
export const PlayerProvider = hasTrackPlayer ? TrackPlayerProvider : ExpoAudioProvider;

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
