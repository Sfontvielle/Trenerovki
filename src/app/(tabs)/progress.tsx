import { SectionPlaceholder } from '@/components/section-placeholder';
import { TabScreen } from '@/components/tab-screen';

export default function ProgressScreen() {
  return (
    <TabScreen title="Прогресс">
      <SectionPlaceholder description="Здесь будут история тренировок, рекорды и графики нагрузки." />
    </TabScreen>
  );
}
