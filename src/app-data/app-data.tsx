import { type PropsWithChildren, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { ErrorState, LoadingState } from '@/components/states';
import { type AccentName, Screen, type ThemePreference, accentNames, useTheme } from '@/design-system';
import type { Database } from '@/domains/data-platform/database';
import { openAppDatabase } from '@/domains/data-platform/expo-database';
import { createId } from '@/domains/data-platform/ids';
import { DatabaseDamagedError, DatabaseTooNewError, migrate, migrations } from '@/domains/data-platform/migrations';
import { saveMigrationSnapshot } from '@/features/profile/migration-snapshot';
import { SettingsRepository } from '@/domains/data-platform/settings-repository';
import { registerCustomExercises } from '@/domains/exercises/catalog';
import { listCustomExercises } from '@/domains/exercises/custom-exercise-repository';
import type { Profile } from '@/domains/profile/profile';
import { getProfile } from '@/domains/profile/profile-repository';
import { WorkoutEngine } from '@/domains/workout/workout-engine';
import { setHapticsEnabled } from '@/lib/haptics';

const THEME_KEY = 'theme_preference';
const ACCENT_KEY = 'accent';
const HAPTICS_KEY = 'haptics';
const ALLOWED_IDLE_MS = 3 * 60 * 60 * 1000;

type Services = {
  database: Database;
  engine: WorkoutEngine;
  settings: SettingsRepository;
};

type AppDataValue = Services & {
  profile: Profile | null;
  hapticsEnabled: boolean;
  resumeCount: number;
  refreshProfile: () => Promise<void>;
  reloadAll: () => Promise<void>;
  changeThemePreference: (preference: ThemePreference) => Promise<void>;
  changeAccent: (accent: AccentName) => Promise<void>;
  changeHaptics: (enabled: boolean) => Promise<void>;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; services: Services; profile: Profile | null; hapticsEnabled: boolean };

const AppDataContext = createContext<AppDataValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'dark' || value === 'light';
}

function isAccent(value: string | null): value is AccentName {
  return accentNames.some((accent) => accent === value);
}

async function openServices() {
  const database = await openAppDatabase();
  await migrate(database, migrations, { beforePending: (version) => saveMigrationSnapshot(database, version) });
  const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
  // A failed recovery leaves the session on disk, so it must not lock the user
  // out of history and export. It runs again on the next launch.
  await engine.recoverInterruptedSession().catch(console.error);
  return { database, engine, settings: new SettingsRepository(database) };
}

async function readAppearance(settings: SettingsRepository) {
  try {
    const [preference, accent, haptics] = await Promise.all([
      settings.get(THEME_KEY),
      settings.get(ACCENT_KEY),
      settings.get(HAPTICS_KEY),
    ]);
    return { preference, accent, hapticsEnabled: haptics !== 'off' };
  } catch (error) {
    console.error(error);
    return { preference: null, accent: null, hapticsEnabled: true };
  }
}

export function AppDataProvider({ children }: PropsWithChildren) {
  const { setPreference, setAccent } = useTheme();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [resumeCount, setResumeCount] = useState(0);

  const readAll = useCallback(
    async (services: Services) => {
      const profile = await getProfile(services.database);
      registerCustomExercises(await listCustomExercises(services.database));
      const { preference, accent, hapticsEnabled } = await readAppearance(services.settings);
      setPreference(isThemePreference(preference) ? preference : 'system');
      setAccent(isAccent(accent) ? accent : 'cyan');
      setHapticsEnabled(hapticsEnabled);
      return { status: 'ready' as const, services, profile, hapticsEnabled };
    },
    [setAccent, setPreference],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const services = await openServices();
        const ready = await readAll(services);
        if (active) {
          setState(ready);
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setState({
            status: 'error',
            message:
              error instanceof DatabaseTooNewError
                ? 'Данные созданы более новой версией приложения. Обновите IRONVANT.'
                : error instanceof DatabaseDamagedError
                  ? 'Файл данных повреждён. Не удаляйте приложение: возможно, данные ещё удастся спасти.'
                  : 'Проверьте свободное место на iPhone и повторите. Не удаляйте приложение: вместе с ним удалятся и данные.',
          });
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [attempt, readAll]);

  const ready = state.status === 'ready' ? state : null;
  const services = ready?.services ?? null;
  const hapticsEnabled = ready?.hapticsEnabled ?? true;

  useEffect(() => {
    if (!services) {
      return;
    }
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        // Screens reload after recovery, so they show the state it left behind.
        services.engine
          .recoverInterruptedSession(ALLOWED_IDLE_MS)
          .catch(console.error)
          .finally(() => setResumeCount((count) => count + 1));
      }
    });
    return () => subscription.remove();
  }, [services]);

  const refreshProfile = useCallback(async () => {
    if (!services) {
      return;
    }
    const profile = await getProfile(services.database);
    setState({ status: 'ready', services, profile, hapticsEnabled });
  }, [hapticsEnabled, services]);

  const reloadAll = useCallback(async () => {
    if (services) {
      setState(await readAll(services));
    }
  }, [readAll, services]);

  const changeThemePreference = useCallback(
    async (preference: ThemePreference) => {
      setPreference(preference);
      await services?.settings.set(THEME_KEY, preference);
    },
    [services, setPreference],
  );

  const changeAccent = useCallback(
    async (accent: AccentName) => {
      setAccent(accent);
      await services?.settings.set(ACCENT_KEY, accent);
    },
    [services, setAccent],
  );

  const changeHaptics = useCallback(
    async (enabled: boolean) => {
      setHapticsEnabled(enabled);
      setState((current) => (current.status === 'ready' ? { ...current, hapticsEnabled: enabled } : current));
      await services?.settings.set(HAPTICS_KEY, enabled ? 'on' : 'off');
    },
    [services],
  );

  if (state.status === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorState
          message={state.message}
          onRetry={() => {
            setState({ status: 'loading' });
            setAttempt((current) => current + 1);
          }}
        />
      </Screen>
    );
  }

  return (
    <AppDataContext.Provider
      value={{
        ...state.services,
        profile: state.profile,
        hapticsEnabled: state.hapticsEnabled,
        resumeCount,
        refreshProfile,
        reloadAll,
        changeThemePreference,
        changeAccent,
        changeHaptics,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) {
    throw new Error('useAppData must be used inside AppDataProvider');
  }
  return value;
}
