// 山手線だけの試作（工程1）。
// 遊んでみて、正解とみなす距離や地図の表示を決めるためのもの（#19）。

import { useCallback, useMemo, useState } from 'react'
import './App.css'
import MapView, { type MapPin } from './components/MapView'
import yamanote from './data/prototype/yamanote.json'
import { buildRailGraph } from './data/railGraph'
import type { RailData, StationId } from './data/types'
import {
  directions,
  judgeGuess,
  pickStartAndGoal,
  rollDice,
  walk,
  type Judgement,
  type WalkResult,
} from './game/sugoroku'
import type { LatLng } from './lib/geo'

const graph = buildRailGraph(yamanote as RailData)

type DisplayMode = 'linesAndStations' | 'linesOnly' | 'none'

const displayModes: { value: DisplayMode; label: string }[] = [
  { value: 'linesAndStations', label: '線と駅（初級）' },
  { value: 'linesOnly', label: '線だけ（中級）' },
  { value: 'none', label: 'なし（上級）' },
]

interface Settings {
  displayMode: DisplayMode
  thresholdMeters: number
  showGoal: boolean
}

type Phase =
  | { kind: 'ready' }
  | { kind: 'chooseDirection'; dice: number }
  | { kind: 'guessing'; dice: number; move: WalkResult; guess?: LatLng }
  | {
      kind: 'judged'
      dice: number
      move: WalkResult
      guess: LatLng
      judgement: Judgement
    }
  | { kind: 'finished' }

interface Game {
  start: StationId
  goal: StationId
  current: StationId
  turns: number
  correct: number
  phase: Phase
}

function newGame(): Game {
  const { start, goal } = pickStartAndGoal(graph)
  return {
    start,
    goal,
    current: start,
    turns: 0,
    correct: 0,
    phase: { kind: 'ready' },
  }
}

const station = (id: StationId) => graph.stations.get(id)!

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
}

