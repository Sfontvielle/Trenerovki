import { useCallback, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen } from '@/design-system';
import {
  type Proposal,
  type ProposalStatus,
  listDecidedProposals,
  listPlanVersions,
  restorePlanVersion,
  undoProposal,
} from '@/domains/coach/coach-repository';
import { createId } from '@/domains/data-platform/ids';
import { describeChange } from '@/features/coach/describe-change';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { formatDate } from '@/lib/format';

const statusLabels: Record<ProposalStatus, string> = {
  open: 'Ожидает решения',
  accepted: 'Принято',
  rejected: 'Отклонено',
  deferred: 'Отложено',
  undone: 'Отменено',
};

const UNDO_WARNING =
  'План вернётся к состоянию до этого решения. Правки плана, сделанные позже, будут потеряны. История тренировок не изменится.';

export default function CoachHistoryScreen() {
  const { database, reloadAll } = useAppData();
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [decisions, versions] = await Promise.all([listDecidedProposals(database), listPlanVersions(database)]);
    return { decisions, versions };
  }, [database]);
  const state = useScreenData(load);

  const undo = async (proposal: Proposal) => {
    const approved = await confirm({
      title: 'Отменить решение?',
      message: UNDO_WARNING,
      confirmLabel: 'Отменить решение',
      destructive: true,
    });
    if (!approved) {
      return;
    }
    setError(null);
    try {
      await undoProposal(database, proposal.id, new Date());
      await reloadAll();
      state.reload();
    } catch (cause) {
      console.error(cause);
      setError(`Решение не отменено. ${describeFailure(cause)}`);
    }
  };

  const restore = async (versionId: string) => {
    const approved = await confirm({
      title: 'Вернуть этот план?',
      message: 'Текущий план сохранится здесь же, в истории. История тренировок не изменится.',
      confirmLabel: 'Вернуть план',
    });
    if (!approved) {
      return;
    }
    setError(null);
    try {
      await restorePlanVersion(database, versionId, createId, new Date());
      await reloadAll();
      state.reload();
    } catch (cause) {
      console.error(cause);
      setError(`План не возвращён. ${describeFailure(cause)}`);
    }
  };

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {({ decisions, versions }) => (
          <>
            {error ? (
              <AppText accessibilityLiveRegion="polite" tone="danger">
                {error}
              </AppText>
            ) : null}

            <AppText accessibilityRole="header" variant="heading">
              Решения
            </AppText>
            {decisions.length === 0 ? <AppText tone="secondary">Решений пока не было.</AppText> : null}
            {decisions.map((proposal) => (
              <Panel key={proposal.id}>
                <AppText variant="heading">{proposal.title}</AppText>
                <AppText variant="callout" tone="secondary">
                  {`${statusLabels[proposal.status]}${proposal.decidedAt ? `, ${formatDate(proposal.decidedAt)}` : ''}`}
                </AppText>
                <AppText variant="callout" tone="secondary">
                  {describeChange(proposal.change)}
                </AppText>
                {proposal.status === 'accepted' ? (
                  <Button
                    accessibilityLabel={`Отменить решение: ${proposal.title}`}
                    label="Отменить решение"
                    variant="secondary"
                    onPress={() => undo(proposal)}
                  />
                ) : null}
              </Panel>
            ))}

            <AppText accessibilityRole="header" variant="heading">
              Прежние версии плана
            </AppText>
            {versions.length === 0 ? <AppText tone="secondary">Сохранённых версий пока нет.</AppText> : null}
            {versions.map((version) => (
              <Panel key={version.id}>
                <AppText>{version.reason}</AppText>
                <AppText variant="callout" tone="secondary">
                  {formatDate(version.createdAt)}
                </AppText>
                <Button
                  accessibilityLabel={`Вернуть план: ${version.reason}`}
                  label="Вернуть этот план"
                  variant="secondary"
                  onPress={() => restore(version.id)}
                />
              </Panel>
            ))}
          </>
        )}
      </DataView>
    </Screen>
  );
}
