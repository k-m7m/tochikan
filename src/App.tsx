// 試作2：目的地レース（案A、#52）。
// 実データの盤面（#51）で、駅名だけの目的地へサイコロで向かう。
// コマは目の数だけ1駅ずつ進み、分岐や乗換駅で進む方向を選ぶ（#57）。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import MapView, { type MapFocus } from './components/MapView'
import rail from './data/generated/rail.json'
import type { RailData } from './data/types'
import { buildBoard, type NodeId } from './game/board'
import { clearKnown, loadKnown, saveKnown } from './game/knownStations'
import {
  BEGINNER_LINES,
  PROTOTYPE_LINE_COLORS,
  shortLineName,
} from './game/lines'
import {
  defaultRaceSettings,
  nextGoal,
  roll,
  showHint,
  startRace,
  step,
  stepOptions,
  type RaceSettings,
  type RaceState,
} from './game/race'
import { direction8, distanceMeters } from './lib/geo'

const board = buildBoard(rail as RailData, BEGINNER_LINES)
const lineName = new Map(board.lines.map((l) => [l.id, shortLineName(l.name)]))
const node = (id: NodeId) => board.nodes.get(id)!

/** サイコロを振る演出の長さと、1駅進む間隔（ミリ秒） */
const ROLL_MS = 700
const ROLL_FRAME_MS = 70
const STEP_MS = 420

function randomFace(): number {
  return 1 + Math.floor(Math.random() * 6)
}

/** 道順で使った路線を、重ねずに並べる（例：中央線(快速) → 山手線） */
function describeLines(lineIds: string[]): string {
  const names: string[] = []
  for (const id of lineIds) {
    const name = lineName.get(id) ?? id
    if (names[names.length - 1] !== name) names.push(name)
  }
  return names.join(' → ')
}

interface DebugSettings {
  showGoal: boolean
}

