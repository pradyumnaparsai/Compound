import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { versionLine } from '@/domain/version';
import { useTheme } from '@/theme';

/** App version + when this code was published, so you can tell which update is running. */
export function VersionInfo() {
  const t = useTheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const line = versionLine(
    {
      appVersion: Constants.expoConfig?.version ?? '?',
      createdAt: Updates.createdAt,
      isEmbedded: Updates.isEmbeddedLaunch,
    },
    now,
  );

  return (
    <View style={{ alignItems: 'center', paddingBottom: 12 }}>
      <Text style={{ color: t.textDim, fontSize: 12 }}>{line}</Text>
    </View>
  );
}
