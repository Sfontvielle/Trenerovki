import { type PropsWithChildren, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { ErrorState, LoadingState } from '@/components/states';
import { type AccentName, Screen, type ThemePreference, accentNames, useTheme } from '@/design-system';
import type { Database } from '@/domains/data-platform/database';
import { openAppDatabase } from '@/domains/data-platform/expo-database';
import { createId } from '@/domains/data-platform/ids';
import { DatabaseTooNewError, migrate } from '@/domains/data-platform/migrations';
import { SettingsRepository } from '@/domains/data-platform/settings-repository';
import type { Profile } from '@/domains/profile/profile';
import { getProfile } from '@/domains/profile/profile-repository';
import { WorkoutEngine } from '@/domains/workout/workout-engine';

const THEME_KEY = 'theme_preference';
const ACCENT_KEY = 'accent';
const ALLOWED_IDLE_MS = 3 * 60 * 60 * 1000;

type Services = {
  database: Database;
  engine: WorkoutEngine;
  settings: SettingsRepository;
};

type AppDataValue = Services & {
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  changeThemePreference: (preference: ThemePreference) => Promise<void>;
  changeAccent: (accent: AccentName) => Promise<void>;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; services: Services; profile: Profile | null };

const AppDataContext = createContext<AppDataValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'dark' || value === 'light';
}

function isAccent(value: string | null): value is AccentName {
  return accentNames.some((accent) => accent === value);
}

async function openServices() {
  const database = await openAppDatabase();
  await migrate(database);
  const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
  // A failed recovery leaves the session on disk, so it must not lock the user
  // out of history and export. It runs again on the next launch.
  await engine.recoverInterruptedSession().catch(console.error);
  return { database, engine, settings: new SettingsRepository(database) };
}

async function readThemeSettings(settings: SettingsRepository) {
  try {
    const [preference, accent] = await Promise.all([settings.get(THEME_KEY), settings.get(ACCENT_KEY)]);
    return { preference, accent };
  } catch (error) {
    console.error(error);
    return { preference: null, accent: null };
  }
}

export function AppDataProvider({ children }: PropsWithChildren) {
  const { setPreference, setAccent } = useTheme();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const services = await openServices();
        const profile = await getProfile(services.database);
        const { preference, accent } = await readThemeSettings(services.settings);
        if (!active) {
          return;
        }
        if (isThemePreference(preference)) {
          setPreference(preference);
        }
        if (isAccent(accent)) {
          setAccent(accent);
        }
        setState({ status: 'ready', services, profile });
      } catch (error) {
        console.error(error);
        if (active) {
          setState({
            status: 'error',
            message:
              error instanceof DatabaseTooNewError
                ? 'Данные созданы более новой версией приложения. Обновите IRONVANT.'
                : 'Проверьте свободное место на iPhone и повторите. Не удаляйте приложение: вместе с ним удалятся и данные.',
          });
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [attempt, setAccent, setPreference]);

  const services = state.status === 'ready' ? state.services : null;

  useEffect(() => {
    if (!services) {
      return;
    }
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        services.engine.recoverInterruptedSession(ALLOWED_IDLE_MS).catch(console.error);
      }
    });
    return () => subscription.remove();
  }, [services]);

  const refreshProfile = useCallback(async () => {
    if (!services) {
      return;
    }
    const profile = await getProfile(services.database);
    setState({ status: 'ready', services, profile });
  }, [services]);

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
        refreshProfile,
        changeThemePreference,
        changeAccent,
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
