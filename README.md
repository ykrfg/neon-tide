# neon-tide

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/ykrfg/neon-tide/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/ykrfg/neon-tide/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Neon Tide** is a 2D arena defense shooter in vanilla JavaScript and Canvas 2D — no libraries, no build step, no network. You pilot a guardian wisp defending a crystal Core at the center of a neon arena against eight waves of geometric drifters: triangles that hunt the Core, darts that hunt you, weaving orbs, armored brutes, and a boss — the Hollow Star — that besieges the Core with radial bursts. Between waves you pick one of three upgrades (damage, fire rate, spread shot, piercing rounds, dash recharge, repairs and more) and build the wisp your run needs.

## 日本語の紹介

**Neon Tide** は、ネオンに光るアリーナで中央のクリスタル「コア」を守る2D防衛シューティングです。プレイヤーは守護者ウィスプを操作し、WASD／矢印キーで移動、マウスで照準、クリック長押し（またはスペースキー）で射撃、Shiftでダッシュします。全8ウェーブと最終ボスを相手に、ウェーブごとに3つの強化から1つを選んでビルドを変えながら戦います。コアか自分、どちらかのHPが尽きればゲームオーバーです。ブラウザでそのまま遊べて、インストール不要・オフラインでも動作します。

起動方法は下の「Run it」の通りです。

Controls: WASD or arrow keys to move, mouse to aim, hold the mouse button or Space to shoot, Shift or right-click to dash (briefly invulnerable), P to pause, M to mute. Win by holding all eight waves; lose if the wisp or the Core falls. All sound — effects and the bassline — is synthesized live with WebAudio.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Any static file server pointed at `game/` works just as well. To hand the entry in the way the bounty does, run `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1b5ny4cj&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
