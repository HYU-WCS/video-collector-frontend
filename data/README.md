# 실기기 실험 데이터

수집가 앱의 **[개발] 궤적 내보내기**로 받은 파일을 모아 둔다. 거리 정확도 검증용.

| 폴더 | 내용 | git |
|---|---|---|
| `raw/` | 내보낸 원본. `export-YYYYMMDD-HHMM.json` (받은 시각) | **제외** — 실험 장소(집 근처) 좌표가 그대로 들어 있다 |
| `out/` | 분석 결과 (`runs.json`, 그림) | 제외 — `raw/`에서 언제든 다시 만든다 |

## 파일 형식

내보내기 한 번 = 폰에 남아 있는 궤적 **전부**의 JSON 배열. 그래서 파일끼리 겹친다.
분석 스크립트가 `local_id`로 합치고, 마지막 파일에만 있는 촬영을 새 촬영(★)으로 표시한다.

```
[{ local_id, recorded_at, sample_rate_sec, steps?, points: [{ t, lat, lon, acc, spd?, hdg? }] }]
```

- `steps` — 촬영자가 직접 센 걸음 수 (촬영 종료 시 입력, 개발 모드 전용). 기준 거리 = 걸음 × 보폭
- `acc` — iPhone은 14.2 / 22~24 같은 몇 단계 값만 준다. 아파트 단지에서는 30m 넘게 끌려가도 14.2로 보고한 적이 있다

## 분석

```bash
cd collector-app
npx tsx scripts/analyze-runs.ts --since 2026-10-01 --json ../data/out/runs.json   # 표
python3 scripts/plot-runs.py ../data/out/runs.json ../data/out/runs.png --new      # 모양 (--nodes: 점별 시간)
```

보폭 기본값 0.6m (`--stride`로 변경). 장소 메모(단지/큰길, 코스 모양)는 파일에 없으니 촬영자에게 받는다.
