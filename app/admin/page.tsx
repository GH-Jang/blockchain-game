'use client';

import { useEffect, useState, useCallback } from 'react';
import { styles, fmtTime } from '@/lib/styles';

type Block = {
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

type Submission = {
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

type ScoreEntry = {
  studentNumber: string;
  studentName: string;
  totalScore: number;
  wins: number;
};

type SeedInput = { course: string; studentId: string; grade: string };

type AdminData = {
  state: { currentBlockNumber: number | null; sessionStartedAt: number };
  blocks: { block: Block; submissions: Submission[] }[];
  scores: ScoreEntry[];
  nextBlockNumber: number;
  nextSeed: SeedInput | null;
  seedTotal: number;
};

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');

  const [course, setCourse] = useState('');
  const [studentId, setStudentId] = useState('');
  const [grade, setGrade] = useState('A');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_pw');
    if (saved) {
      setPassword(saved);
      setAuthed(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!authed) return;
    try {
      const res = await fetch('/api/admin', {
        headers: { 'x-admin-password': password },
        cache: 'no-store',
      });
      if (res.status === 401) {
        sessionStorage.removeItem('admin_pw');
        setAuthed(false);
        setError('비밀번호가 올바르지 않습니다.');
        return;
      }
      const raw = await res.json();
      if (!res.ok || raw.error) {
        const msg = raw.message || raw.error || `HTTP ${res.status}`;
        setError(`서버 오류: ${msg}\n\n${raw.hint || ''}`);
        return;
      }
      setError('');
      setData(raw as AdminData);
    } catch (e: any) {
      setError(`서버 통신 실패: ${e?.message || String(e)}`);
    }
  }, [authed, password]);

  useEffect(() => {
    if (!authed) return;
    fetchData();
    const id = setInterval(fetchData, 2000);
    return () => clearInterval(id);
  }, [authed, fetchData]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    const res = await fetch('/api/admin', {
      headers: { 'x-admin-password': password },
      cache: 'no-store',
    });
    if (res.status === 401) {
      setError('비밀번호가 올바르지 않습니다.');
      return;
    }
    sessionStorage.setItem('admin_pw', password);
    setAuthed(true);
  }

  async function startBlockFromSeed() {
    if (!data?.nextSeed) return;
    setBusy(true);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({
        action: 'start_block',
        course: data.nextSeed.course,
        studentId: data.nextSeed.studentId,
        grade: data.nextSeed.grade,
      }),
    });
    const d = await res.json();
    if (d.error) alert(d.error + (d.message ? '\n' + d.message : ''));
    else fetchData();
    setBusy(false);
  }

  async function startBlockManual() {
    if (!course.trim() || !studentId.trim()) {
      alert('코스명과 학생 ID를 입력하세요.');
      return;
    }
    setBusy(true);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({
        action: 'start_block',
        course: course.trim(),
        studentId: studentId.trim(),
        grade,
      }),
    });
    const d = await res.json();
    if (d.error) alert(d.error + (d.message ? '\n' + d.message : ''));
    else {
      setCourse('');
      setStudentId('');
      setGrade('A');
      fetchData();
    }
    setBusy(false);
  }

  async function endBlock() {
    if (!confirm('이 블록을 종료하시겠습니까? 1등이 확정되고 +1점이 부여됩니다.')) return;
    setBusy(true);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ action: 'end_block' }),
    });
    const d = await res.json();
    if (d.error) alert(d.error);
    else if (d.winner) {
      alert(`🏆 1등: ${d.winner.studentName} (${d.winner.studentNumber})\n+1점이 부여되었습니다.`);
    } else {
      alert('정답을 제출한 학생이 없어 보상은 없습니다.');
    }
    fetchData();
    setBusy(false);
  }

  async function startNewSession() {
    const blocksCount = data?.blocks.filter((b) => b.block.blockNumber > 0).length || 0;
    const scoresCount = data?.scores.length || 0;

    let warningMsg = '🆕 새 실습을 시작하시겠습니까?\n\n';
    if (blocksCount > 0 || scoresCount > 0) {
      warningMsg +=
        `⚠️ 다음 데이터가 모두 영구 삭제됩니다:\n` +
        `  • 채굴된 블록 ${blocksCount}개\n` +
        `  • 학생 점수 기록 ${scoresCount}건\n` +
        `  • 모든 제출 기록\n\n`;
    }
    warningMsg += '계속하시겠습니까?';

    if (!confirm(warningMsg)) return;
    if (
      blocksCount > 0 &&
      !confirm('정말 모든 데이터를 삭제하고 새로 시작하시겠습니까? 이 작업은 되돌릴 수 없습니다.')
    ) {
      return;
    }

    setBusy(true);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ action: 'reset' }),
    });
    const d = await res.json();
    if (d.error) alert(d.error);
    else {
      alert('✓ 새 실습 시작됨. 이전 데이터는 모두 삭제되었습니다.');
      fetchData();
    }
    setBusy(false);
  }

  function copyStudentLink() {
    const url = window.location.origin;
    navigator.clipboard.writeText(url);
    alert(`학생 링크 복사됨:\n${url}`);
  }

  if (!authed) {
    return (
      <div style={styles.page}>
        <div style={styles.loginCard}>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 16 }}>관리자 로그인</h1>
          <form onSubmit={login}>
            <input
              type="password"
              placeholder="관리자 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              autoFocus
            />
            <button type="submit" style={{ ...styles.primaryBtn, marginTop: 12, width: '100%' }}>
              로그인
            </button>
            {error && <p style={{ color: '#c62828', fontSize: 13, marginTop: 8 }}>{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: 600, margin: '60px auto' }}>
          {error ? (
            <div
              style={{
                background: '#ffebee',
                border: '1px solid #c62828',
                padding: 20,
                borderRadius: 8,
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#c62828' }}>
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
                {error}
              </pre>
              <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>점검할 항목:</p>
                <ol style={{ fontSize: 12, color: '#666', paddingLeft: 20, lineHeight: 1.8 }}>
                  <li>Vercel → Settings → Environments에 <code>KV_REST_API_URL</code>과 <code>KV_REST_API_TOKEN</code>이 있는지</li>
                  <li>Upstash 통합이 정상적으로 연결되었는지</li>
                  <li>위 항목 수정 후 Vercel에서 <strong>재배포(Redeploy)</strong> 했는지</li>
                </ol>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: '#999' }}>로딩 중...</p>
          )}
        </div>
      </div>
    );
  }

  const currentBlock =
    data.state.currentBlockNumber !== null
      ? data.blocks.find((b) => b.block.blockNumber === data.state.currentBlockNumber)
      : null;
  const allBlocks = data.blocks.filter((b) => b.block.blockNumber > 0);
  const sessionStartDate = new Date(data.state.sessionStartedAt);

  return (
    <div style={styles.page}>
      <div style={styles.containerWide}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>블록체인 채굴 게임 - 관리자</h1>
            <p style={styles.subtitle}>
              현재 실습 시작: {sessionStartDate.toLocaleString('ko-KR')} · 채굴 {allBlocks.length}개 ·
              참여 학생 {data.scores.length}명
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={copyStudentLink} style={styles.primaryBtn}>
              학생 링크 복사
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem('admin_pw');
                setAuthed(false);
              }}
              style={styles.secondaryBtn}
            >
              로그아웃
            </button>
          </div>
        </header>

        <div
          style={{
            ...styles.card,
            background: '#fff3e0',
            borderColor: '#ffb74d',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#e65100', marginBottom: 4 }}>
              🆕 새 실습 시작
            </p>
            <p style={{ fontSize: 12, color: '#666' }}>
              다른 반/회차 학생들과 새로 진행하려면 버튼을 누르세요. 이전 데이터는 모두 삭제됩니다.
            </p>
          </div>
          <button onClick={startNewSession} disabled={busy} style={styles.endBtn}>
            새 실습 시작
          </button>
        </div>

        <CumulativeScoreTable scores={data.scores} />

        {currentBlock ? (
          <CurrentBlockPanel data={currentBlock} onEnd={endBlock} busy={busy} />
        ) : (
          <NewBlockForm
            course={course}
            setCourse={setCourse}
            studentId={studentId}
            setStudentId={setStudentId}
            grade={grade}
            setGrade={setGrade}
            onStartManual={startBlockManual}
            onStartFromSeed={startBlockFromSeed}
            busy={busy}
            nextBlockNumber={data.nextBlockNumber}
            nextSeed={data.nextSeed}
            seedTotal={data.seedTotal}
          />
        )}

        <ChainHistory blocks={allBlocks} />
      </div>
    </div>
  );
}