export default function App() {
  const [game, setGame] = useState<Game>(newGame)
  const [settings, setSettings] = useState<Settings>({
    displayMode: 'linesAndStations',
    thresholdMeters: 500,
    showGoal: true,
  })
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { phase } = game
  const current = station(game.current)
  const goal = station(game.goal)

  const pins = useMemo<MapPin[]>(() => {
    const result: MapPin[] = []
    if (settings.showGoal || phase.kind === 'finished') {
      result.push({
        id: 'goal',
        kind: 'goal',
        position: goal,
        label: `ゴール ${goal.name}`,
      })
    }
    if (phase.kind !== 'finished' && current !== goal) {
      result.push({
        id: 'current',
        kind: 'current',
        position: current,
        label: `いまここ ${current.name}`,
      })
    }
    if (phase.kind === 'guessing' && phase.guess) {
      result.push({
        id: 'guess',
        kind: 'guess',
        position: phase.guess,
        label: 'ここ？',
      })
    }
    if (phase.kind === 'judged') {
      const answer = station(phase.move.stop)
      result.push({
        id: 'guess',
        kind: 'guess',
        position: phase.guess,
        label: 'よそう',
      })
      result.push({
        id: 'answer',
        kind: 'answer',
        position: answer,
        label: answer.name,
      })
    }
    return result
  }, [phase, current, goal, settings.showGoal])

  const focus = useMemo(() => {
    if (phase.kind === 'judged') {
      return {
        key: `judged-${game.turns}`,
        points: [phase.guess, station(phase.move.stop), current],
      }
    }
    if (phase.kind === 'ready') {
      return {
        key: `ready-${game.start}-${game.goal}-${game.turns}`,
        points: settings.showGoal ? [current, goal] : [current],
        maxZoom: 13,
      }
    }
    return undefined
  }, [
    phase,
    game.turns,
    game.start,
    game.goal,
    current,
    goal,
    settings.showGoal,
  ])

  const onTap = useCallback((position: LatLng) => {
    setGame((g) =>
      g.phase.kind === 'guessing'
        ? { ...g, phase: { ...g.phase, guess: position } }
        : g,
    )
  }, [])

  const roll = () => {
    setGame((g) => ({
      ...g,
      turns: g.turns + 1,
      phase: { kind: 'chooseDirection', dice: rollDice() },
    }))
  }

  const chooseDirection = (firstStep: StationId) => {
    setGame((g) => {
      if (g.phase.kind !== 'chooseDirection') return g
      const move = walk(graph, g.current, firstStep, g.phase.dice, g.goal)
      return { ...g, phase: { kind: 'guessing', dice: g.phase.dice, move } }
    })
  }

  const submitGuess = () => {
    setGame((g) => {
      if (g.phase.kind !== 'guessing' || !g.phase.guess) return g
      const judgement = judgeGuess(
        g.phase.guess,
        station(g.phase.move.stop),
        settings.thresholdMeters,
      )
      return {
        ...g,
        correct: g.correct + (judgement.correct ? 1 : 0),
        phase: { ...g.phase, kind: 'judged', guess: g.phase.guess, judgement },
      }
    })
  }

  const next = () => {
    setGame((g) => {
      if (g.phase.kind !== 'judged') return g
      const stop = g.phase.move.stop
      return {
        ...g,
        current: stop,
        phase: g.phase.move.reachedGoal
          ? { kind: 'finished' }
          : { kind: 'ready' },
      }
    })
  }

  const showLines = settings.displayMode !== 'none'
  const showStations = settings.displayMode === 'linesAndStations'

  return (
    <div className="app">
      <MapView
        graph={graph}
        showLines={showLines || phase.kind === 'judged'}
        showStations={showStations || phase.kind === 'judged'}
        pins={pins}
        onTap={onTap}
        focus={focus}
      />

      <header className="topbar">
        <div className="topbar__title">
          <span className="badge">試作</span>
          {goal.name}でお茶しよう！
        </div>
        <button
          className="icon-button"
          aria-label="試作の設定"
          onClick={() => setSettingsOpen((o) => !o)}
        >
          ⚙
        </button>
      </header>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <section className="panel">
        <div className="panel__status">
          <span>
            いま：<b>{current.name}</b>
          </span>
          <span>{game.turns}ターン目</span>
          <span>正解 {game.correct}</span>
        </div>

        {phase.kind === 'ready' && (
          <button className="primary" onClick={roll}>
            🎲 サイコロをふる
          </button>
        )}

        {phase.kind === 'chooseDirection' && (
          <>
            <p className="panel__message">
              <span className="dice">{phase.dice}</span>
              が出た！どっちに進む？
            </p>
            <div className="choices">
              {directions(graph, game.current).map((id) => (
                <button key={id} onClick={() => chooseDirection(id)}>
                  {station(id).name} の方へ
                </button>
              ))}
            </div>
          </>
        )}

        {phase.kind === 'guessing' && (
          <>
            <p className="panel__message">
              {phase.move.reachedGoal
                ? 'ゴールに着く！'
                : `${phase.move.path.length}駅進んだ。`}
              止まる駅はどこ？地図をタップしてね
            </p>
            <button
              className="primary"
              disabled={!phase.guess}
              onClick={submitGuess}
            >
              ここにする
            </button>
          </>
        )}

        {phase.kind === 'judged' && (
          <>
            <p className="panel__message">
              {phase.judgement.correct ? '⭕ 正解！' : '❌ ざんねん'}
              <b>{station(phase.move.stop).name}</b>（
              {station(phase.move.stop).kana}）でした。
              <br />
              ずれ：{formatDistance(phase.judgement.distance)}
            </p>
            <button className="primary" onClick={next}>
              {phase.move.reachedGoal ? '結果を見る' : '次へ'}
            </button>
          </>
        )}

        {phase.kind === 'finished' && (
          <>
            <p className="panel__message">
              🎉 {goal.name}に到着！ {game.turns}ターン、正解 {game.correct}回
            </p>
            <button className="primary" onClick={() => setGame(newGame())}>
              もう一度あそぶ
            </button>
          </>
        )}
      </section>
    </div>
  )
}

function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings
  onChange: (s: Settings) => void
  onClose: () => void
}) {
  return (
    <div className="settings">
      <h2>試作の設定</h2>
      <fieldset>
        <legend>予想するときの地図</legend>
        {displayModes.map((m) => (
          <label key={m.value}>
            <input
              type="radio"
              name="displayMode"
              checked={settings.displayMode === m.value}
              onChange={() => onChange({ ...settings, displayMode: m.value })}
            />
            {m.label}
          </label>
        ))}
      </fieldset>
      <label>
        正解とみなす距離：{settings.thresholdMeters}m
        <input
          type="range"
          min={100}
          max={1500}
          step={100}
          value={settings.thresholdMeters}
          onChange={(e) =>
            onChange({ ...settings, thresholdMeters: Number(e.target.value) })
          }
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.showGoal}
          onChange={(e) =>
            onChange({ ...settings, showGoal: e.target.checked })
          }
        />
        ゴールの位置を地図に出す
      </label>
      <button onClick={onClose}>閉じる</button>
    </div>
  )
}
