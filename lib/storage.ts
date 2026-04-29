import { Redis } from '@upstash/redis';
import type { Block, Submission } from './blockchain';

// =============================================
// Upstash Redis 클라이언트
// =============================================
// Vercel-Upstash 통합이 주입할 수 있는 모든 환경변수 이름 시도

let cachedClient: Redis | null = null;

function getRedis(): Redis {
  if (cachedClient) return cachedClient;

  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_URL;

  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_TOKEN;

  if (!url || !token) {
    const availableVars = Object.keys(process.env)
      .filter(
        (k) => k.includes('KV') || k.includes('UPSTASH') || k.includes('REDIS')
      )
      .sort();
    const debug =
      availableVars.length > 0
        ? `현재 발견된 변수: ${availableVars.join(', ')}`
        : '관련 환경변수가 전혀 없습니다.';
    throw new Error(
      `Upstash Redis 연결 실패. URL=${url ? 'OK' : 'MISSING'}, TOKEN=${token ? 'OK' : 'MISSING'}. ${debug}`
    );
  }

  cachedClient = new Redis({ url, token });
  return cachedClient;
}

// =============================================
// 키 구조 (단일 실습)
// =============================================
// state              → { currentBlockNumber, sessionStartedAt }
// blocks             → number[] (블록 번호 목록)
// block:{n}          → Block
// submissions:{n}    → Submission[]
// scores             → Record<key, ScoreEntry>

const STATE_KEY = 'state';
const BLOCKS_LIST_KEY = 'blocks';
const SCORES_KEY = 'scores';

export type GameState = {
  currentBlockNumber: number | null;
  sessionStartedAt: number;
};

export type ScoreEntry = {
  studentNumber: string;
  studentName: string;
  totalScore: number;
  wins: number;
};

// =============================================
// 게임 상태
// =============================================

export async function getGameState(): Promise<GameState> {
  const r = getRedis();
  const state = await r.get<GameState>(STATE_KEY);
  if (!state) {
    const initial: GameState = {
      currentBlockNumber: null,
      sessionStartedAt: Date.now(),
    };
    await r.set(STATE_KEY, initial);
    return initial;
  }
  return state;
}

export async function setGameState(state: GameState): Promise<void> {
  const r = getRedis();
  await r.set(STATE_KEY, state);
}

// =============================================
// 블록
// =============================================

export async function getBlock(n: number): Promise<Block | null> {
  const r = getRedis();
  return await r.get<Block>(`block:${n}`);
}

export async function setBlock(block: Block): Promise<void> {
  const r = getRedis();
  await r.set(`block:${block.blockNumber}`, block);
  const list = (await r.get<number[]>(BLOCKS_LIST_KEY)) || [];
  if (!list.includes(block.blockNumber)) {
    list.push(block.blockNumber);
    list.sort((a, b) => a - b);
    await r.set(BLOCKS_LIST_KEY, list);
  }
}

export async function getAllBlocks(): Promise<Block[]> {
  const r = getRedis();
  const list = (await r.get<number[]>(BLOCKS_LIST_KEY)) || [];
  if (list.length === 0) return [];
  const blocks = await Promise.all(list.map((n) => r.get<Block>(`block:${n}`)));
  return blocks
    .filter((b): b is Block => b !== null)
    .sort((a, b) => a.blockNumber - b.blockNumber);
}

// =============================================
// 제출
// =============================================

export async function getSubmissions(blockNumber: number): Promise<Submission[]> {
  const r = getRedis();
  const subs = (await r.get<Submission[]>(`submissions:${blockNumber}`)) || [];
  return subs.sort((a, b) => a.submittedAt - b.submittedAt);
}

export async function addSubmission(
  blockNumber: number,
  sub: Submission
): Promise<void> {
  const r = getRedis();
  const subs = (await r.get<Submission[]>(`submissions:${blockNumber}`)) || [];
  subs.push(sub);
  await r.set(`submissions:${blockNumber}`, subs);
}

// =============================================
// 점수 (1등 독식)
// =============================================

function scoreKey(num: string, name: string): string {
  return `${num}|${name}`;
}

export async function getScores(): Promise<ScoreEntry[]> {
  const r = getRedis();
  const map = (await r.get<Record<string, ScoreEntry>>(SCORES_KEY)) || {};
  return Object.values(map).sort((a, b) => b.totalScore - a.totalScore);
}

export async function addWin(
  studentNumber: string,
  studentName: string
): Promise<ScoreEntry> {
  const r = getRedis();
  const map = (await r.get<Record<string, ScoreEntry>>(SCORES_KEY)) || {};
  const key = scoreKey(studentNumber, studentName);
  if (map[key]) {
    map[key].totalScore += 1;
    map[key].wins += 1;
  } else {
    map[key] = {
      studentNumber,
      studentName,
      totalScore: 1,
      wins: 1,
    };
  }
  await r.set(SCORES_KEY, map);
  return map[key];
}

// =============================================
// 제네시스 블록 (PDF Block 0)
// =============================================

export async function ensureGenesis(): Promise<Block> {
  const existing = await getBlock(0);
  if (existing) return existing;
  const genesis: Block = {
    blockNumber: 0,
    course: 'Digital Finance',
    studentId: 'Jang',
    grade: 'P',
    hash: 212,
    validNonce: 1,
    prevHashLast2: 0,
    a: 68,
    b: 74,
    c: 80,
    startedAt: Date.now(),
    status: 'done',
  };
  await setBlock(genesis);
  return genesis;
}

// =============================================
// 새 실습 시작 (전체 리셋)
// =============================================

export async function resetAll(): Promise<void> {
  const r = getRedis();
  const list = (await r.get<number[]>(BLOCKS_LIST_KEY)) || [];

  // 모든 블록과 제출 삭제
  const keysToDelete: string[] = [STATE_KEY, BLOCKS_LIST_KEY, SCORES_KEY];
  for (const n of list) {
    keysToDelete.push(`block:${n}`);
    keysToDelete.push(`submissions:${n}`);
  }
  if (keysToDelete.length > 0) {
    await Promise.all(keysToDelete.map((k) => r.del(k)));
  }

  // 새 상태 + 제네시스 블록
  await r.set(STATE_KEY, {
    currentBlockNumber: null,
    sessionStartedAt: Date.now(),
  });
  await ensureGenesis();
}
