import { Request, Response } from "express";
import { fitOLS, predictOLS } from "./model.js";

// Simple in-memory training data placeholder
const trainingX = [[1, 2], [2, 1], [3, 0]];
const trainingY = [1, 2, 3];
const beta = fitOLS(trainingX, trainingY);

export function estimateEPS(req: Request, res: Response) {
  const { features } = req.body;
  if (!Array.isArray(features)) {
    return res.status(400).json({ error: "features array required" });
  }
  const eps = predictOLS(beta, features);
  res.json({ eps, featuresUsed: features.length });
}
