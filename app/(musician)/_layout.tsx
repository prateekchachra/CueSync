import { TabShell } from '@/components/TabShell';

export default function MusicianTabs() {
  return (
    <TabShell
      tabs={[
        { name: 'index', title: 'Songs', icon: 'albums-outline', iconActive: 'albums' },
        { name: 'briefs', title: 'Briefs', icon: 'megaphone-outline', iconActive: 'megaphone' },
        { name: 'account', title: 'Account', icon: 'person-circle-outline', iconActive: 'person-circle' },
      ]}
    />
  );
}
