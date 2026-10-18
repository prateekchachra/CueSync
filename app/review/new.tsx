import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, ErrorText, Field, RadioGroup, SectionTitle } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { createBrief } from '@/lib/briefs';
import { fetchMoods } from '@/lib/catalog';
import { haptic } from '@/lib/haptics';
import type { Mood, VocalsPref } from '@/lib/types';

const PROJECT_TYPES = ['Film', 'TV series', 'Advertising', 'Trailer', 'Video game', 'Documentary', 'Social / online'];
const GENRES = ['Electronic', 'Cinematic', 'Indie Pop', 'Indie Folk', 'Hip-Hop', 'Rock', 'R&B', 'Latin', 'Ambient', 'Classical'];

const toInt = (v: string) => {
  const n = Number(v.trim());
  return v.trim() && !Number.isNaN(n) ? Math.round(n) : null;
};

export default function NewBriefScreen() {
  const { colors } = useTheme();
  const [moods, setMoods] = useState<Mood[]>([]);
  const [title, setTitle] = useState('');
  const [projectType, setProjectType] = useState<string>('Film');
  const [description, setDescription] = useState('');
  const [pickedMoods, setPickedMoods] = useState<string[]>([]);
  const [pickedGenres, setPickedGenres] = useState<string[]>([]);
  const [vocals, setVocals] = useState<VocalsPref>('any');
  const [bpmMin, setBpmMin] = useState('');
  const [bpmMax, setBpmMax] = useState('');
  const [budget, setBudget] = useState('');
  const [territory, setTerritory] = useState('Worldwide');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMoods().then(setMoods).catch(() => undefined);
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void, item: string) =>
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  async function onPost() {
    if (!title.trim() || !description.trim()) {
      haptic.warning();
      setError('Add a title and describe the scene.');
      return;
    }
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline.trim())) {
      setError('Deadline should look like 2026-11-30.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const brief = await createBrief({
        title: title.trim(),
        project_type: projectType,
        description: description.trim(),
        moods: pickedMoods,
        genres: pickedGenres,
        vocals,
        bpm_min: toInt(bpmMin),
        bpm_max: toInt(bpmMax),
        budget_eur: toInt(budget),
        territory: territory.trim() || null,
        deadline: deadline.trim() || null,
      });
      haptic.success();
      router.replace(`/review/${brief.id}`);
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : 'Could not post brief');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Brief title" value={title} onChangeText={setTitle} autoCapitalize="sentences" placeholder="Night chase — ep. 3" />
        <SectionTitle>Project type</SectionTitle>
        <View style={styles.chips}>
          {PROJECT_TYPES.map((t) => (
            <Chip key={t} label={t} selected={projectType === t} onPress={() => setProjectType(t)} />
          ))}
        </View>
        <Field
          label="Describe the scene"
          value={description}
          onChangeText={setDescription}
          autoCapitalize="sentences"
          multiline
          placeholder="What happens on screen, the feeling, where the music sits…"
        />

        <SectionTitle>Moods</SectionTitle>
        <View style={styles.chips}>
          {moods.map((m) => (
            <Chip
              key={m.id}
              label={m.name}
              tone="accent"
              selected={pickedMoods.includes(m.name)}
              onPress={() => toggle(pickedMoods, setPickedMoods, m.name)}
            />
          ))}
        </View>
        <SectionTitle>Genres</SectionTitle>
        <View style={styles.chips}>
          {GENRES.map((g) => (
            <Chip key={g} label={g} selected={pickedGenres.includes(g)} onPress={() => toggle(pickedGenres, setPickedGenres, g)} />
          ))}
        </View>

        <SectionTitle>Vocals</SectionTitle>
        <RadioGroup<VocalsPref>
          value={vocals}
          onChange={setVocals}
          options={[
            { value: 'any', label: 'Either is fine' },
            { value: 'instrumental', label: 'Instrumental only' },
            { value: 'vocals', label: 'Needs vocals' },
          ]}
        />

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label="BPM from" value={bpmMin} onChangeText={setBpmMin} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="BPM to" value={bpmMax} onChangeText={setBpmMax} keyboardType="number-pad" />
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label="Budget (€)" value={budget} onChangeText={setBudget} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Deadline" value={deadline} onChangeText={setDeadline} placeholder="YYYY-MM-DD" />
          </View>
        </View>
        <Field label="Territory" value={territory} onChangeText={setTerritory} autoCapitalize="words" />

        <ErrorText message={error} />
        <Button label="Post brief" icon="megaphone" variant="gradient" onPress={onPost} loading={busy} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 64 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  twoCol: { flexDirection: 'row', gap: 12 },
});
