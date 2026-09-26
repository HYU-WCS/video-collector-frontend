import { Share } from 'react-native';
import { listTrajectories } from '@/models/storage';

// 개발용: 실측 궤적을 폰 밖으로 꺼내 지도와 비교한다. 업로드가 붙으면 필요 없다.
// Expo Go에서 쓰려고 추가 패키지 없이 RN 기본 Share로 텍스트를 보낸다 (AirDrop·메모 등).
export async function exportTrajectories() {
  const list = await listTrajectories();
  if (list.length === 0) return false;
  await Share.share({ message: JSON.stringify(list) });
  return true;
}
