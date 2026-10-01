# analyze-runs.ts --json 결과로 촬영별 궤적 모양을 그린다. 라벨은 영어 (한글 폰트 경고 방지).
# 실행: python3 scripts/plot-runs.py ../data/out/runs.json ../data/out/runs.png [--new] [--nodes]
#   --new    ★(마지막 내보내기에만 있는) 촬영만
#   --nodes  점마다 시간 색으로 찍기 — 위치가 끌려간 구간·모퉁이 잘림을 볼 때
import json, math, sys
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt

src, dst = sys.argv[1], sys.argv[2]
data = json.load(open(src))
runs = [r for r in data['runs'] if r['isNew']] if '--new' in sys.argv else data['runs']
nodes = '--nodes' in sys.argv
if not runs: sys.exit('no runs to plot')

cols = min(3, len(runs)); rows = math.ceil(len(runs) / cols)
fig, axs = plt.subplots(rows, cols, figsize=(6 * cols, 5.5 * rows), squeeze=False)
for ax in axs.flat[len(runs):]: ax.axis('off')

for r, ax in zip(runs, axs.flat):
    P = r['points']; o = P[0]
    kx = 111320 * math.cos(math.radians(o['lat'])); ky = 110540
    X = [(p['lon'] - o['lon']) * kx for p in P]; Y = [(p['lat'] - o['lat']) * ky for p in P]
    if nodes:
        ax.plot(X, Y, '-', color='#ccc', lw=1, zorder=1)
        sc = ax.scatter(X, Y, c=[p['t'] for p in P], cmap='viridis', s=22, edgecolors='k', linewidths=.3, zorder=2)
        fig.colorbar(sc, ax=ax, shrink=.7, label='t (s)')
    else:
        for i in range(1, len(P)):
            ax.plot(X[i-1:i+1], Y[i-1:i+1], '-', lw=1.8, color='#2B6CB0' if P[i]['acc'] <= data['maxAcc'] else '#D9822B')
    for i in range(0, len(P), 10):
        ax.annotate(f"{P[i]['t']:.0f}s", (X[i], Y[i]), fontsize=7, color='#555', xytext=(3, 3), textcoords='offset points')
    ax.plot(X[0], Y[0], 'o', mfc='white', mec='k', ms=9, mew=2, zorder=5)
    ax.plot(X[-1], Y[-1], 's', color='k', ms=7, zorder=5)
    truth = f" / truth {r['truth']:.0f} m ({r['steps']} steps)" if r.get('truth') else ''
    ax.set_title(f"{r['at']}  app {r['app']:.0f} m / doppler {r['doppler']:.0f} m{truth}", fontsize=10)
    ax.set_aspect('equal', 'datalim'); ax.grid(alpha=.3); ax.set_xlabel('East (m)'); ax.set_ylabel('North (m)')

mode = 'nodes colored by time' if nodes else f"orange = accuracy > {data['maxAcc']} m"
fig.suptitle(f"Runs (circle = start, square = end, {mode}, stride {data['stride']} m)", fontsize=12)
plt.tight_layout(); plt.savefig(dst, dpi=110); print(dst)
