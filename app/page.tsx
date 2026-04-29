'use client';

import { useEffect, useState, useCallback } from 'react';
import { styles, fmtTime } from '@/lib/styles';

type ActiveBlock = {
  blockNumber: number;
  course: string;
  studentId: string;
  grade: string;
  prevHashLast2: number;
  startedAt: number;
  status: string;
};

type CompletedBlock = {
  blockNumber: number;
  course: string;
  studentId: string;
  grade: string;
  nonce: number;
  a: number;
  b: number;
  c: number;
  prevHashLast2: number;
  hash: number;
};

type PublicSubmission = {
  id: string;
  studentName: string;
  studentNumber: string;
  isValid: boolean;
  submittedAt: number;
  rank?: number;
};

type LeaderboardEntry = {
  studentName: string;
  studentNumber: string;
  totalScore: number;
};

type StateData = {
  completedBlocks: CompletedBlock[];
  activeBlock: ActiveBlock | null;
  submissions: PublicSubmission[];
  sessionStartedAt: number;
  topPlayer: LeaderboardEntry | null;
  leaderboard: LeaderboardEntry[];
};

export default function StudentPage() {
  const [studentNumber, setStudentNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [data, setData] = useState<StateData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedNonce, setSelectedNonce] = useState<number | null>(null);
  const [hashInput, setHashInput] = useState<string>('');
  const [submitResult, setSubmitResult] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [currentBlockId, setCurrentBlockId] = useState<number | null>(null);
  const [knownSessionStart, setKnownSessionStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('student_info');
    if (saved) {
      try {
        const { studentNumber: sn, studentName: name } = JSON.parse(saved);
        if (sn && name) {
          setStudentNumber(sn);
          setStudentName(name);
          setLoggedIn(true);
        }
      } catch {}
    }
  }, []);

  const fetchState = useCallback(async () => {
    try {
      // cache: 'no-store'로 브라우저 캐시 무시
      const res = await fetch('/api/state', { cache: 'no-store' });
      const raw = await res.json();

      if (!res.ok || raw.error) {
        const msg = raw.message || raw.error || `HTTP ${res.status}`;
        setFetchError(`${msg}\n\n${raw.hint || ''}`);
        return;
      }

      setFetchError(null);
      const d: StateData = raw;
      setData(d);

      // 새 실습 감지
      if (knownSessionStart !== null && d.sessionStartedAt !== knownSessionStart) {
        setHasSubmitted(false);
        setSelectedNonce(null);
        setHashInput('');
        setSubmitResult('');
        setCurrentBlockId(null);
      }
      setKnownSessionStart(d.sessionStartedAt);

      if (d.activeBlock) {
        if (currentBlockId !== d.activeBlock.blockNumber) {
          setCurrentBlockId(d.activeBlock.blockNumber);
          setHasSubmitted(false);
          setSelectedNonce(null);
          setHashInput('');
          setSubmitResult('');
        }
        if (loggedIn && studentNumber) {
          const masked = maskStudentNumber(studentNumber);
          const mine = d.submissions.find(
            (s) =>
              s.studentName === studentName &&
              s.studentNumber === masked &&
              s.isValid
          );
          if (mine) setHasSubmitted(true);
        }
      }
    } catch (e: any) {
      setFetchError(`서버 통신 실패: ${e?.message || String(e)}`);
    }
  }, [currentBlockId, loggedIn, studentNumber, studentName, knownSessionStart]);

  useEffect(() => {
    if (!loggedIn) return;
    fetchState();
    const id = setInterval(fetchState, 2000);
    return () => clearInterval(id);
  }, [loggedIn, fetchState]);

  useEffect(() => {
    if (!data?.activeBlock) return;
    const update = () =>
      setElapsed(Math.floor((Date.now() - data.activeBlock!.startedAt) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [data?.activeBlock]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!studentNumber.trim() || !studentName.trim()) return;
    localStorage.setItem(
      'student_info',
      JSON.stringify({
        studentNumber: studentNumber.trim(),
        studentName: studentName.trim(),
      })
    );
    setLoggedIn(true);
  }

  function handleLogout() {
    localStorage.removeItem('student_info');
    setLoggedIn(false);
    setStudentNumber('');
    setStudentName('');
  }

  async function handleSubmit() {
    if (selectedNonce === null) {
      setSubmitResult('✗ 먼저 nonce를 선택하세요.');
      return;
    }
    const trimmed = hashInput.trim();
    if (!trimmed) {
      setSubmitResult('✗ 해시값을 입력하세요.');
      return;
    }
    const parsedHash = Number(trimmed);
    if (!Number.isInteger(parsedHash) || parsedHash < 0) {
      setSubmitResult('✗ 해시값은 0 이상의 정수여야 합니다.');
      return;
    }

    setSubmitting(true);
    setSubmitResult('');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentNumber,
          studentName,
          nonce: selectedNonce,
          submittedHash: parsedHash,
        }),
      });
      const d = await res.json();
      if (d.error) {
        setSubmitResult(`✗ ${d.error}`);
      } else if (d.submission?.isValid) {
        setSubmitResult(
          `✓ 정답! 해시 ${d.submission.computedHash}, nonce ${selectedNonce}. 도착 순위: ${d.submission.rank}등${d.submission.rank === 1 ? ' — 보상 후보 1위!' : ''}`
        );
        setHasSubmitted(true);
        fetchState();
      } else {
        setSubmitResult(`✗ ${d.submission?.errorReason || '오답입니다.'}`);
      }
    } catch {
      setSubmitResult('제출 중 오류가 발생했습니다.');
    }
    setSubmitting(false);
  }

  if (!loggedIn) {
    return (
      <div style={styles.page}>
        <div style={styles.loginCard}>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>블록체인 채굴 게임</h1>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
            학번과 이름을 입력하세요
          </p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              style={styles.input}
              placeholder="학번 (예: 20231234)"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              required
            />
            <input
              style={styles.input}
              placeholder="이름"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              required
            />
            <button type="submit" style={styles.primaryBtn}>
              시작하기
            </button>
          </form>
          <p style={{ fontSize: 12, color: '#999', marginTop: 24, textAlign: 'center' }}>
            관리자(교수)는 <a href="/admin" style={{ color: '#1976d2' }}>여기</a>로
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: 600, margin: '60px auto' }}>
          {fetchError ? (
            <div
              style={{
                background: '#ffebee',
                border: '1px solid #c62828',
                padding: 20,
                borderRadius: 8,
                color: '#c62828',
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                ⚠️ 서버 연결 오류
              </p>
              <pre
                style={{
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  margin: 0,
                  color: '#666',
                }}
              >
                {fetchError}
              </pre>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: '#999' }}>로딩 중...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.containerWide}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>블록체인 채굴 게임</h1>
            <p style={styles.subtitle}>
              {studentName} ({studentNumber})
            </p>
          </div>
          <button onClick={handleLogout} style={styles.secondaryBtn}>
            로그아웃
          </button>
        </header>

        <TopPlayerCard topPlayer={data.topPlayer} myName={studentName} />

        {!data.activeBlock ? (
          <>
            <div style={styles.waitingCard}>
              <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>대기 중</h2>
              <p style={{ color: '#666' }}>교수님이 다음 블록을 시작할 때까지 기다려주세요.</p>
            </div>
            {data.completedBlocks.length > 0 && (
              <BlockchainTable
                completedBlocks={data.completedBlocks}
                activeBlock={null}
                elapsed={0}
              />
            )}
          </>
        ) : (
          <>
            <BlockchainTable
              completedBlocks={data.completedBlocks}
              activeBlock={data.activeBlock}
              elapsed={elapsed}
            />
            <LookupTable />
            <SubmitCard
              selectedNonce={selectedNonce}
              setSelectedNonce={setSelectedNonce}
              hashInput={hashInput}
              setHashInput={setHashInput}
              onSubmit={handleSubmit}
              submitting={submitting}
              result={submitResult}
              hasSubmitted={hasSubmitted}
            />
            <RoundLeaderboard submissions={data.submissions} myName={studentName} />
          </>
        )}

        <CumulativeLeaderboard leaderboard={data.leaderboard} myName={studentName} />
      </div>
    </div>
  );
}

