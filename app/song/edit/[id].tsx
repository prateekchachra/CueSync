import { useLocalSearchParams } from 'expo-router';

import { SongEditorScreen } from '@/components/SongEditorScreen';

export default function EditSongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SongEditorScreen songId={id} />;
}
