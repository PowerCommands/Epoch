/**
 * SetupMusicManager — owns the start/setup screen background music.
 *
 * Responsibilities:
 *  - Load the playlist manifest produced by `scripts/generateSoundsManifest.ts`
 *  - Resolve a playlist by key (e.g. "start" or a nation id) with fallback to "start"
 *  - Play tracks sequentially, looping the playlist forever
 *  - Switch playlists cleanly without overlapping playback
 *  - Persist enabled + volume preferences in localStorage
 *  - Cope with browser autoplay restrictions by retrying on first user gesture
 */

interface SoundsManifest {
  playlists: Record<string, string[]>;
}

export const MUSIC_ENABLED_STORAGE_KEY = 'epoch.music.enabled';
export const MUSIC_VOLUME_STORAGE_KEY = 'epoch.music.volume';

const DEFAULT_VOLUME = 0.5;
const MANIFEST_URL = '/assets/sounds/manifest.json';
const START_PLAYLIST_KEY = 'start';

export class SetupMusicManager {
  private manifest: SoundsManifest = { playlists: {} };
  private manifestReady: Promise<void>;
  private audio: HTMLAudioElement | null = null;

  private enabled = true;
  private volume = DEFAULT_VOLUME;

  private requestedKey: string = START_PLAYLIST_KEY;
  private activeKey: string | null = null;
  private tracks: string[] = [];
  private trackIndex = 0;

  private pendingUserGestureRetry = false;
  private userGestureHandler: (() => void) | null = null;

  constructor() {
    this.loadSettings();
    this.manifestReady = this.loadManifest();
    // Pre-arm a first-gesture retry so the very first user interaction
    // (on any element) unblocks autoplay — even if it happens before the
    // manifest has loaded or before `audio.play()` has been attempted.
    this.queueUserGestureRetry();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getVolume(): number {
    return this.volume;
  }

  /** Switch to a playlist by key. Falls back to the start playlist if missing/empty. */
  playPlaylist(key: string): void {
    this.requestedKey = key;
    void this.manifestReady.then(() => this.applyRequestedPlaylist());
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.saveSettings();

    if (!enabled) {
      this.stopPlayback();
      return;
    }

    void this.manifestReady.then(() => this.applyRequestedPlaylist(true));
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volume = clamped;
    this.saveSettings();
    if (this.audio) this.audio.volume = clamped;
  }

  /** Stop playback and release listeners. Call on scene shutdown. */
  dispose(): void {
    this.stopPlayback();
    this.detachUserGestureListener();
  }

  private loadSettings(): void {
    try {
      const enabledRaw = localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY);
      if (enabledRaw !== null) this.enabled = enabledRaw === 'true';

      const volumeRaw = localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY);
      if (volumeRaw !== null) {
        const parsed = Number(volumeRaw);
        if (Number.isFinite(parsed)) this.volume = Math.max(0, Math.min(1, parsed));
      }
    } catch {
      // localStorage might be unavailable (private mode etc.). Safe to ignore.
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(MUSIC_ENABLED_STORAGE_KEY, String(this.enabled));
      localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(this.volume));
    } catch {
      // Ignore storage errors.
    }
  }

  private async loadManifest(): Promise<void> {
    try {
      const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
      const data = (await res.json()) as SoundsManifest;
      if (data && typeof data === 'object' && data.playlists) {
        this.manifest = data;
      }
    } catch (err) {
      console.warn('SetupMusicManager: failed to load sound manifest', err);
    }
    this.applyRequestedPlaylist();
  }

  private resolveTracks(key: string): string[] {
    const direct = this.manifest.playlists[key];
    if (direct && direct.length > 0) return direct;
    const fallback = this.manifest.playlists[START_PLAYLIST_KEY];
    return fallback ?? [];
  }

  private applyRequestedPlaylist(forceRestart = false): void {
    if (!this.enabled) return;

    const keyChanged = this.activeKey !== this.requestedKey;
    const isPlaying = this.audio !== null && !this.audio.paused;

    // Already playing the correct playlist — do nothing unless a restart is forced.
    if (!keyChanged && isPlaying && !forceRestart) return;

    const tracks = this.resolveTracks(this.requestedKey);
    this.stopPlayback();
    this.activeKey = this.requestedKey;
    this.tracks = tracks;
    this.trackIndex = 0;

    if (tracks.length === 0) return;
    this.playCurrentTrack();
  }

  private playCurrentTrack(): void {
    if (!this.enabled || this.tracks.length === 0) return;

    const src = this.tracks[this.trackIndex];
    const audio = new Audio(src);
    audio.volume = this.volume;
    audio.preload = 'auto';

    audio.addEventListener('ended', () => {
      this.trackIndex = (this.trackIndex + 1) % this.tracks.length;
      this.playCurrentTrack();
    });

    this.audio = audio;

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(() => {
        // Autoplay blocked until a user gesture. Retry on the next interaction.
        this.queueUserGestureRetry();
      });
    }
  }

  private stopPlayback(): void {
    if (!this.audio) return;
    try {
      this.audio.pause();
      this.audio.src = '';
      this.audio.load();
    } catch {
      // Ignore teardown errors.
    }
    this.audio = null;
  }

  private queueUserGestureRetry(): void {
    if (this.pendingUserGestureRetry) return;
    this.pendingUserGestureRetry = true;

    const handler = () => {
      this.detachUserGestureListener();
      if (!this.enabled) return;
      // Wait for the manifest before retrying in case the first gesture
      // happens before it has finished loading.
      void this.manifestReady.then(() => this.applyRequestedPlaylist());
    };
    this.userGestureHandler = handler;
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
  }

  private detachUserGestureListener(): void {
    if (this.userGestureHandler) {
      window.removeEventListener('pointerdown', this.userGestureHandler);
      window.removeEventListener('keydown', this.userGestureHandler);
      this.userGestureHandler = null;
    }
    this.pendingUserGestureRetry = false;
  }
}