function CumulativeScoreTable({ scores }: { scores: ScoreEntry[] }) {
  return (
    <div style={styles.card}>
      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
        누적 점수 (1등 독식: 블록당 +1점)
      </p>
      {scores.length === 0 ? (
        <p style={{ fontSize: 13, color: '#999', padding: '12px 0', textAlign: 'center' }}>
          아직 채굴에 성공한 학생이 없습니다.
        </p>
      ) : (
        <table style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
              <th style={styles.th}>순위</th>
              <th style={styles.th}>학번</th>
              <th style={styles.th}>이름</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>채굴 성공</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, idx) => (
              <tr
                key={`${s.studentNumber}-${s.studentName}`}
                style={{
                  borderBottom: '1px solid #f0f0f0',
                  background: idx === 0 ? '#fff8e1' : 'transparent',
                  fontWeight: idx === 0 ? 500 : 400,
                }}
              >
                <td style={{ ...styles.td, fontWeight: 500, color: idx === 0 ? '#f57f17' : '#666' }}>
                  {idx === 0 ? '🏆 1' : idx + 1}
                </td>
                <td style={{ ...styles.td, fontFamily: 'monospace' }}>{s.studentNumber}</td>
                <td style={styles.td}>{s.studentName}</td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 500 }}>
                  {s.totalScore}회
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CurrentBlockPanel({
  data,
  onEnd,
  busy,
}: {
  data: { block: Block; submissions: Submission[] };
  onEnd: () => void;
  busy: boolean;
}) {
  const { block, submissions } = data;
  const valid = submissions.filter((s) => s.isValid).sort((a, b) => a.submittedAt - b.submittedAt);
  const invalid = submissions.filter((s) => !s.isValid);

  return (
    <div style={{ ...styles.card, borderColor: '#1976d2', borderWidth: 2 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <p style={{ fontSize: 12, color: '#1976d2', fontWeight: 500, marginBottom: 4 }}>● 진행 중</p>
          <p style={{ fontSize: 22, fontWeight: 500 }}>Block #{block.blockNumber}</p>
        </div>
        <button onClick={onEnd} disabled={busy} style={styles.endBtn}>
          블록 종료 (1등 확정 + 1점 부여)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        <Field label="Course" value={block.course} />
        <Field label="Student" value={block.studentId} />
        <Field label="Grade" value={block.grade} />
        <Field label="정답 nonce" value={String(block.validNonce)} highlight />
      </div>

      <div
        style={{
          background: '#f5f7fa',
          padding: 12,
          borderRadius: 8,
          fontFamily: 'monospace',
          fontSize: 12,
          marginBottom: 16,
        }}
      >
        <div>
          a={block.a}, b={block.b}, c={block.c}, prev_last2={block.prevHashLast2}
        </div>
        <div>
          해시 = {block.validNonce} + {block.a} + {block.b} + {block.c} - {block.prevHashLast2} ={' '}
          <strong>{block.hash}</strong>
        </div>
      </div>

      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
        제출 현황 ({submissions.length}명)
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 90px 1fr 50px 90px 70px 70px 70px',
          gap: 8,
          fontSize: 12,
          color: '#666',
          padding: '6px 0',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <div>순위</div>
        <div>학번</div>
        <div>이름</div>
        <div>nonce</div>
        <div>제출 시각</div>
        <div>제출 해시</div>
        <div>정답 해시</div>
        <div>결과</div>
      </div>
      {valid.map((s, idx) => (
        <div
          key={s.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 90px 1fr 50px 90px 70px 70px 70px',
            gap: 8,
            fontSize: 13,
            padding: '6px 0',
            borderBottom: '1px solid #f0f0f0',
            background: idx === 0 ? '#fff8e1' : 'transparent',
            fontWeight: idx === 0 ? 500 : 400,
          }}
        >
          <div>{idx === 0 ? '🏆' : idx + 1}</div>
          <div style={{ fontFamily: 'monospace' }}>{s.studentNumber}</div>
          <div>{s.studentName}</div>
          <div style={{ fontFamily: 'monospace' }}>{s.nonce}</div>
          <div style={{ fontFamily: 'monospace', color: '#666' }}>{fmtTime(s.submittedAt)}</div>
          <div style={{ fontFamily: 'monospace' }}>{s.submittedHash}</div>
          <div style={{ fontFamily: 'monospace', color: '#666' }}>{s.computedHash}</div>
          <div style={{ color: idx === 0 ? '#f57f17' : '#2e7d32', fontWeight: 500 }}>
            {idx === 0 ? '+1점' : '정답'}
          </div>
        </div>
      ))}
      {invalid.map((s) => {
        const nonceOk = s.computedHash % 3 === 0;
        const hashOk = s.submittedHash === s.computedHash;
        let reason = '오답';
        if (!nonceOk && !hashOk) reason = 'nonce·해시 X';
        else if (!nonceOk) reason = 'nonce 오답';
        else if (!hashOk) reason = '해시값 오답';
        return (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 90px 1fr 50px 90px 70px 70px 70px',
              gap: 8,
              fontSize: 13,
              padding: '6px 0',
              borderBottom: '1px solid #f0f0f0',
              color: '#999',
            }}
          >
            <div>—</div>
            <div style={{ fontFamily: 'monospace' }}>{s.studentNumber}</div>
            <div>{s.studentName}</div>
            <div style={{ fontFamily: 'monospace' }}>{s.nonce}</div>
            <div style={{ fontFamily: 'monospace' }}>{fmtTime(s.submittedAt)}</div>
            <div style={{ fontFamily: 'monospace' }}>{s.submittedHash}</div>
            <div style={{ fontFamily: 'monospace' }}>{s.computedHash}</div>
            <div style={{ color: '#c62828', fontSize: 11 }}>{reason}</div>
          </div>
        );
      })}
      {submissions.length === 0 && (
        <p style={{ fontSize: 13, color: '#999', padding: '16px 0', textAlign: 'center' }}>
          아직 제출한 학생이 없습니다.
        </p>
      )}
    </div>
  );
}

function NewBlockForm({
  course,
  setCourse,
  studentId,
  setStudentId,
  grade,
  setGrade,
  onStartManual,
  onStartFromSeed,
  busy,
  nextBlockNumber,
  nextSeed,
  seedTotal,
}: {
  course: string;
  setCourse: (v: string) => void;
  studentId: string;
  setStudentId: (v: string) => void;
  grade: string;
  setGrade: (v: string) => void;
  onStartManual: () => void;
  onStartFromSeed: () => void;
  busy: boolean;
  nextBlockNumber: number;
  nextSeed: SeedInput | null;
  seedTotal: number;
}) {
  if (nextSeed) {
    return (
      <div style={styles.card}>
        <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
          새 블록 시작 (Block #{nextBlockNumber} / PDF 시드 {nextBlockNumber}/{seedTotal})
        </p>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
          PDF 자료의 다음 블록 데이터가 자동으로 입력됩니다. 버튼만 누르면 바로 시작됩니다.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr auto',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <PreviewBox label="Course" value={nextSeed.course} />
          <PreviewBox label="Student" value={nextSeed.studentId} />
          <PreviewBox label="Grade" value={nextSeed.grade} />
          <button onClick={onStartFromSeed} disabled={busy} style={styles.primaryBtn}>
            {busy ? '시작 중...' : `Block #${nextBlockNumber} 시작`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
        새 블록 시작 (Block #{nextBlockNumber} · 추가 입력)
      </p>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        PDF 시드 데이터({seedTotal}개)를 모두 사용했습니다. 추가로 진행하시려면 직접 입력해주세요.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 2fr 1fr auto',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          placeholder="코스명 (예: Parks 320)"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          style={styles.input}
        />
        <input
          placeholder="학생 ID (예: ad59da)"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          style={styles.input}
        />
        <select value={grade} onChange={(e) => setGrade(e.target.value)} style={styles.input}>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
          <option value="D">D</option>
          <option value="F">F</option>
          <option value="P">P</option>
        </select>
        <button onClick={onStartManual} disabled={busy} style={styles.primaryBtn}>
          {busy ? '시작 중...' : '시작'}
        </button>
      </div>
    </div>
  );
}

function PreviewBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: '#e3f2fd',
        border: '1px solid #90caf9',
        padding: '10px 12px',
        borderRadius: 8,
      }}
    >
      <p style={{ fontSize: 11, color: '#1565c0', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 500, color: '#0d47a1' }}>{value}</p>
    </div>
  );
}

function ChainHistory({ blocks }: { blocks: { block: Block; submissions: Submission[] }[] }) {
  if (blocks.length === 0) return null;
  return (
    <div style={styles.card}>
      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>블록체인 히스토리</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
              <th style={styles.th}>블록</th>
              <th style={styles.th}>코스</th>
              <th style={styles.th}>학생ID</th>
              <th style={styles.th}>성적</th>
              <th style={styles.th}>nonce</th>
              <th style={styles.th}>해시</th>
              <th style={styles.th}>1등</th>
            </tr>
          </thead>
          <tbody>
            {blocks
              .sort((a, b) => a.block.blockNumber - b.block.blockNumber)
              .map(({ block, submissions }) => {
                const winner = submissions.find((s) => s.id === block.winnerSubmitId);
                return (
                  <tr key={block.blockNumber} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={styles.td}>{block.blockNumber}</td>
                    <td style={styles.td}>{block.course}</td>
                    <td style={{ ...styles.td, fontFamily: 'monospace' }}>{block.studentId}</td>
                    <td style={styles.td}>{block.grade}</td>
                    <td style={{ ...styles.td, fontFamily: 'monospace', color: '#1976d2', fontWeight: 500 }}>
                      {block.validNonce}
                    </td>
                    <td style={{ ...styles.td, fontFamily: 'monospace' }}>{block.hash}</td>
                    <td style={styles.td}>
                      {winner ? (
                        <span style={{ color: '#2e7d32', fontWeight: 500 }}>
                          🏆 {winner.studentName} ({winner.studentNumber})
                        </span>
                      ) : block.status === 'mining' ? (
                        <span style={{ color: '#1976d2' }}>진행 중</span>
                      ) : (
                        <span style={{ color: '#999' }}>없음</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? '#fff8e1' : '#f5f7fa', padding: 12, borderRadius: 8 }}>
      <p style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{label}</p>
      <p
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: highlight ? '#f57f17' : '#1a1a1a',
        }}
      >
        {value}
      </p>
    </div>
  );
}
