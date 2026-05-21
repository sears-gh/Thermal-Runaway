import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardInstance, GamePhase, LogEntry, MetaState, Snapshot } from './game/types';
import type { SimState } from './game/types';
import { CARD_DEFS, makeCardInstance } from './game/cards';
import {
  calcAshReward,
  coolValue,
  createSimState,
  reignite,
  tick,
} from './game/simulation';
import { INITIAL_META, HEARTH_UPGRADES } from './game/meta';
import { getRandomDraftChoices } from './game/draft';
import {
  buildRunSave,
  loadAll,
  saveAll,
  wipeSave,
  type RunSave,
} from './game/persistence';
import { GRAPH_LEN, MAX_FRAME_ELAPSED, MAX_TICKS_PER_FRAME } from './game/constants';

import Header from './components/Header';
import Furnace from './components/Furnace';
import Graph from './components/Graph';
import RaceInfo from './components/RaceInfo';
import DraftPanel from './components/DraftPanel';
import Log from './components/Log';
import FlashoverScreen from './components/FlashoverScreen';
import ReorderPanel from './components/ReorderPanel';
import HearthModal from './components/HearthModal';

// Auto-save interval while running (measured in race-seconds to be
// speed-independent; roughly every 30 simulated seconds).
const AUTOSAVE_INTERVAL = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStartDeck(meta: MetaState): CardInstance[] {
  return ['kindling', 'kindling', 'furnace', 'bellows', 'draft', ...meta.startExtra].map(
    makeCardInstance,
  );
}

function simFromRunSave(run: RunSave): SimState {
  return {
    deck: run.deck,
    head: run.head,
    PH: run.PH,
    passiveOutput: run.passiveOutput,
    v: run.v,
    mult: run.mult,
    t: run.t,
    k_eff: run.k_eff,
    n_eff: run.n_eff,
    C0_eff: run.C0_eff,
    frozenTotal: run.frozenTotal,
    belowTimer: run.belowTimer,
    reignCount: run.reignCount,
    reignMult: run.reignMult,
    peakPH: run.peakPH,
    furnaceBoostCharges: run.furnaceBoostCharges,
    challengeFlags: new Set(run.challengeFlags),
    skipBonus: run.skipBonus,
    airCap: run.airCap,
  };
}

