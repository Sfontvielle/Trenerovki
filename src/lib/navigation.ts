import { router } from 'expo-router';

export function returnToTabs() {
  if (router.canDismiss()) {
    router.dismissAll();
  } else {
    router.replace('/');
  }
}
