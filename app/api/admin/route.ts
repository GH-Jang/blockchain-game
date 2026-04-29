import { NextRequest, NextResponse } from 'next/server';
import {
  getGameState,
  setGameState,
  getBlock,
  setBlock,
  getSubmissions,
  getAllBlocks,
  getScores,
  addWin,
  ensureGenesis,
  resetAll,
} from '@/lib/storage';
import { computeHash, findValidNonce } from '@/lib/blockchain';
import type { Block } from '@/lib/blockchain';
import { SEED_BLOCKS } from '@/lib/seed';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function checkAuth(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-password');
  const expected = process.env.ADMIN_PASSWORD || 'changeme';
  return auth === expected;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureGenesis();
    const state = await getGameState();
    const blocks = await getAllBlocks();
    const scores = await getScores();

    const blocksWithSubs = await Promise.all(
      blocks.map(async (b) => {
        const subs = await getSubmissions(b.blockNumber);
        return { block: b, submissions: subs };
      })
    );

    const nextBlockNumber =
      blocks.length === 0 ? 1 : Math.max(...blocks.map((b) => b.blockNumber)) + 1;
    const seedIndex = nextBlockNumber - 1;
    const nextSeed =
      seedIndex >= 0 && seedIndex < SEED_BLOCKS.length ? SEED_BLOCKS[seedIndex] : null;

    return NextResponse.json(
      {
        state,
        blocks: blocksWithSubs,
        scores,
        nextBlockNumber,
        nextSeed,
        seedTotal: SEED_BLOCKS.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error: 'SERVER_ERROR',
        message: e?.message || String(e),
        hint: 'Upstash 환경변수 설정을 확인해주세요.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body as { action: string };

    if (action === 'start_block') return await startBlock(body);
    if (action === 'end_block') return await endBlock();
    if (action === 'reset') {
      await resetAll();
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: e?.message || String(e) },
      { status: 500 }
    );
  }
}

async function startBlock(body: any) {
  const { course, studentId, grade } = body as {
    course: string;
    studentId: string;
    grade: string;
  };

  if (!course || !studentId || !grade) {
    return NextResponse.json(
      { error: '코스명, 학생 ID, 성적을 모두 입력해주세요.' },
      { status: 400 }
    );
  }

  await ensureGenesis();
  const state = await getGameState();

  if (state.currentBlockNumber !== null) {
    const current = await getBlock(state.currentBlockNumber);
    if (current && current.status === 'mining') {
      return NextResponse.json(
        { error: `블록 ${state.currentBlockNumber}이 아직 진행 중입니다.` },
        { status: 400 }
      );
    }
  }

  const allBlocks = await getAllBlocks();
  const nextBlockNumber =
    allBlocks.length === 0 ? 1 : Math.max(...allBlocks.map((b) => b.blockNumber)) + 1;

  const prevBlock = await getBlock(nextBlockNumber - 1);
  const prevHash = prevBlock ? prevBlock.hash : 0;

  const valid = findValidNonce(course, studentId, grade, prevHash);
  if (!valid) {
    return NextResponse.json(
      {
        error:
          'nonce 1, 2, 3 중 어느 것도 해시를 3의 배수로 만들 수 없습니다. 다른 조합을 사용하세요.',
      },
      { status: 400 }
    );
  }

  const { a, b, c, prevHashLast2 } = computeHash(
    course,
    studentId,
    grade,
    valid.nonce,
    prevHash
  );

  const block: Block = {
    blockNumber: nextBlockNumber,
    course,
    studentId,
    grade,
    hash: valid.hash,
    validNonce: valid.nonce,
    prevHashLast2,
    a,
    b,
    c,
    startedAt: Date.now(),
    status: 'mining',
  };

  await setBlock(block);
  await setGameState({ ...state, currentBlockNumber: nextBlockNumber });

  return NextResponse.json({ success: true, block });
}

async function endBlock() {
  const state = await getGameState();
  if (state.currentBlockNumber === null) {
    return NextResponse.json({ error: '진행 중인 블록 없음' }, { status: 400 });
  }

  const block = await getBlock(state.currentBlockNumber);
  if (!block) {
    return NextResponse.json({ error: '블록 없음' }, { status: 400 });
  }

  const subs = await getSubmissions(state.currentBlockNumber);
  const winner = subs
    .filter((s) => s.isValid)
    .sort((a, b) => a.submittedAt - b.submittedAt)[0];

  block.status = 'done';
  if (winner) {
    block.winnerSubmitId = winner.id;
    await addWin(winner.studentNumber, winner.studentName);
  }
  await setBlock(block);
  await setGameState({ ...state, currentBlockNumber: null });

  return NextResponse.json({ success: true, block, winner });
}
