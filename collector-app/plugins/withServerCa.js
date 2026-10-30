// 서버가 사설 CA(dblab-8002-Local-CA)로 HTTPS를 하므로, 안드로이드 앱이 그 도메인에 한해 이 CA를 믿게 한다.
// iOS는 앱에서 CA를 추가할 간단한 방법이 없어 폰마다 프로파일로 설치한다 (docs/09-ios-build.md E).
// cleartextTrafficPermitted="true"는 기존 usesCleartextTraffic과 같다 — dev client가 Metro에 http로 붙는다.
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const xml = (domain) => `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
  <domain-config>
    <domain includeSubdomains="false">${domain}</domain>
    <trust-anchors>
      <certificates src="system" />
      <certificates src="@raw/server_ca" />
    </trust-anchors>
  </domain-config>
</network-security-config>
`;

module.exports = function withServerCa(config, { cert, domain }) {
  config = withDangerousMod(config, ['android', async (c) => {
    const res = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res');
    fs.mkdirSync(path.join(res, 'raw'), { recursive: true });
    fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
    fs.copyFileSync(path.resolve(c.modRequest.projectRoot, cert), path.join(res, 'raw/server_ca.pem'));
    fs.writeFileSync(path.join(res, 'xml/network_security_config.xml'), xml(domain));
    return c;
  }]);
  return withAndroidManifest(config, (c) => {
    c.modResults.manifest.application[0].$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return c;
  });
};
