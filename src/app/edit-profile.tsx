import { router } from 'expo-router';

import { useAppData } from '@/app-data/app-data';
import { Questionnaire } from '@/features/profile/questionnaire';

export default function EditProfileScreen() {
  const { profile } = useAppData();

  return <Questionnaire initial={profile} onDone={() => router.back()} />;
}
