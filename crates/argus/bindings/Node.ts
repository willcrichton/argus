// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { Candidate } from "./Candidate";
import type { Goal } from "./Goal";

export type Node = { type: "result", data: EvaluationResult, } | { type: "candidate", data: Candidate, } | { type: "goal", data: Goal, };