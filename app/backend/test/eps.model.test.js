import assert from "node:assert";
import { fitOLS, predictOLS } from "../dist/eps/model.js";

// Simple dataset: y = 2*x1 + x2
const X = [
  [1, 0],
  [0, 1],
  [1, 1],
];
const y = [2, 1, 3];
const beta = fitOLS(X, y);
const pred = predictOLS(beta, [2, 3]);

// Expected: 2*2 + 1*3 = 7
assert(Math.abs(pred - 7) < 1e-6);
console.log("EPS model test passed");
