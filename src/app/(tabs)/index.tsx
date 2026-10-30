import { SectionPlaceholder } from '@/components/section-placeholder';
import { TabScreen } from '@/components/tab-screen';

export default function HomeScreen() {
  return (
    <TabScreen title="Главная">
      <SectionPlaceholder description="Здесь будут сегодняшняя тренировка, шаги, КБЖУ, сон, восстановление и вес." />
    </TabScreen>
  );
}
