import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

async function uploadUri(
  bucket: 'posters' | 'audio',
  userId: string,
  uri: string,
  contentType: string,
  extension: string
) {
  const response = await fetch(uri);
  const body = await response.arrayBuffer();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Pick a square poster from the photo library and upload it. Returns the public URL or null if cancelled. */
export async function pickAndUploadPoster(userId: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const type = asset.mimeType ?? 'image/jpeg';
  const ext = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  return uploadUri('posters', userId, asset.uri, type, ext);
}

/** Pick an audio file (mp3, wav, m4a…) and upload it as the track's preview. */
export async function pickAndUploadAudio(userId: string): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const type = asset.mimeType ?? 'audio/mpeg';
  const ext = asset.name.split('.').pop()?.toLowerCase() || 'mp3';
  return uploadUri('audio', userId, asset.uri, type, ext);
}