export default function App() {
  const [settings, setSettings] = useState<RaceSettings>(defaultRaceSettings)
  const [debug, setDebug] = useState<DebugSettings>({ showGoal: false })
  const [race, setRace] = useState<RaceState>(() =>
    startRace(board, defaultRaceSettings),
  )
  const [known, setKnown] = useState<Set<NodeId>>(loadKnown)
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** サイコロを振っている途中に見せる目。振っていなければ null */
  const [rollingFace, setRollingFace] = useState<number | null>(null)
  const rollTimer = useRef<number | undefined>(undefined)

  const remember = useCallback((ids: NodeId[]) => {
    setKnown((prev) => {
      if (ids.every((id) => prev.has(id))) return prev
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      saveKnown(next)
      return next
    })
  }, [])

  const { phase } = race
  const current = node(race.position)
  const goal = node(race.goal)
  const options = useMemo(() => stepOptions(race, board), [race])
  /** 分岐や乗換駅で、進む方向を選ぶ必要があるとき */
  const choosing = phase.kind === 'moving' && options.length > 1

  const goStep = useCallback(
    (to: NodeId) => {
      remember([to])
      setRace((r) => step(r, board, to))
    },
    [remember],
  )

  // 一本道なら、自動で1駅ずつ進む
  useEffect(() => {
    if (phase.kind !== 'moving' || options.length !== 1) return
    const timer = window.setTimeout(() => goStep(options[0].to), STEP_MS)
    return () => window.clearTimeout(timer)
  }, [phase, options, goStep])

  useEffect(() => () => window.clearInterval(rollTimer.current), [])

  const onRoll = () => {
    if (rollingFace !== null) return
    remember([race.position])
    const started = Date.now()
    setRollingFace(randomFace())
    rollTimer.current = window.setInterval(() => {
      if (Date.now() - started < ROLL_MS) {
        setRollingFace(randomFace())
        return
      }
      window.clearInterval(rollTimer.current)
      setRollingFace(null)
      setRace((r) => roll(r, randomFace()))
    }, ROLL_FRAME_MS)
  }

  const focus = useMemo<MapFocus | undefined>(() => {
    if (phase.kind === 'moving' && options.length > 1) {
      // 進む方向を選ぶときは、今いる駅と選べる駅が見えるようにする
      return {
        key: `choose-${race.turns}-${phase.route.nodes.length}`,
        points: [current, ...options.map((o) => node(o.to))],
        maxZoom: 13,
      }
    }
    if (phase.kind === 'arrived') {
      return {
        key: `arrived-${race.turns}`,
        points: [node(race.goalStartedAt), goal],
      }
    }
    if (phase.kind === 'ready' && race.turns === 0) {
      return { key: `start-${race.goal}`, points: [current], maxZoom: 12 }
    }
    return undefined
  }, [phase, race.turns, race.goal, race.goalStartedAt, current, options, goal])

  const restart = (s: RaceSettings = settings) => {
    setRace(startRace(board, s))
  }

  const hint = race.hintShown
    ? {
        direction: direction8(current, goal),
        km: distanceMeters(current, goal) / 1000,
      }
    : undefined

  const move =
    phase.kind === 'moving'
      ? { from: phase.from, route: phase.route }
      : race.lastMove

  return (
    <div className="app">
      <MapView
        board={board}
        lineColors={PROTOTYPE_LINE_COLORS}
        current={race.position}
        known={known}
        candidates={choosing ? options.map((o) => o.to) : []}
        onChoose={(id) => {
          if (choosing && options.some((o) => o.to === id)) goStep(id)
        }}
        goal={
          debug.showGoal || phase.kind === 'arrived' ? race.goal : undefined
        }
        lastMove={move}
        follow={race.position}
        focus={focus}
      />

      <header className="topbar">
        <div className="topbar__title">
          <span className="badge">
            {Math.min(race.reachedGoals.length + 1, settings.goals)}/
            {settings.goals}
          </span>
          🎯 <b>{goal.name}</b> へ行こう！
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
          debug={debug}
          knownCount={known.size}
          onChange={(s) => {
            setSettings(s)
            restart(s)
          }}
          onDebugChange={setDebug}
          onResetKnown={() => {
            clearKnown()
            setKnown(new Set())
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <section className="panel">
        <div className="panel__status">
          <span>
            いま：<b>{current.name}</b>
          </span>
          <span>{race.turns}ターン</span>
          <span>
            覚えた駅 {known.size}/{board.nodes.size}
          </span>
        </div>

        {hint && (
          <p className="hint">
            💡 {goal.name}は、ここから<b>{hint.direction}</b>に約
            {hint.km.toFixed(1)}km
          </p>
        )}

        {phase.kind === 'ready' &&
          (rollingFace !== null ? (
            <p className="panel__message panel__message--center">
              <span className="dice dice--big dice--rolling">
                {rollingFace}
              </span>
            </p>
          ) : (
            <div className="actions">
              <button className="primary" onClick={onRoll}>
                🎲 サイコロをふる
              </button>
              {!race.hintShown && (
                <button onClick={() => setRace(showHint)}>💡 ヒント</button>
              )}
            </div>
          ))}

        {phase.kind === 'moving' && (
          <>
            <p className="panel__message panel__message--center">
              <span className="dice dice--big">{phase.dice}</span>
              のこり <b className="remaining">{phase.remaining}</b> 駅
            </p>
            {choosing ? (
              <>
                <p className="panel__message">どっちに進む？</p>
                <div className="choices">
                  {options.map((o) => (
                    <button key={o.to} onClick={() => goStep(o.to)}>
                      {node(o.to).name}
                      <small className="choices__line">
                        {o.lineIds.map((id) => lineName.get(id)).join('・')}
                      </small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="panel__message panel__message--center">
                {node(options[0]?.to ?? race.position).name} へ…
              </p>
            )}
          </>
        )}

        {phase.kind === 'arrived' && (
          <>
            <p className="panel__message">
              🎉 <b>{goal.name}</b>に到着！（{phase.turnsForGoal}ターン）
              <br />
              {goal.name}を通る路線：
              {goal.lineIds.map((id) => lineName.get(id)).join('・')}
              <br />
              最短なら{node(race.goalStartedAt).name}から
              {phase.shortest.nodes.length}駅（
              {describeLines(phase.shortest.lineIds)}）
            </p>
            <button
              className="primary"
              onClick={() => setRace((r) => nextGoal(r, board, settings))}
            >
              {race.reachedGoals.length >= settings.goals
                ? '結果を見る'
                : '次の目的地へ'}
            </button>
          </>
        )}

        {phase.kind === 'finished' && (
          <>
            <p className="panel__message">
              🏁 {settings.goals}か所を<b>{race.turns}ターン</b>で回った！
              （ヒント {race.hintsUsed}回）
            </p>
            <button className="primary" onClick={() => restart()}>
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
  debug,
  knownCount,
  onChange,
  onDebugChange,
  onResetKnown,
  onClose,
}: {
  settings: RaceSettings
  debug: DebugSettings
  knownCount: number
  onChange: (s: RaceSettings) => void
  onDebugChange: (d: DebugSettings) => void
  onResetKnown: () => void
  onClose: () => void
}) {
  return (
    <div className="settings">
      <h2>試作の設定</h2>
      <p className="settings__note">変えると、最初からやり直しになります</p>
      <label>
        回る目的地の数：{settings.goals}か所
        <input
          type="range"
          min={1}
          max={10}
          value={settings.goals}
          onChange={(e) =>
            onChange({ ...settings, goals: Number(e.target.value) })
          }
        />
      </label>
      <label className="settings__check">
        <input
          type="checkbox"
          checked={debug.showGoal}
          onChange={(e) =>
            onDebugChange({ ...debug, showGoal: e.target.checked })
          }
        />
        目的地の位置を地図に出す（確認用）
      </label>
      <button onClick={onResetKnown}>
        覚えた駅（{knownCount}駅）をリセット
      </button>
      <button onClick={onClose}>閉じる</button>
    </div>
  )
}
