import type { SetupMusicManager } from '../systems/SetupMusicManager';

export interface MusicControlElements {
  toggle: HTMLInputElement;
  slider: HTMLInputElement;
  valueLabel: HTMLElement;
}

export function bindMusicControls(
  music: SetupMusicManager,
  elements: MusicControlElements,
): () => void {
  const { toggle, slider, valueLabel } = elements;
  const formatVolume = (volume: number) => `${Math.round(volume * 100)}%`;

  const sync = () => {
    const enabled = music.isEnabled();
    const volume = music.getVolume();
    toggle.checked = enabled;
    slider.value = String(volume);
    slider.disabled = !enabled;
    valueLabel.textContent = formatVolume(volume);
  };

  const onToggleChange = () => {
    music.setEnabled(toggle.checked);
  };
  const onSliderInput = () => {
    music.setVolume(Number(slider.value));
  };

  toggle.addEventListener('change', onToggleChange);
  slider.addEventListener('input', onSliderInput);
  const unsubscribe = music.onSettingsChanged(sync);
  sync();

  return () => {
    toggle.removeEventListener('change', onToggleChange);
    slider.removeEventListener('input', onSliderInput);
    unsubscribe();
  };
}
