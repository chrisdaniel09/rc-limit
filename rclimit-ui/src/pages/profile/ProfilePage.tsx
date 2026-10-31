import { Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, DescriptionList } from '@/components/ui/feedback';
import { RadioCards, Segmented } from '@/components/ui/choice';
import { Avatar } from '@/layouts/Topbar';
import { PageHeader } from '@/layouts/templates';
import type { ColorMode, Density } from '@/lib/theme';

// §10.14 Profile & preferences. Preferences are kept on this device.
export default function ProfilePage() {
  const { user } = useAuth();
  const { colorMode, setColorMode, density, setDensity } = useTheme();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Profile and preferences" />
      <Card title="Profile">
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={user?.fullName} />
          <div>
            <p className="font-medium text-foreground">{user?.fullName}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <DescriptionList
          columns={2}
          items={[
            { label: 'Roles', value: user?.roles?.map((r) => r.name).join(', ') || '—' },
            { label: 'Rights', value: `${user?.rightCodes?.length ?? 0} granted` },
          ]}
        />
      </Card>
      <Card title="Appearance" description="Saved on this device.">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-label text-foreground">Color mode</p>
            <RadioCards<ColorMode>
              aria-label="Color mode"
              columns={3}
              value={colorMode}
              onValueChange={setColorMode}
              options={[
                { value: 'light', title: 'Light', icon: <Sun aria-hidden className="size-4" />, description: 'Always light' },
                { value: 'dark', title: 'Dark', icon: <Moon aria-hidden className="size-4" />, description: 'Always dark' },
                { value: 'system', title: 'System', icon: <Monitor aria-hidden className="size-4" />, description: 'Follow your device' },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-label text-foreground">Density</p>
            <Segmented<Density>
              aria-label="Density"
              value={density}
              onValueChange={setDensity}
              options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]}
            />
            <p className="mt-1.5 text-caption text-muted-foreground">Compact fits more rows on screen. Touch screens always keep large targets.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
