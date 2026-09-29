// 試作2：目的地レース（案A、#52）。
// 実データの盤面（#51）で、駅名だけの目的地へサイコロで向かう。

import { useCallback, useMemo, useState } from 'react'
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
import type { TransferRule } from './game/movement'
import {
  choose,
  defaultRaceSettings,
  nextGoal,
  roll,
  showHint,
  startRace,
  type RaceSettings,
  type RaceState,
} from './game/race'
import { direction8, distanceMeters } from './lib/geo'

const board = buildBoard(rail as RailData, BEGINNER_LINES)
const lineName = new Map(board.lines.map((l) => [l.id, shortLineName(l.name)]))
const node = (id: NodeId) => board.nodes.get(id)!

function rollDice(): number {
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

  const remember = useCallback((ids: NodeId[]) => {
    setKnown((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      saveKnown(next)
      return next
    })
  }, [])

  const { phase } = race
  const current = node(race.position)
  const goal = node(race.goal)
  const candidates = useMemo(
    () => (phase.kind === 'choosing' ? [...phase.options.keys()] : []),
    [phase],
  )

  const focus = useMemo<MapFocus | undefined>(() => {
    if (phase.kind === 'choosing') {
      return {
        key: `choosing-${race.turns}`,
        points: [current, ...candidates.map(node)],
      }
    }
    if (phase.kind === 'arrived') {
      return {
        key: `arrived-${race.turns}`,
        points: [node(race.goalStartedAt), goal],
      }
    }
    if (phase.kind === 'ready') {
      // 自分の番になったら、今いる駅と、直前に進んだ道順が見えるようにする
      const moved = race.lastMove
        ? [race.lastMove.from, ...race.lastMove.route.nodes].map(node)
        : []
      return {
        key: `ready-${race.turns}-${race.goal}`,
        points: [current, ...moved],
        maxZoom: 12,
      }
    }
    return undefined
  }, [
    phase,
    race.turns,
    race.goal,
    race.goalStartedAt,
    race.lastMove,
    current,
    candidates,
    goal,
  ])

  const onRoll = () => {
    remember([race.position])
    setRace((r) => roll(r, board, settings, rollDice()))
  }

  const onChoose = useCallback(
    (id: NodeId) => {
      if (race.phase.kind !== 'choosing') return
      const route = race.phase.options.get(id)
      if (!route) return
      remember(route.nodes)
      setRace(choose(race, board, id))
    },
    [race, remember],
  )

  const restart = (s: RaceSettings = settings) => {
    setRace(startRace(board, s))
  }

  const hint = race.hintShown
    ? {
        direction: direction8(current, goal),
        km: distanceMeters(current, goal) / 1000,
      }
    : undefined

  return (
    <div className="app">
      <MapView
        board={board}
        lineColors={PROTOTYPE_LINE_COLORS}
        current={race.position}
        known={known}
        candidates={candidates}
        onChoose={onChoose}
        goal={
          debug.showGoal || phase.kind === 'arrived' ? race.goal : undefined
        }
        lastMove={phase.kind !== 'choosing' ? race.lastMove : undefined}
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

        {phase.kind === 'ready' && (
          <div className="actions">
            <button className="primary" onClick={onRoll}>
              🎲 サイコロをふる
            </button>
            {!race.hintShown && (
              <button onClick={() => setRace(showHint)}>💡 ヒント</button>
            )}
          </div>
        )}

        {phase.kind === 'choosing' && (
          <>
            <p className="panel__message">
              <span className="dice">{phase.dice}</span>
              {candidates.length > 0
                ? 'ピンクの駅から、行き先を選んでね'
                : '進める駅がない…'}
            </p>
            <div className="choices">
              {candidates
                .map(node)
                .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
                .map((n) => (
                  <button key={n.id} onClick={() => onChoose(n.id)}>
                    {n.name}
                    <small className="choices__line">
                      {describeLines(phase.options.get(n.id)!.lineIds)}
                    </small>
                  </button>
                ))}
              {candidates.length === 0 && (
                <button
                  onClick={() =>
                    setRace((r) => ({ ...r, phase: { kind: 'ready' } }))
                  }
                >
                  このターンは休む
                </button>
              )}
            </div>
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
  const rules: { value: TransferRule; label: string }[] = [
    { value: 'anywhere', label: '通過中も乗り換えられる' },
    { value: 'onlyWhenStopped', label: '止まった駅でだけ乗り換えられる' },
  ]
  return (
    <div className="settings">
      <h2>試作の設定</h2>
      <p className="settings__note">変えると、最初からやり直しになります</p>
      <fieldset>
        <legend>乗換のルール</legend>
        {rules.map((r) => (
          <label key={r.value}>
            <input
              type="radio"
              name="rule"
              checked={settings.rule === r.value}
              onChange={() => onChange({ ...settings, rule: r.value })}
            />
            {r.label}
          </label>
        ))}
      </fieldset>
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