function snapFromSim(
  state: SimState,
  graphPH: number[],
  graphCool: number[],
  graphT: number[],
): Snapshot {
  return {
    PH: state.PH,
    cool: coolValue(state),
    passiveOutput: state.passiveOutput,
    v: state.v,
    t: state.t,
    mult: state.mult,
    k_eff: state.k_eff,
    n_eff: state.n_eff,
    belowTimer: state.belowTimer,
    head: state.head,
    deck: [...state.deck],
    reignCount: state.reignCount,
    reignMult: state.reignMult,
    graphPH: [...graphPH],
    graphCool: [...graphCool],
    graphT: [...graphT],
  };
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  // ── React state (drives re-renders) ──────────────────────────────────────
  const [phase, setPhaseState] = useState<GamePhase>('idle');
  const [meta, setMetaState] = useState<MetaState>(
    () => loadAll()?.meta ?? { ...INITIAL_META, purchasedUpgrades: new Set() },
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [draftChoices, setDraftChoices] = useState<string[]>([]);
  const [flashData, setFlashData] = useState<{ peakPH: number; ash: number } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showHearthModal, setShowHearthModal] = useState(false);

  // ── Mutable refs (game engine — no re-renders) ────────────────────────────
  const simRef = useRef<SimState | null>(null);
  const phaseRef = useRef<GamePhase>('idle');
  const metaRef = useRef<MetaState>(meta);
  const rafRef = useRef<number | null>(null);
  const accumRef = useRef(0);
  const lastTRef = useRef(0);
  const graphPHRef = useRef<number[]>(new Array(GRAPH_LEN).fill(0));
  const graphCoolRef = useRef<number[]>(new Array(GRAPH_LEN).fill(0));
  const graphTRef = useRef<number[]>(new Array(GRAPH_LEN).fill(0));
  const draftChoicesRef = useRef<string[]>([]);
  const lastSaveSimTRef = useRef(0); // last autosave in sim-seconds
  const logIdRef = useRef(0);

  // ── Latest-ref handlers (always-fresh, called from the stable rAF loop) ──
  const handlersRef = useRef({
    onFlash: (_peakPH: number, _ash: number) => {},
    onReign: () => {},
  });

  // Sync refs every render so handlers never see stale closures
  useEffect(() => { phaseRef.current = phase; });
  useEffect(() => { metaRef.current = meta; });

  // ── Save helper ───────────────────────────────────────────────────────────
  const doSave = useCallback(
    (run: ReturnType<typeof buildRunSave> | null) => {
      saveAll(metaRef.current, run);
      setSavedAt(new Date());
    },
    [],
  );

  // ── Handlers updated on every render ─────────────────────────────────────
  handlersRef.current = {
    onFlash(peakPH, ash) {
      const newMeta: MetaState = {
        ...metaRef.current,
        ash: metaRef.current.ash + ash,
        flashoverCount: metaRef.current.flashoverCount + 1,
      };
      metaRef.current = newMeta;
      // Clear run save; persist updated meta
      saveAll(newMeta, null);
      setSavedAt(new Date());
      setMetaState(newMeta);
      setFlashData({ peakPH, ash });
      addLog(`⚡ FLASHOVER! PH=${peakPH.toExponential(2)} Ash+${ash}`, 'flash');
      setPhase('flashover');
    },
    onReign() {
      const state = simRef.current!;
      addLog(`冷却に敗北… 再点火 #${state.reignCount + 1}`, 'important');
      reignite(state, metaRef.current);
      const choices = getRandomDraftChoices(metaRef.current);
      draftChoicesRef.current = choices;
      setDraftChoices(choices);
      // Save at reignition: we've already mutated state via reignite(),
      // so the saved snapshot reflects the reset fields + draft phase.
      const rs = buildRunSave(
        'draft',
        state,
        choices,
        graphPHRef.current,
        graphCoolRef.current,
        graphTRef.current,
      );
      doSave(rs);
      setPhase('draft');
    },
  };

  // ── Stable helpers ────────────────────────────────────────────────────────
  const setPhase = useCallback((p: GamePhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const addLog = useCallback((msg: string, kind: LogEntry['kind'] = 'normal') => {
    const entry: LogEntry = {
      id: logIdRef.current++,
      time: new Date().toLocaleTimeString(),
      msg,
      kind,
    };
    setLogs(prev => [entry, ...prev].slice(0, 60));
  }, []);

  const takeSnapshot = useCallback(() => {
    const state = simRef.current;
    if (!state) return;
    setSnap(snapFromSim(state, graphPHRef.current, graphCoolRef.current, graphTRef.current));
  }, []);

  // ── Stable rAF loop ───────────────────────────────────────────────────────
  const loop = useCallback(
    (timestamp: number) => {
      if (phaseRef.current !== 'running') return;
      const state = simRef.current;
      if (!state) return;

      const elapsed = Math.min((timestamp - lastTRef.current) / 1000, MAX_FRAME_ELAPSED);
      lastTRef.current = timestamp;
      accumRef.current += elapsed;

      let result: 'OK' | 'FLASH' | 'REIGN' = 'OK';
      let ticksDone = 0;

      while (result === 'OK' && ticksDone < MAX_TICKS_PER_FRAME) {
        const dt = 1 / state.v;
        if (accumRef.current < dt) break;
        accumRef.current -= dt;
        result = tick(state);
        ticksDone++;
      }

      graphPHRef.current.push(state.PH);
      graphCoolRef.current.push(coolValue(state));
      graphTRef.current.push(state.t);
      if (graphPHRef.current.length > GRAPH_LEN) graphPHRef.current.shift();
      if (graphCoolRef.current.length > GRAPH_LEN) graphCoolRef.current.shift();
      if (graphTRef.current.length > GRAPH_LEN) graphTRef.current.shift();

      takeSnapshot();

      if (result === 'FLASH') {
        const hasShackle = state.deck.some(c => c.defId === 'shackle');
        const ash = calcAshReward(state.peakPH, hasShackle, metaRef.current.ashBonus);
        handlersRef.current.onFlash(state.peakPH, ash);
        return;
      }
      if (result === 'REIGN') {
        handlersRef.current.onReign();
        return;
      }

      // Periodic autosave every AUTOSAVE_INTERVAL simulated seconds
      if (state.t - lastSaveSimTRef.current >= AUTOSAVE_INTERVAL) {
        lastSaveSimTRef.current = state.t;
        const rs = buildRunSave(
          'running',
          state,
          draftChoicesRef.current,
          graphPHRef.current,
          graphCoolRef.current,
          graphTRef.current,
        );
        doSave(rs);
      }

      rafRef.current = requestAnimationFrame(loop);
    },
    [takeSnapshot, doSave],
  );

  // Start/stop rAF when phase flips
  useEffect(() => {
    if (phase === 'running') {
      lastTRef.current = performance.now();
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [phase, loop]);

  // ── Restore saved state on first mount ───────────────────────────────────
  useEffect(() => {
    const saved = loadAll();
    if (!saved?.run) return;
    const run = saved.run;

    simRef.current = simFromRunSave(run);
    graphPHRef.current = [...run.graphPH];
    graphCoolRef.current = [...run.graphCool];
    graphTRef.current = [...run.graphT];
    draftChoicesRef.current = run.draftChoices;
    lastSaveSimTRef.current = run.t;

    if (run.phase === 'draft' || run.phase === 'refine') {
      setDraftChoices(run.draftChoices);
      setPhase(run.phase);
    } else {
      // running / paused → restore as paused so the user chooses to resume
      setPhase('paused');
    }

    setSnap(snapFromSim(simRef.current, graphPHRef.current, graphCoolRef.current, graphTRef.current));
    addLog(
      `セーブデータを復元しました（${new Date(run.savedAt).toLocaleTimeString()} 保存）`,
      'important',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only

  // ── Actions ───────────────────────────────────────────────────────────────

  const startRun = useCallback(() => {
    const m = metaRef.current;
    const deck = buildStartDeck(m);
    simRef.current = createSimState(deck, m);
    graphPHRef.current = new Array(GRAPH_LEN).fill(0);
    graphCoolRef.current = new Array(GRAPH_LEN).fill(0);
    graphTRef.current = new Array(GRAPH_LEN).fill(0);
    draftChoicesRef.current = [];
    accumRef.current = 0;
    lastSaveSimTRef.current = 0;
    addLog('Run 開始', 'important');
    setPhase('reorder');
  }, [addLog, setPhase]);

  const ignite = useCallback(() => {
    accumRef.current = 0;
    setPhase('running');
  }, [setPhase]);

  const handleReorder = useCallback((newDeck: CardInstance[]) => {
    if (simRef.current) {
      simRef.current.deck = newDeck;
    }
  }, []);

  const pauseResume = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'running') {
      const state = simRef.current;
      if (state) {
        const rs = buildRunSave(
          'paused',
          state,
          draftChoicesRef.current,
          graphPHRef.current,
          graphCoolRef.current,
          graphTRef.current,
        );
        doSave(rs);
      }
      setPhase('paused');
    } else if (p === 'paused') {
      accumRef.current = 0;
      setPhase('running');
    } else if (p === 'reorder') {
      // treat reorder like paused for save purposes
      const state = simRef.current;
      if (state) {
        const rs = buildRunSave(
          'paused',
          state,
          draftChoicesRef.current,
          graphPHRef.current,
          graphCoolRef.current,
          graphTRef.current,
        );
        doSave(rs);
      }
      setPhase('paused');
    }
  }, [setPhase, doSave]);

  const abortRun = useCallback(() => {
    simRef.current = null;
    graphPHRef.current = new Array(GRAPH_LEN).fill(0);
    graphCoolRef.current = new Array(GRAPH_LEN).fill(0);
    graphTRef.current = new Array(GRAPH_LEN).fill(0);
    setSnap(null);
    // Clear run save but keep meta
    doSave(null);
    addLog('Run 中断');
    setPhase('idle');
  }, [addLog, setPhase, doSave]);

  const pickDraftCard = useCallback(
    (defId: string) => {
      const state = simRef.current;
      if (!state) return;
      state.deck.push(makeCardInstance(defId));
      addLog(`ドラフト: ${CARD_DEFS[defId]?.name ?? defId} を追加`, 'important');
      addLog(`再点火 #${state.reignCount} — ×${state.reignMult.toFixed(2)}`, 'important');
      setPhase('reorder');
    },
    [addLog, setPhase],
  );

  const refineCard = useCallback(
    (instanceId: string) => {
      const state = simRef.current;
      if (!state) return;
      const idx = state.deck.findIndex(c => c.instanceId === instanceId);
      if (idx < 0) return;
      const [removed] = state.deck.splice(idx, 1);
      if (state.head >= state.deck.length) state.head = 0;
      addLog(`精錬: ${CARD_DEFS[removed.defId]?.name ?? removed.defId} を除去`, 'important');
      addLog(`再点火 #${state.reignCount} — ×${state.reignMult.toFixed(2)}`, 'important');
      setPhase('reorder');
    },
    [addLog, setPhase],
  );

  const skipDraft = useCallback(() => {
    const state = simRef.current;
    if (!state) return;
    state.skipBonus += 10;
    addLog('ドラフト スキップ（PH+10）');
    addLog(`再点火 #${state.reignCount} — ×${state.reignMult.toFixed(2)}`, 'important');
    setPhase('reorder');
  }, [addLog, setPhase]);

  const continueAfterFlashover = useCallback(() => {
    simRef.current = null;
    setSnap(null);
    setFlashData(null);
    addLog(`炉床へ。Flashover #${metaRef.current.flashoverCount}`, 'important');
    setPhase('idle');
  }, [addLog, setPhase]);

  const purchaseHearth = useCallback(
    (upgradeId: string) => {
      const upg = HEARTH_UPGRADES.find(u => u.id === upgradeId);
      if (!upg) return;
      setMetaState(prev => {
        if (prev.ash < upg.cost || prev.purchasedUpgrades.has(upgradeId)) return prev;
        const next: MetaState = {
          ...prev,
          ash: prev.ash - upg.cost,
          purchasedUpgrades: new Set(prev.purchasedUpgrades),
        };
        next.purchasedUpgrades.add(upgradeId);
        upg.effect(next);
        metaRef.current = next;
        saveAll(next, null); // no active run when in hearth
        setSavedAt(new Date());
        return next;
      });
      addLog(`炉床: ${upg.name} を購入`, 'important');
    },
    [addLog],
  );

  const hardReset = useCallback(() => {
    if (!confirm('全データをリセットしますか？この操作は元に戻せません。')) return;
    wipeSave();
    window.location.reload();
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const showDraft = phase === 'draft' || phase === 'refine';

  // Bottom card area slot
  let bottomSlot: React.ReactNode;
  if (phase === 'reorder') {
    bottomSlot = (
      <ReorderPanel
        initialDeck={simRef.current?.deck ?? []}
        reignCount={snap?.reignCount ?? 0}
        onReorder={handleReorder}
        onConfirm={ignite}
      />
    );
  } else if (phase === 'running' || phase === 'paused') {
    bottomSlot = <Furnace snap={snap} />;
  } else {
    bottomSlot = (
      <div className="card-area">
        <div className="card-area-idle">START RUN を押して点火せよ</div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header meta={meta} reignMult={snap?.reignMult ?? 1} savedAt={savedAt} />

      <div className="body">
        <div className="top-area">
          <div className="left-panel">
            <Graph
              graphPH={snap?.graphPH ?? []}
              graphCool={snap?.graphCool ?? []}
              graphT={snap?.graphT ?? []}
            />
            <RaceInfo snap={snap} phase={phase} />
            <div className="controls">
              <button className="primary" onClick={startRun} disabled={phase !== 'idle'}>
                ▶ START RUN
              </button>
              <button
                onClick={pauseResume}
                disabled={phase !== 'running' && phase !== 'paused' && phase !== 'reorder'}
              >
                {phase === 'paused' ? '▶ RESUME' : '⏸ PAUSE'}
              </button>
              <button onClick={abortRun} disabled={phase === 'idle' || phase === 'flashover'}>
                ↺ ABORT RUN
              </button>
              <button onClick={() => setShowHearthModal(true)}>
                🏠 炉床 ({meta.ash} Ash)
              </button>
              <button
                onClick={hardReset}
                style={{ marginTop: 8, fontSize: 10, color: 'var(--dim)', borderColor: 'transparent' }}
              >
                全データリセット
              </button>
            </div>
          </div>

          <div className="right-panel">
            {showDraft && (
              <DraftPanel
                choices={draftChoices}
                deck={simRef.current?.deck ?? []}
                phase={phase}
                onPick={pickDraftCard}
                onRefine={refineCard}
                onSkip={skipDraft}
                onShowRefine={() => setPhase('refine')}
                onCancelRefine={() => setPhase('draft')}
              />
            )}
            <Log entries={logs} />
          </div>
        </div>

        {bottomSlot}
      </div>

      {showHearthModal && (
        <HearthModal
          meta={meta}
          onPurchase={purchaseHearth}
          onClose={() => setShowHearthModal(false)}
        />
      )}

      {phase === 'flashover' && flashData && (
        <FlashoverScreen
          peakPH={flashData.peakPH}
          ash={flashData.ash}
          onContinue={continueAfterFlashover}
        />
      )}
    </div>
  );
}
