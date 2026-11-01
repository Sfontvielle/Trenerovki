import { router } from 'expo-router';
import { useCallback } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, IconButton, ListGroup, ListRow, useTheme } from '@/design-system';
import { getDeloadUntil, isDeloadActive } from '@/domains/coach/coach-repository';
import { dayKey } from '@/domains/nutrition/nutrition';
import { getProgram } from '@/domains/program/program-repository';
import { describeDay } from '@/features/workout/describe-day';
import { OpenSessionBanner } from '@/features/workout/open-session-banner';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { t } from '@/lib/i18n';

export default function WorkoutsScreen() {
  const { database, engine } = useAppData();
  const { theme } = useTheme();
  const { start, starting, error } = useStartWorkout();

  const load = useCallback(async () => {
    const [openSession, program, deloadUntil] = await Promise.all([
      engine.getOpenSession(),
      getProgram(database),
      getDeloadUntil(database),
    ]);
    return { openSession, program, deload: isDeloadActive(deloadUntil, dayKey(new Date())) };
  }, [database, engine]);
  const state = useScreenData(load);

  return (
    <TabScreen title={t('Тренировки')}>
      <DataView state={state}>
        {({ openSession, program, deload }) => (
          <>
            {openSession ? <OpenSessionBanner session={openSession} /> : null}

            {deload ? (
              <AppText tone="accent">{t('Лёгкая неделя: на один подход меньше в упражнениях, где их два и больше. Вес не прибавляйте.')}</AppText>
            ) : null}

            {error ? (
              <AppText accessibilityLiveRegion="polite" tone="danger">
                {error}
              </AppText>
            ) : null}

            <ListGroup title={t('Моя программа')}>
              {program.map((day) => (
                <ListRow
                  key={day.id}
                  accessibilityLabel={t('Изменить упражнения: {0}', { 0: day.name })}
                  onPress={() => router.push(`/plan/${day.id}`)}
                  subtitle={describeDay(day)}
                  title={day.name}
                  trailing={
                    openSession ? undefined : (
                      <IconButton
                        disabled={starting}
                        glyph="▶"
                        label={t('Начать: {0}', { 0: day.name })}
                        name="play.fill"
                        color={theme.colors.accent}
                        onPress={() => start(day.name, day)}
                      />
                    )
                  }
                />
              ))}
            </ListGroup>

            <ListGroup>
              {openSession ? null : (
                <ListRow
                  accessibilityLabel={t('Свободная тренировка')}
                  icon={{ name: 'bolt', glyph: '+', color: theme.colors.accent }}
                  onPress={() => start(t('Свободная тренировка'), null)}
                  subtitle={t('Без плана: упражнения выбираете по ходу')}
                  title={t('Свободная тренировка')}
                />
              )}
              <ListRow
                accessibilityLabel={t('Библиотека упражнений')}
                icon={{ name: 'books.vertical', glyph: '≡', color: theme.colors.accent }}
                onPress={() => router.push('/exercises')}
                title={t('Библиотека упражнений')}
              />
            </ListGroup>
          </>
        )}
      </DataView>
    </TabScreen>
  );
}
