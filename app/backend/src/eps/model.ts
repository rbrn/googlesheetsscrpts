// Simple ordinary least squares implementation
export function fitOLS(X: number[][], y: number[]): number[] {
  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  const XtXInv = invert2x2(XtX);
  const XtY = multiplyVec(Xt, y);
  return multiplyVec(XtXInv, XtY);
}

export function predictOLS(beta: number[], x: number[]): number {
  return beta.reduce((sum, b, i) => sum + b * (x[i] || 0), 0);
}

function transpose(m: number[][]): number[][] {
  return m[0].map((_, i) => m.map((row) => row[i]));
}

function multiply(a: number[][], b: number[][]): number[][] {
  return a.map((row) => b[0].map((_, j) => row.reduce((sum, v, i) => sum + v * b[i][j], 0)));
}

function multiplyVec(a: number[][], v: number[]): number[] {
  return a.map((row) => row.reduce((sum, val, i) => sum + val * v[i], 0));
}

function invert2x2(m: number[][]): number[][] {
  const [[a, b], [c, d]] = m;
  const det = a * d - b * c;
  return [
    [d / det, -b / det],
    [-c / det, a / det],
  ];
}
