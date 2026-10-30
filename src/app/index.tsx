import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen, useTheme } from '@/design-system';

export default function HomeScreen() {
  const { theme } = useTheme();

  return (
    <Screen>
      <View style={[styles.content, { gap: theme.spacing.s }]}>
        <AppText variant="display">IRONVANT</AppText>
        <AppText tone="secondary">Каркас приложения. Рабочие экраны появятся на следующих этапах.</AppText>
      </View>
      {__DEV__ ? (
        <Button label="Открыть дизайн-систему" onPress={() => router.push('/design-system')} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
});
