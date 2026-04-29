import './globals.css';

export const metadata = {
  title: '블록체인 채굴 게임',
  description: '디지털금융경영학과 블록체인 실습',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
