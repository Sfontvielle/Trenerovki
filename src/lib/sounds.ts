import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let enabled = true;
let player: AudioPlayer | null = null;

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

// One player for the whole app: iOS keeps every created player until it is
// removed. The silent switch wins, so a muted iPhone stays quiet in the gym.
export function playRestFinished() {
  if (!enabled) {
    return;
  }
  try {
    if (!player) {
      setAudioModeAsync({ playsInSilentMode: false }).catch(console.error);
      player = createAudioPlayer(require('../../assets/sounds/rest-finished.wav'));
    }
    player.seekTo(0).catch(console.error);
    player.play();
  } catch (error) {
    console.error(error);
  }
}
