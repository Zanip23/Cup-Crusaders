import { Rng } from '@/core/rng/Rng';
import type { BoardDef } from '@/types/content';

export interface BoardPlayabilityReport {
  ballsTested: number;
  collectedRatio: number;
  lostRatio: number;
  medianPayoutMultiplier: number;
  maxPayoutMultiplier: number;
  stuckCount: number;
  passed: boolean;
  reasons: string[];
}

interface RectObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CircleObstacle {
  x: number;
  y: number;
  radius: number;
}

const BALLS_TESTED = 64;
const EDGE_PADDING = 24;
const CUP_Y = 180;
const BALL_RADIUS = 9;
const MIN_COLLECTED_RATIO = 0.55;
const MIN_REACHABLE_BIN_RATIO = 0.4;
const MAX_STUCK_RATIO = 0.45;
const BIN_ENTRY_Y_OFFSET = 95;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toRectObstacle(obstacle: { x: number; y: number; w: number; h: number }): RectObstacle {
  return { x: obstacle.x, y: obstacle.y, w: obstacle.w, h: obstacle.h };
}

function collectRectObstacles(board: BoardDef): RectObstacle[] {
  return (board.ramps ?? [])
    .map(toRectObstacle)
    .concat((board.platforms ?? []).map(toRectObstacle))
    .concat((board.gates ?? []).map(toRectObstacle))
    .concat((board.boosters ?? []).map(toRectObstacle))
    .concat((board.blockers ?? []).map(toRectObstacle));
}

function collectCircleObstacles(board: BoardDef): CircleObstacle[] {
  return board.pegs
    .map((peg) => ({ x: peg.x, y: peg.y, radius: peg.radius }))
    .concat(
      (board.bumpers ?? []).map((bumper) => ({ x: bumper.x, y: bumper.y, radius: bumper.radius })),
    );
}

function verticalLineIntersectsRect(
  x: number,
  yMin: number,
  yMax: number,
  rect: RectObstacle,
): boolean {
  const inflatedHalfWidth = rect.w / 2 + BALL_RADIUS;
  const inflatedHalfHeight = rect.h / 2 + BALL_RADIUS;
  return (
    x >= rect.x - inflatedHalfWidth &&
    x <= rect.x + inflatedHalfWidth &&
    yMax >= rect.y - inflatedHalfHeight &&
    yMin <= rect.y + inflatedHalfHeight
  );
}

function verticalLineIntersectsCircle(
  x: number,
  yMin: number,
  yMax: number,
  circle: CircleObstacle,
): boolean {
  const inflatedRadius = circle.radius + BALL_RADIUS * 0.35;
  return (
    Math.abs(x - circle.x) <= inflatedRadius &&
    yMax >= circle.y - inflatedRadius &&
    yMin <= circle.y + inflatedRadius
  );
}

function hasVerticalCorridor(
  x: number,
  yMin: number,
  yMax: number,
  rectObstacles: RectObstacle[],
  circleObstacles: CircleObstacle[],
): boolean {
  return (
    !rectObstacles.some((obstacle) => verticalLineIntersectsRect(x, yMin, yMax, obstacle)) &&
    !circleObstacles.some((obstacle) => verticalLineIntersectsCircle(x, yMin, yMax, obstacle))
  );
}

function multiplierForX(board: BoardDef, x: number): number | undefined {
  return board.bins.find((bin) => x >= bin.x && x <= bin.x + bin.w)?.multiplier;
}

function estimateReachableBinIndexes(
  board: BoardDef,
  rectObstacles: RectObstacle[],
  circleObstacles: CircleObstacle[],
): Set<number> {
  const reachable = new Set<number>();
  const startY = CUP_Y + 40;
  const endY = board.height - BIN_ENTRY_Y_OFFSET;

  board.bins.forEach((bin, index) => {
    const sampleCount = 5;
    for (let sample = 0; sample < sampleCount; sample++) {
      const ratio = sample / (sampleCount - 1);
      const x = clamp(bin.x + bin.w * ratio, EDGE_PADDING, board.width - EDGE_PADDING);
      if (hasVerticalCorridor(x, startY, endY, rectObstacles, circleObstacles)) {
        reachable.add(index);
        break;
      }
    }
  });

  return reachable;
}

/**
 * Bewertet ein Board über eine bewusst einfache, deterministische Heuristik.
 *
 * Diese erste Version nutzt statische Korridor-Prüfungen statt Matter.js: Sie
 * sucht vertikale freie Räume von der Cup-Zone bis zu den Bins, schätzt darüber
 * erreichbare Bins und leitet daraus eine grobe Auszahlungs-Verteilung ab.
 */
export function evaluateBoardPlayability(board: BoardDef, seed: number): BoardPlayabilityReport {
  const rng = new Rng(seed);
  const rectObstacles = collectRectObstacles(board);
  const circleObstacles = collectCircleObstacles(board);
  const reachableBinIndexes = estimateReachableBinIndexes(board, rectObstacles, circleObstacles);
  const payouts: number[] = [];
  let collected = 0;

  for (let i = 0; i < BALLS_TESTED; i++) {
    const launchJitter = (rng.next() - 0.5) * board.width * 0.36;
    const x = clamp(board.width / 2 + launchJitter, EDGE_PADDING, board.width - EDGE_PADDING);
    const reachesBottom = hasVerticalCorridor(
      x,
      CUP_Y + 40,
      board.height - BIN_ENTRY_Y_OFFSET,
      rectObstacles,
      circleObstacles,
    );
    const multiplier = multiplierForX(board, x);

    if (reachesBottom && multiplier !== undefined) {
      collected += 1;
      payouts.push(multiplier);
    }
  }

  const collectedRatio = collected / BALLS_TESTED;
  const lostRatio = 1 - collectedRatio;
  const stuckCount = BALLS_TESTED - collected;
  const reachableBinRatio =
    board.bins.length === 0 ? 0 : reachableBinIndexes.size / board.bins.length;
  const reasons: string[] = [];

  if (board.bins.length === 0) reasons.push('Board hat keine Sammel-Bins.');
  if (reachableBinRatio < MIN_REACHABLE_BIN_RATIO) {
    reasons.push(
      `Zu wenige Bins statisch erreichbar (${reachableBinIndexes.size}/${board.bins.length}).`,
    );
  }
  if (collectedRatio < MIN_COLLECTED_RATIO) {
    reasons.push(`Geschätzte Sammelquote zu niedrig (${Math.round(collectedRatio * 100)}%).`);
  }
  if (stuckCount / BALLS_TESTED > MAX_STUCK_RATIO) {
    reasons.push(
      `Zu viele Testbälle bleiben wahrscheinlich stecken (${stuckCount}/${BALLS_TESTED}).`,
    );
  }

  return {
    ballsTested: BALLS_TESTED,
    collectedRatio,
    lostRatio,
    medianPayoutMultiplier: median(payouts),
    maxPayoutMultiplier: payouts.length === 0 ? 0 : Math.max(...payouts),
    stuckCount,
    passed: reasons.length === 0,
    reasons,
  };
}
