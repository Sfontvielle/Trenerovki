import { SectionPlaceholder } from '@/components/section-placeholder';
import { TabScreen } from '@/components/tab-screen';

export default function NutritionScreen() {
  return (
    <TabScreen title="Питание">
      <SectionPlaceholder description="Здесь будет дневник питания с КБЖУ, порциями и поиском продуктов." />
    </TabScreen>
  );
}