function TopPlayerCard({
  topPlayer,
  myName,
}: {
  topPlayer: { studentName: string; studentNumber: string; totalScore: number } | null;
  myName: string;
}) {
  if (!topPlayer) {
    return (
      <div style={{ ...styles.card, background: '#fafafa', borderColor: '#e0e0e0' }}>
        <p style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>
          아직 채굴에 성공한 학생이 없습니다. 첫 번째 우승자가 되어보세요!
        </p>
      </div>
    );
  }
  const isMe = topPlayer.studentName === myName;
  return (
    <div
      style={{
        ...styles.card,
        background: isMe ? '#e8f5e9' : '#fff8e1',
        borderColor: isMe ? '#4caf50' : '#ffc107',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>🏆 현재 1위 (누적)</p>
          <p style={{ fontSize: 18, fontWeight: 500 }}>
            {topPlayer.studentName} ({topPlayer.studentNumber})
            {isMe && ' ← 나'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>채굴 성공</p>
          <p style={{ fontSize: 24, fontWeight: 500, color: '#f57f17' }}>
            {topPlayer.totalScore}회
          </p>
        </div>
      </div>
    </div>
  );
}

function BlockchainTable({
  completedBlocks,
  activeBlock,
  elapsed,
}: {
  completedBlocks: CompletedBlock[];
  activeBlock: ActiveBlock | null;
  elapsed: number;
}) {
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');

  const rows: Array<
    | { type: 'completed'; data: CompletedBlock }
    | { type: 'active'; data: ActiveBlock }
  > = [];
  for (const b of completedBlocks) rows.push({ type: 'completed', data: b });
  if (activeBlock) rows.push({ type: 'active', data: activeBlock });

  return (
    <div style={styles.card}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 500 }}>
          Grade BlockChain {activeBlock && `· Block #${activeBlock.blockNumber} 채굴 중`}
        </p>
        {activeBlock && (
          <p style={{ fontSize: 13, color: '#666', fontFamily: 'monospace' }}>
            ⏱ {m}:{s}
          </p>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.thBlock}>Block</th>
              <th style={tableStyles.th}>Course</th>
              <th style={tableStyles.th}>Student</th>
              <th style={tableStyles.thNarrow}>Grade</th>
              <th style={tableStyles.th}>Nonce (1-3)</th>
              <th style={tableStyles.thNarrow}>a</th>
              <th style={tableStyles.thNarrow}>b</th>
              <th style={tableStyles.thNarrow}>c</th>
              <th style={tableStyles.th}>
                Value of Last 2
                <br />
                digits of Prev Hash
              </th>
              <th style={tableStyles.th}>Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.type === 'completed') {
                const b = row.data;
                const isGenesis = b.blockNumber === 0;
                return (
                  <tr key={`c-${b.blockNumber}`}>
                    <td style={tableStyles.tdBlock}>{b.blockNumber}</td>
                    <td style={tableStyles.td}>{b.course}</td>
                    <td style={tableStyles.td}>{b.studentId}</td>
                    <td style={tableStyles.td}>{b.grade}</td>
                    <td style={tableStyles.td}>{b.nonce}</td>
                    <td style={tableStyles.td}>{b.a}</td>
                    <td style={tableStyles.td}>{b.b}</td>
                    <td style={tableStyles.td}>{b.c}</td>
                    <td style={tableStyles.td}>{b.prevHashLast2}</td>
                    <td
                      style={{
                        ...tableStyles.td,
                        background: isGenesis ? '#ffd54f' : '#f5f5f5',
                        fontWeight: 500,
                      }}
                    >
                      {b.hash}
                    </td>
                  </tr>
                );
              } else {
                const b = row.data;
                return (
                  <tr key={`a-${b.blockNumber}`} style={tableStyles.activeRow}>
                    <td style={tableStyles.activeBlockCell}>{b.blockNumber}</td>
                    <td style={tableStyles.tdActive}>{b.course}</td>
                    <td style={tableStyles.tdActive}>{b.studentId}</td>
                    <td style={tableStyles.tdActive}>{b.grade}</td>
                    <td style={tableStyles.tdEmpty}>?</td>
                    <td style={tableStyles.tdEmpty}>?</td>
                    <td style={tableStyles.tdEmpty}>?</td>
                    <td style={tableStyles.tdEmpty}>?</td>
                    <td style={tableStyles.td}>{b.prevHashLast2}</td>
                    <td style={tableStyles.tdEmpty}>?</td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
      </div>

      <div style={tableStyles.formula}>
        Hash = Nonce + a + b + c - Value of Last 2 digits of prev Hash
      </div>
    </div>
  );
}

function LookupTable() {
  const left: Array<[string, number]> = [];
  const right: Array<[string, number]> = [];
  for (let i = 0; i < 13; i++) {
    left.push([String.fromCharCode(65 + i), 65 + i]);
    right.push([String.fromCharCode(78 + i), 78 + i]);
  }

  return (
    <div style={styles.card}>
      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Look up Table</p>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        Course/Student/Grade의 첫 글자를 찾아 a, b, c 값을 직접 채워보세요.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          maxWidth: 360,
        }}
      >
        <table style={lookupStyles.table}>
          <tbody>
            {left.map(([letter, value]) => (
              <tr key={letter}>
                <td style={lookupStyles.letterCell}>{letter}</td>
                <td style={lookupStyles.valueCell}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table style={lookupStyles.table}>
          <tbody>
            {right.map(([letter, value]) => (
              <tr key={letter}>
                <td style={lookupStyles.letterCell}>{letter}</td>
                <td style={lookupStyles.valueCell}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubmitCard({
  selectedNonce,
  setSelectedNonce,
  hashInput,
  setHashInput,
  onSubmit,
  submitting,
  result,
  hasSubmitted,
}: {
  selectedNonce: number | null;
  setSelectedNonce: (n: number) => void;
  hashInput: string;
  setHashInput: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  result: string;
  hasSubmitted: boolean;
}) {
  if (hasSubmitted) {
    return (
      <div style={{ ...styles.card, background: '#e8f5e9', borderColor: '#4caf50' }}>
        <p style={{ fontSize: 16, fontWeight: 500, color: '#2e7d32' }}>
          ✓ 이 블록에 정답을 제출하셨습니다. 다음 블록을 기다려주세요.
        </p>
      </div>
    );
  }
  const isError = result.startsWith('✗');
  const isOk = result.startsWith('✓');
  const canSubmit = selectedNonce !== null && hashInput.trim().length > 0 && !submitting;
  return (
    <div style={styles.card}>
      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>내 답 제출</p>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 14, color: '#666', minWidth: 100 }}>① Nonce 선택:</span>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            onClick={() => setSelectedNonce(n)}
            style={{
              ...styles.nonceBtn,
              ...(selectedNonce === n ? styles.nonceBtnSelected : {}),
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 14, color: '#666', minWidth: 100 }}>② Hash 입력:</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="계산한 해시값 (예: 204)"
          value={hashInput}
          onChange={(e) => setHashInput(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) onSubmit();
          }}
          style={{
            ...styles.input,
            width: 200,
            fontFamily: 'monospace',
            fontSize: 16,
            textAlign: 'center',
            letterSpacing: 1,
          }}
        />
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          style={{
            ...styles.primaryBtn,
            marginLeft: 'auto',
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          {submitting ? '제출 중...' : '제출하기'}
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#666', marginTop: 12 }}>
        ※ Nonce 선택과 입력한 해시값이 <strong>모두 정답</strong>이어야 인정됩니다.
      </p>
      {result && (
        <p
          style={{
            fontSize: 13,
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 6,
            background: isOk ? '#e8f5e9' : isError ? '#ffebee' : '#f5f5f5',
            color: isOk ? '#2e7d32' : isError ? '#c62828' : '#666',
            fontWeight: isOk ? 500 : 400,
          }}
        >
          {result}
        </p>
      )}
    </div>
  );
}

function RoundLeaderboard({
  submissions,
  myName,
}: {
  submissions: PublicSubmission[];
  myName: string;
}) {
  const valid = submissions
    .filter((s) => s.isValid)
    .sort((a, b) => a.submittedAt - b.submittedAt);
  const invalid = submissions.filter((s) => !s.isValid);

  return (
    <div style={styles.card}>
      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
        이번 블록 제출 현황 (1등만 +1점)
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '50px 1fr 100px 80px',
          gap: 12,
          fontSize: 12,
          color: '#666',
          padding: '6px 0',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <div>순위</div>
        <div>학생</div>
        <div>제출 시각</div>
        <div>결과</div>
      </div>
      {valid.length === 0 && invalid.length === 0 && (
        <p style={{ fontSize: 13, color: '#999', padding: '16px 0', textAlign: 'center' }}>
          아직 제출한 학생이 없습니다.
        </p>
      )}
      {valid.map((s, idx) => {
        const isMe = s.studentName === myName;
        return (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '50px 1fr 100px 80px',
              gap: 12,
              fontSize: 13,
              padding: '8px 0',
              borderBottom: '1px solid #f0f0f0',
              background: idx === 0 ? '#fff8e1' : isMe ? '#e3f2fd' : 'transparent',
              fontWeight: isMe || idx === 0 ? 500 : 400,
            }}
          >
            <div style={{ fontWeight: 500, color: idx === 0 ? '#f57f17' : '#666' }}>
              {idx === 0 ? '🏆 1' : idx + 1}
            </div>
            <div>
              {s.studentName} ({s.studentNumber}){isMe && ' ← 나'}
            </div>
            <div style={{ fontFamily: 'monospace', color: '#666' }}>{fmtTime(s.submittedAt)}</div>
            <div style={{ color: idx === 0 ? '#f57f17' : '#999', fontWeight: 500 }}>
              {idx === 0 ? '+1점' : '—'}
            </div>
          </div>
        );
      })}
      {invalid.map((s) => {
        const isMe = s.studentName === myName;
        return (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '50px 1fr 100px 80px',
              gap: 12,
              fontSize: 13,
              padding: '8px 0',
              borderBottom: '1px solid #f0f0f0',
              color: '#999',
              background: isMe ? '#ffebee' : 'transparent',
            }}
          >
            <div>—</div>
            <div>
              {s.studentName} ({s.studentNumber}){isMe && ' ← 나'} (오답)
            </div>
            <div style={{ fontFamily: 'monospace' }}>{fmtTime(s.submittedAt)}</div>
            <div style={{ color: '#c62828' }}>×</div>
          </div>
        );
      })}
    </div>
  );
}

function CumulativeLeaderboard({
  leaderboard,
  myName,
}: {
  leaderboard: LeaderboardEntry[];
  myName: string;
}) {
  if (leaderboard.length === 0) return null;
  return (
    <div style={styles.card}>
      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>누적 랭킹 (TOP 5)</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '50px 1fr 80px',
          gap: 12,
          fontSize: 12,
          color: '#666',
          padding: '6px 0',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <div>순위</div>
        <div>학생</div>
        <div>채굴 성공</div>
      </div>
      {leaderboard.map((s, idx) => {
        const isMe = s.studentName === myName;
        return (
          <div
            key={`${s.studentName}-${idx}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '50px 1fr 80px',
              gap: 12,
              fontSize: 13,
              padding: '8px 0',
              borderBottom: '1px solid #f0f0f0',
              background: idx === 0 ? '#fff8e1' : isMe ? '#e3f2fd' : 'transparent',
              fontWeight: isMe || idx === 0 ? 500 : 400,
            }}
          >
            <div style={{ fontWeight: 500, color: idx === 0 ? '#f57f17' : '#666' }}>
              {idx === 0 ? '🏆 1' : idx + 1}
            </div>
            <div>
              {s.studentName} ({s.studentNumber}){isMe && ' ← 나'}
            </div>
            <div style={{ fontWeight: 500 }}>{s.totalScore}회</div>
          </div>
        );
      })}
    </div>
  );
}

function maskStudentNumber(num: string): string {
  if (num.length <= 4) return num;
  return num.slice(0, 4) + '*'.repeat(Math.max(0, num.length - 4));
}

const tableStyles: Record<string, React.CSSProperties> = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 },
  th: {
    background: '#0d3a6b',
    color: 'white',
    padding: '10px 6px',
    textAlign: 'center',
    fontWeight: 500,
    fontSize: 12,
    border: '1px solid #0d3a6b',
  },
  thNarrow: {
    background: '#0d3a6b',
    color: 'white',
    padding: '10px 4px',
    textAlign: 'center',
    fontWeight: 500,
    fontSize: 12,
    border: '1px solid #0d3a6b',
    width: 36,
  },
  thBlock: {
    background: '#0d3a6b',
    color: 'white',
    padding: '10px 6px',
    textAlign: 'center',
    fontWeight: 500,
    fontSize: 12,
    border: '1px solid #0d3a6b',
    width: 56,
  },
  activeRow: { background: '#fffbe6' },
  td: {
    padding: '8px 6px',
    textAlign: 'center',
    border: '1px solid #e0e0e0',
    background: 'white',
  },
  tdBlock: {
    padding: '8px 6px',
    textAlign: 'center',
    background: '#1976d2',
    color: 'white',
    fontWeight: 500,
    border: '1px solid #1976d2',
  },
  activeBlockCell: {
    padding: '8px 6px',
    textAlign: 'center',
    background: '#f57c00',
    color: 'white',
    fontWeight: 500,
    border: '1px solid #f57c00',
  },
  tdActive: {
    padding: '8px 6px',
    textAlign: 'center',
    border: '1px solid #ffd54f',
    background: '#fff8e1',
    fontWeight: 500,
  },
  tdEmpty: {
    padding: '8px 6px',
    textAlign: 'center',
    border: '1px dashed #f57c00',
    background: '#fff3e0',
    color: '#f57c00',
    fontWeight: 500,
  },
  formula: {
    marginTop: 12,
    background: '#1a1a1a',
    color: 'white',
    padding: '10px 14px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
};

const lookupStyles: Record<string, React.CSSProperties> = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  letterCell: {
    background: '#90caf9',
    color: '#0d47a1',
    padding: '4px 8px',
    textAlign: 'center',
    fontWeight: 500,
    width: '40%',
    border: '1px solid #bbdefb',
  },
  valueCell: {
    padding: '4px 12px',
    textAlign: 'center',
    fontFamily: 'monospace',
    border: '1px solid #e0e0e0',
    background: '#fafafa',
  },
};
