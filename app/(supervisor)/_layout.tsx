import { TabShell } from '@/components/TabShell';

export default function SupervisorTabs() {
  return (
    <TabShell
      tabs={[
        { name: 'index', title: 'Briefs', icon: 'megaphone-outline', iconActive: 'megaphone' },
        { name: 'agent', title: 'Sync agent', icon: 'sparkles-outline', iconActive: 'sparkles' },
        { name: 'account', title: 'Account', icon: 'person-circle-outline', iconActive: 'person-circle' },
      ]}
    />
  );
}
