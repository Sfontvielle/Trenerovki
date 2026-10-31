import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let enabled = true;

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

// The silent switch wins: a muted iPhone stays quiet in the gym.
export function playRestFinished() {
  if (!enabled) {
    return;
  }
  try {
    setAudioModeAsync({ playsInSilentMode: false }).catch(console.error);
    const player = createAudioPlayer(require('../../assets/sounds/rest-finished.wav'));
    player.play();
  } catch (error) {
    console.error(error);
  }
}
