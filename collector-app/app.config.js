// app.json이 본 설정이다. 여기서는 저장소에 넣으면 안 되는 값만 환경변수로 끼운다.
// 안드로이드 지도(react-native-maps)는 설치형 빌드에서 구글 지도 키가 없으면 빈 화면이 된다.
// 키는 EAS 환경변수 GOOGLE_MAPS_ANDROID_KEY로 둔다 (eas env:create).
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_MAPS_ANDROID_KEY && {
      config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY } },
    }),
  },
});
