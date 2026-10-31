import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

function play(feedback: () => Promise<void>) {
  if (enabled && Platform.OS === 'ios') {
    feedback().catch(() => undefined);
  }
}

export function selectionFeedback() {
  play(() => Haptics.selectionAsync());
}

export function successFeedback() {
  play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}
