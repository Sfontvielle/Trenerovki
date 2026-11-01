import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Button, Chip, IconButton, ListGroup, ListRow, Panel, useTheme } from '@/design-system';
import { readCoachFacts } from '@/domains/coach/coach-facts';
import {
  CoachError,
  type Proposal,
  acceptProposal,
  deferProposal,
  listOpenProposals,
  rejectProposal,
  syncProposals,
} from '@/domains/coach/coach-repository';
import { type CoachFacts, buildProposals } from '@/domains/coach/proposals';
import { createId } from '@/domains/data-platform/ids';
import { exerciseName, findAlternatives, findExercise } from '@/domains/exercises/catalog';
import { buildInsights, getInsightData } from '@/domains/insights/local-insights';
import { targetFor } from '@/domains/program/generate-plan';
import { readyForDemanding } from '@/domains/profile/profile';
import { useCoachStyle } from '@/features/coach/use-coach-style';
import { describeChange } from '@/features/coach/describe-change';
import { SessionBar } from '@/features/workout/session-bar';
import { describeFailure } from '@/lib/describe-failure';
import { t } from '@/lib/i18n';

type ProposalCardProps = {
  proposal: Proposal;
  detailed: boolean;
  facts: CoachFacts | null;
  onChanged: () => void;
};

function ProposalCard({ proposal, detailed, facts: loadedFacts, onChanged }: ProposalCardProps) {
  const { database, profile, reloadAll } = useAppData();
  const { theme } = useTheme();
  const { change } = proposal;
  const [chosen, setChosen] = useState(change.type === 'replace' ? change.toExerciseId : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options =
    change.type === 'replace' && profile && loadedFacts
      ? [
          change.toExerciseId,
          ...findAlternatives(change.fromExerciseId, {
            equipment: profile.equipment,
            limitations: profile.limitations,
            allowDemanding: readyForDemanding(profile),
            // The same exclusions the guardrails apply when the choice is accepted.
            excluded: [
              change.toExerciseId,
              ...loadedFacts.program.flatMap((day) => day.exercises.map(({ exerciseId }) => exerciseId)),
              ...loadedFacts.avoided,
              ...loadedFacts.discomfort,
            ],
            count: 3,
          }).map(({ id }) => id),
        ]
      : [];

  const accept = async () => {
    if (!profile) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const now = new Date();
      const facts = await readCoachFacts(database, profile, now);
      const finalChange =
        change.type === 'replace' && chosen
          ? { ...change, toExerciseId: chosen, target: targetFor(chosen, profile.goal, profile.experience) }
          : change;
      await acceptProposal(database, proposal.id, { facts, now, createId, change: finalChange });
      await reloadAll();
      onChanged();
    } catch (cause) {
      console.error(cause);
      setError(
        cause instanceof CoachError
          ? t('Предложение устарело: план или ограничения изменились. Экран обновится.')
          : t('Изменение не применено. {0}', { 0: describeFailure(cause) }),
      );
      setBusy(false);
      if (cause instanceof CoachError) {
        onChanged();
      }
    }
  };

  const decide = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (cause) {
      console.error(cause);
      setError(t('Решение не сохранено. {0}', { 0: describeFailure(cause) }));
      setBusy(false);
    }
  };

  return (
    <Panel>
      <AppText variant="heading">{proposal.title}</AppText>
      {detailed ? <AppText tone="secondary">{proposal.why}</AppText> : null}
      <AppText variant="callout" tone="secondary">
        {describeChange(change)}
      </AppText>
      {options.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.s }}>
          {options
            .filter((id) => findExercise(id))
            .map((id) => (
              <Chip key={id} label={exerciseName(id)} selected={chosen === id} onPress={() => setChosen(id)} />
            ))}
        </View>
      ) : null}
      {error ? (
        <AppText accessibilityLiveRegion="polite" variant="callout" tone="danger">
          {error}
        </AppText>
      ) : null}
      <View style={[styles.actions, { gap: theme.spacing.s }]}>
        <View style={styles.accept}>
          <Button accessibilityLabel={t('Принять: {0}', { 0: proposal.title })} label={t('Принять')} loading={busy} onPress={accept} />
        </View>
        <IconButton
          disabled={busy}
          glyph="◷"
          label={t('Отложить на неделю: {0}', { 0: proposal.title })}
          name="clock"
          onPress={() => decide(() => deferProposal(database, proposal.id, new Date()))}
        />
        <IconButton
          disabled={busy}
          glyph="×"
          label={t('Отклонить: {0}', { 0: proposal.title })}
          name="xmark"
          onPress={() => decide(() => rejectProposal(database, proposal.id, new Date()))}
        />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  accept: {
    flex: 1,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});

export default function CoachScreen() {
  const { database, engine, profile } = useAppData();
  const { detailed } = useCoachStyle();
  const { theme } = useTheme();
  const plannedPerWeek = profile?.daysPerWeek ?? 0;
  const limitations = profile?.limitations;

  const load = useCallback(async () => {
    const now = new Date();
    const data = await getInsightData(database, plannedPerWeek, now);
    const discomfort = await Promise.all(
      data.plateauExercises.map((exerciseId) => engine.hasRecentDiscomfort(exerciseId)),
    );
    const plateauExercises = data.plateauExercises.filter(
      (exerciseId, index) =>
        !discomfort[index] &&
        !findExercise(exerciseId)?.loads.some((area) => limitations?.includes(area)),
    );
    const facts = profile ? await readCoachFacts(database, profile, now) : null;
    if (facts) {
      await syncProposals(database, buildProposals(facts), now, createId);
    }
    return {
      facts,
      insights: buildInsights({ ...data, plateauExercises }),
      proposals: await listOpenProposals(database),
    };
  }, [database, engine, limitations, plannedPerWeek, profile]);
  const state = useScreenData(load);

  return (
    <TabScreen title="Coach">
      <SessionBar />
      <DataView state={state}>
        {({ facts, insights, proposals }) => (
          <>
            {proposals.length > 0 ? (
              <AppText accessibilityRole="header" variant="heading">
                {t('Предложения')}
              </AppText>
            ) : null}
            {proposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                detailed={detailed}
                facts={facts}
                onChanged={state.reload}
              />
            ))}

            <ListGroup title={t('Отчёт за неделю')}>
              {insights.map((insight) => (
                <ListRow
                  key={insight.id}
                  subtitle={detailed || insight.id === 'no-data' ? insight.body : undefined}
                  title={insight.title}
                />
              ))}
            </ListGroup>

            <ListGroup
              footer={t('Это не чат и не ИИ. Подсказки считаются на этом iPhone по вашим записям. План меняете только вы.')}
            >
              <ListRow
                accessibilityLabel={t('История решений')}
                icon={{ name: 'clock.arrow.circlepath', glyph: '◷', color: theme.colors.accent }}
                onPress={() => router.push('/coach/history')}
                title={t('История решений')}
              />
              <ListRow
                accessibilityLabel={t('Память и предпочтения')}
                icon={{ name: 'brain', glyph: '◉', color: theme.colors.accent }}
                onPress={() => router.push('/coach/memory')}
                title={t('Память и предпочтения')}
              />
            </ListGroup>
          </>
        )}
      </DataView>
    </TabScreen>
  );
}
