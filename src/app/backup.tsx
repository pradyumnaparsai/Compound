import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { notifyError } from '@/components/notify';
import { Screen } from '@/components/Screen';
import { supabaseConfigured } from '@/data/supabase';
import {
  backupNow,
  checkCloud,
  getSession,
  keepLocal,
  lastBackupAt,
  restoreLatest,
  signIn,
  signOut,
  type BackupInfo,
  type CheckResult,
} from '@/services/backup';
import { radius, useTheme } from '@/theme';

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : 'never');

export default function BackupScreen() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [check, setCheck] = useState<{ result: CheckResult; info?: BackupInfo } | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await getSession();
      setSignedInAs(s?.user.email ?? null);
      setLast(await lastBackupAt());
      setCheck(s ? await checkCloud() : null);
    } catch (e) {
      notifyError(e, 'Backup', 'Could not reach your cloud backup. Please try again.');
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(refresh);
  }, [refresh]);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) Alert.alert('Backup', ok);
    } catch (e) {
      notifyError(e, 'Backup', 'Backup did not finish. Please try again.');
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const confirmRestore = () =>
    Alert.alert('Restore from cloud?', 'This replaces ALL data on this device with the latest cloud backup.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore', style: 'destructive', onPress: () => run(restoreLatest, 'Restored.') },
    ]);

  const input = [styles.input, { backgroundColor: t.surface, borderColor: t.border, color: t.text }];
  const btn = (bg: string) => [styles.btn, { backgroundColor: bg, opacity: busy ? 0.5 : 1 }];

  if (!supabaseConfigured) {
    return (
      <Screen>
        <Text style={{ color: t.text }}>
          Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env (restart Metro after editing).
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={[styles.title, { color: t.text }]}>Cloud backup</Text>

        {!signedInAs ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={t.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={t.textDim}
              autoCapitalize="none"
              secureTextEntry
              style={[input, { marginTop: 8 }]}
            />
            <Pressable disabled={busy} onPress={() => run(() => signIn(email, password))} style={btn(t.accent)}>
              <Text style={styles.btnText}>Sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ color: t.textDim }}>Signed in as {signedInAs}</Text>
            <Text style={{ color: t.textDim, marginTop: 4 }}>Last backup from this device: {fmt(last)}</Text>

            {check?.result === 'ready' && (
              <>
                <Pressable disabled={busy} onPress={() => run(backupNow, 'Backed up.')} style={btn(t.accent)}>
                  <Text style={styles.btnText}>Back up now</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={confirmRestore} style={btn(t.danger)}>
                  <Text style={styles.btnText}>Restore latest backup</Text>
                </Pressable>
                <Text style={{ color: t.textDim, fontSize: 12, marginTop: 12 }}>
                  Also backs up automatically when the app goes to background. The latest 5 backups are kept.
                </Text>
              </>
            )}

            {check && check.result !== 'ready' && (
              <>
                <Text style={{ color: t.text, marginTop: 16 }}>
                  {check.result === 'restore-available'
                    ? `A cloud backup from ${fmt(check.info?.createdAt)} exists and this device is empty.`
                    : `A cloud backup from ${fmt(check.info?.createdAt)} exists, but this device already has data.`}
                </Text>
                <Pressable disabled={busy} onPress={confirmRestore} style={btn(t.accent)}>
                  <Text style={styles.btnText}>Restore from cloud</Text>
                </Pressable>
                {check.result === 'conflict' && (
                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      Alert.alert('Keep this device\'s data?', 'Future backups will replace the cloud copy over time.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Keep local', style: 'destructive', onPress: () => run(keepLocal) },
                      ])
                    }
                    style={btn(t.surfaceAlt)}
                  >
                    <Text style={[styles.btnText, { color: t.text }]}>Keep this device&apos;s data</Text>
                  </Pressable>
                )}
              </>
            )}

            <Pressable disabled={busy} onPress={() => run(signOut)} hitSlop={8}>
              <Text style={{ color: t.danger, marginTop: 24 }}>Sign out</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  btn: { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
