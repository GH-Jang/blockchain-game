import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#f5f7fa', padding: '20px 16px' },
  containerNarrow: { maxWidth: 720, margin: '0 auto' },
  containerWide: { maxWidth: 960, margin: '0 auto' },
  loginCard: {
    maxWidth: 420,
    margin: '60px auto',
    background: 'white',
    padding: 32,
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  title: { fontSize: 22, fontWeight: 500 },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    background: 'white',
    padding: 20,
    borderRadius: 12,
    border: '1px solid #e0e0e0',
    marginBottom: 16,
  },
  waitingCard: {
    background: 'white',
    padding: 32,
    borderRadius: 12,
    border: '1px solid #e0e0e0',
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: 8,
    fontSize: 14,
    width: '100%',
  },
  primaryBtn: {
    background: '#1976d2',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  secondaryBtn: {
    background: 'transparent',
    border: '1px solid #ddd',
    padding: '6px 12px',
    fontSize: 13,
    borderRadius: 6,
    color: '#666',
  },
  endBtn: {
    background: '#f57c00',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
  },
  dangerBtn: {
    background: 'transparent',
    border: '1px solid #c62828',
    color: '#c62828',
    padding: '6px 12px',
    fontSize: 13,
    borderRadius: 6,
  },
  nonceBtn: {
    background: 'white',
    border: '1.5px solid #ddd',
    padding: '8px 20px',
    fontSize: 16,
    fontWeight: 500,
    borderRadius: 8,
    minWidth: 50,
  },
  nonceBtnSelected: {
    background: '#e3f2fd',
    borderColor: '#1976d2',
    color: '#1976d2',
  },
  th: {
    padding: '8px 6px',
    textAlign: 'left' as const,
    fontWeight: 500,
    fontSize: 12,
    color: '#666',
  },
  td: { padding: '8px 6px' },
};

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
