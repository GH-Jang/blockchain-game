export type SeedBlockInput = {
  course: string;
  studentId: string;
  grade: string;
};

// PDF Block 1~8 - 교수가 "다음 블록 시작" 버튼만 누르면 자동 입력
export const SEED_BLOCKS: SeedBlockInput[] = [
  { course: 'Parks 320', studentId: 'ad59da', grade: 'F' },
  { course: 'Engineering 300', studentId: 'bd9ebc', grade: 'B' },
  { course: 'Business 200', studentId: 'c67445', grade: 'C' },
  { course: 'Parks 320', studentId: 'e2dd8a', grade: 'B' },
  { course: 'Engineering 300', studentId: 'e2dd8a', grade: 'D' },
  { course: 'Engineering 300', studentId: 'bde7af', grade: 'B' },
  { course: 'Finance 100', studentId: 'eff82a', grade: 'A' },
  { course: 'Programming 100', studentId: 'ad59da', grade: 'A' },
];
