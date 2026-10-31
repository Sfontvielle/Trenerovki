import { useCallback } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Panel } from '@/design-system';
import { findExercise } from '@/domains/exercises/catalog';
import { buildInsights, getInsightData } from '@/domains/insights/local-insights';
import { SessionBar } from '@/features/workout/session-bar';

export default function CoachScreen() {
  const { database, engine, profile } = useAppData();
  const plannedPerWeek = profile?.daysPerWeek ?? 0;
  const limitations = profile?.limitations;

  const load = useCallback(async () => {
    const data = await getInsightData(database, plannedPerWeek, new Date());
    const discomfort = await Promise.all(
      data.plateauExercises.map((exerciseId) => engine.hasRecentDiscomfort(exerciseId)),
    );
    const plateauExercises = data.plateauExercises.filter(
      (exerciseId, index) =>
        !discomfort[index] &&
        !findExercise(exerciseId)?.loads.some((area) => limitations?.includes(area)),
    );
    return buildInsights({ ...data, plateauExercises });
  }, [database, engine, limitations, plannedPerWeek]);
  const state = useScreenData(load);

  return (
    <TabScreen title="Coach">
      <SessionBar />
      <AppText tone="secondary">
        Это не чат и не ИИ. Подсказки считаются на этом iPhone по вашим записям. План меняете только вы.
      </AppText>
      <DataView state={state}>
        {(insights) => (
          <>
            {insights.map((insight) => (
              <Panel key={insight.id}>
                <AppText variant="heading">{insight.title}</AppText>
                <AppText tone="secondary">{insight.body}</AppText>
              </Panel>
            ))}
          </>
        )}
      </DataView>
    </TabScreen>
  );
}
