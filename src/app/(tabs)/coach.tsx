import { useCallback } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Panel } from '@/design-system';
import { buildInsights, getInsightData } from '@/domains/insights/local-insights';
import { SessionBar } from '@/features/workout/session-bar';

export default function CoachScreen() {
  const { database, profile } = useAppData();
  const plannedPerWeek = profile?.daysPerWeek ?? 0;

  const load = useCallback(
    async () => buildInsights(await getInsightData(database, plannedPerWeek, new Date())),
    [database, plannedPerWeek],
  );
  const state = useScreenData(load);

  return (
    <TabScreen title="Coach">
      <SessionBar />
      <DataView state={state}>
        {(insights) => (
          <>
            {insights.map((insight) => (
              <Panel key={insight.id}>
                <AppText variant="heading">{insight.title}</AppText>
                <AppText tone="secondary">{insight.body}</AppText>
              </Panel>
            ))}
            <AppText variant="caption" tone="secondary">
              Подсказки считаются на этом iPhone по вашим записям, без ИИ. Чат с Coach появится
              позже. Любые изменения плана вы делаете сами.
            </AppText>
          </>
        )}
      </DataView>
    </TabScreen>
  );
}
