import { NextResponse } from 'next/server';
import {
  getGameState,
  getBlock,
  getSubmissions,
  getScores,
  getAllBlocks,
  ensureGenesis,
} from '@/lib/storage';

// 캐싱 완전 비활성화 - 매 요청마다 최신 데이터 가져옴
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    await ensureGenesis();
    const state = await getGameState();
    const scores = await getScores();
    const topPlayer = scores[0] || null;

    const allBlocks = await getAllBlocks();
    const completedBlocks = allBlocks
      .filter((b) => b.status === 'done')
      .map((b) => ({
        blockNumber: b.blockNumber,
        course: b.course,
        studentId: b.studentId,
        grade: b.grade,
        nonce: b.validNonce,
        a: b.a,
        b: b.b,
        c: b.c,
        prevHashLast2: b.prevHashLast2,
        hash: b.hash,
      }));

    let activeBlock = null;
    let submissions: any[] = [];

    if (state.currentBlockNumber !== null) {
      const block = await getBlock(state.currentBlockNumber);
      if (block && block.status === 'mining') {
        activeBlock = {
          blockNumber: block.blockNumber,
          course: block.course,
          studentId: block.studentId,
          grade: block.grade,
          prevHashLast2: block.prevHashLast2,
          startedAt: block.startedAt,
          status: block.status,
        };
        const subs = await getSubmissions(state.currentBlockNumber);
        submissions = subs.map((s) => ({
          id: s.id,
          studentName: s.studentName,
          studentNumber: maskStudentNumber(s.studentNumber),
          isValid: s.isValid,
          submittedAt: s.submittedAt,
          rank: s.rank,
        }));
      }
    }

    return NextResponse.json(
      {
        completedBlocks,
        activeBlock,
        submissions,
        sessionStartedAt: state.sessionStartedAt,
        topPlayer: topPlayer
          ? {
              studentName: topPlayer.studentName,
              studentNumber: maskStudentNumber(topPlayer.studentNumber),
              totalScore: topPlayer.totalScore,
            }
          : null,
        leaderboard: scores.slice(0, 5).map((s) => ({
          studentName: s.studentName,
          studentNumber: maskStudentNumber(s.studentNumber),
          totalScore: s.totalScore,
        })),
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

function maskStudentNumber(num: string): string {
  if (num.length <= 4) return num;
  return num.slice(0, 4) + '*'.repeat(Math.max(0, num.length - 4));
}
