import { SectionPlaceholder } from '@/components/section-placeholder';
import { TabScreen } from '@/components/tab-screen';

export default function WorkoutsScreen() {
  return (
    <TabScreen title="Тренировки">
      <SectionPlaceholder description="Здесь будут ваша программа, библиотека упражнений и запись подходов." />
    </TabScreen>
  );
}
