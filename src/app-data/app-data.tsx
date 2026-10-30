import { type PropsWithChildren, createContext, useCallback, useContext, useEffect, useState } from 'react';

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
  await engine.recoverInterruptedSession();
  return { database, engine, settings: new SettingsRepository(database) };
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
        const [profile, preference, accent] = await Promise.all([
          getProfile(services.database),
          services.settings.get(THEME_KEY),
          services.settings.get(ACCENT_KEY),
        ]);
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
                : 'Ваши данные остаются на устройстве. Попробуйте открыть их ещё раз.',
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
