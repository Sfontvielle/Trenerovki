import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Screen, useTheme } from '@/design-system';

type TabScreenProps = PropsWithChildren<{
  title: string;
}>;

function ProfileButton() {
  const { theme } = useTheme();
  const size = theme.sizes.minTouch;

  return (
    <Pressable
      accessibilityLabel="Открыть профиль"
      accessibilityRole="button"
      onPress={() => router.push('/profile')}
      style={[styles.profileButton, { height: size, width: size }]}
    >
      <SymbolView
        fallback={<View style={[styles.fallback, { backgroundColor: theme.colors.surfaceRaised }]} />}
        name="person.crop.circle.fill"
        size={size}
        tintColor={theme.colors.textSecondary}
      />
    </Pressable>
  );
}

export function TabScreen({ title, children }: TabScreenProps) {
  const { theme } = useTheme();

  return (
    <Screen scroll>
      <View style={[styles.header, { gap: theme.spacing.m }]}>
        <AppText accessibilityRole="header" variant="title" style={styles.title}>
          {title}
        </AppText>
        <ProfileButton />
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: 999,
    flex: 1,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  profileButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
});
