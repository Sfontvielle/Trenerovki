import { randomUUID } from 'expo-crypto';

export function createId() {
  return randomUUID();
}
