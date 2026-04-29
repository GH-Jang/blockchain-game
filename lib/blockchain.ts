// PDF 규칙: hash = nonce + a + b + c - (앞 블록 해시의 뒤 두 자리)
// a, b, c = 첫 글자 ASCII 값 (A=65, ..., Z=90)
// 정답 nonce: 해시가 3의 배수 (1, 2, 3 중 하나)

export type Block = {
  blockNumber: number;
  course: string;
  studentId: string;
  grade: string;
  hash: number;
  validNonce: number;
  prevHashLast2: number;
  a: number;
  b: number;
  c: number;
  startedAt: number;
  status: 'mining' | 'done';
  winnerSubmitId?: string;
};

export type Submission = {
  id: string;
  blockNumber: number;
  studentNumber: string;
  studentName: string;
  nonce: number;
  submittedHash: number;
  computedHash: number;
  isValid: boolean;
  submittedAt: number;
  rank?: number;
};

export function letterValue(s: string): number {
  if (!s || s.length === 0) return 0;
  return s.trim().charAt(0).toUpperCase().charCodeAt(0);
}

export function computeHash(
  course: string,
  studentId: string,
  grade: string,
  nonce: number,
  prevHash: number
): { hash: number; a: number; b: number; c: number; prevHashLast2: number } {
  const a = letterValue(course);
  const b = letterValue(studentId);
  const c = letterValue(grade);
  const prevHashLast2 = prevHash % 100;
  const hash = nonce + a + b + c - prevHashLast2;
  return { hash, a, b, c, prevHashLast2 };
}

export function findValidNonce(
  course: string,
  studentId: string,
  grade: string,
  prevHash: number
): { nonce: number; hash: number } | null {
  for (const n of [1, 2, 3]) {
    const { hash } = computeHash(course, studentId, grade, n, prevHash);
    if (hash % 3 === 0) return { nonce: n, hash };
  }
  return null;
}
