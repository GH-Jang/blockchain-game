import { NextRequest, NextResponse } from 'next/server';
import {
  getGameState,
  getBlock,
  getSubmissions,
  addSubmission,
} from '@/lib/storage';
import { computeHash } from '@/lib/blockchain';
import type { Submission } from '@/lib/blockchain';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentNumber, studentName, nonce, submittedHash } = body as {
      studentNumber: string;
      studentName: string;
      nonce: number;
      submittedHash: number;
    };

    if (!studentNumber || !studentName) {
      return NextResponse.json({ error: '학번과 이름을 입력해주세요.' }, { status: 400 });
    }
    if (![1, 2, 3].includes(nonce)) {
      return NextResponse.json({ error: 'Nonce는 1, 2, 3 중 하나여야 합니다.' }, { status: 400 });
    }
    if (typeof submittedHash !== 'number' || isNaN(submittedHash) || submittedHash < 0) {
      return NextResponse.json({ error: '해시값을 올바르게 입력해주세요.' }, { status: 400 });
    }

    const state = await getGameState();
    if (state.currentBlockNumber === null) {
      return NextResponse.json({ error: '현재 진행 중인 블록이 없습니다.' }, { status: 400 });
    }

    const block = await getBlock(state.currentBlockNumber);
    if (!block || block.status !== 'mining') {
      return NextResponse.json({ error: '이 블록은 이미 채굴이 끝났습니다.' }, { status: 400 });
    }

    const existingSubs = await getSubmissions(state.currentBlockNumber);
    const myValid = existingSubs.find(
      (s) => s.studentNumber === studentNumber && s.isValid
    );
    if (myValid) {
      return NextResponse.json(
        { error: '이미 이 블록에 정답을 제출하셨습니다.' },
        { status: 400 }
      );
    }

    const prevBlock = await getBlock(state.currentBlockNumber - 1);
    const prevHash = prevBlock ? prevBlock.hash : 0;
    const { hash: computedHash } = computeHash(
      block.course,
      block.studentId,
      block.grade,
      nonce,
      prevHash
    );

    const nonceCorrect = computedHash % 3 === 0;
    const hashCorrect = submittedHash === computedHash;
    const isValid = nonceCorrect && hashCorrect;

    let rank: number | undefined;
    if (isValid) {
      const validCount = existingSubs.filter((s) => s.isValid).length;
      rank = validCount + 1;
    }

    let errorReason = '';
    if (!isValid) {
      if (!nonceCorrect && !hashCorrect) {
        errorReason = `nonce ${nonce}는 정답이 아니고, 입력한 해시값도 서버 계산값과 다릅니다.`;
      } else if (!nonceCorrect) {
        errorReason = `nonce ${nonce}로 계산한 해시(${computedHash})는 3의 배수가 아닙니다. 다른 nonce를 시도해보세요.`;
      } else if (!hashCorrect) {
        errorReason = `nonce ${nonce}는 정답입니다! 하지만 입력한 해시값(${submittedHash})이 다시 계산해보니 다릅니다. 다시 계산해보세요.`;
      }
    }

    const submission: Submission = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      blockNumber: state.currentBlockNumber,
      studentNumber,
      studentName,
      nonce,
      submittedHash,
      computedHash,
      isValid,
      submittedAt: Date.now(),
      rank,
    };

    await addSubmission(state.currentBlockNumber, submission);

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        isValid,
        submittedHash,
        computedHash,
        rank,
        submittedAt: submission.submittedAt,
        errorReason,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: e?.message || String(e) },
      { status: 500 }
    );
  }
}
