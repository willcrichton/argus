import {
  CandidateIdx,
  EvaluationResult,
  Node as NodeTy,
  ResultIdx,
} from "@argus/common/bindings";
import React, { useContext } from "react";

import { HoverInfo } from "../HoverInfo";
import { IcoAmbiguous, IcoCheck, IcoError, IcoLoop } from "../Icons";
import { PrintGoal, PrintImplHeader } from "../print/print";
import { TreeContext } from "./Context";

export const ResultRaw = ({ result }: { result: EvaluationResult }) => {
  return result === "yes" ? (
    <HoverInfo Content={() => <span>Proved true</span>}>
      <IcoCheck />
    </HoverInfo>
  ) : result === "no" ? (
    <HoverInfo Content={() => <span>Unsatisfiable</span>}>
      <IcoError />
    </HoverInfo>
  ) : result === "maybe-overflow" ? (
    <HoverInfo
      Content={() => (
        <span>Evaluating this obligation may have caused overflow</span>
      )}
    >
      <IcoLoop />
    </HoverInfo>
  ) : (
    <HoverInfo
      Content={() => (
        <span>Rustc can't determine whether this is true or false</span>
      )}
    >
      <IcoAmbiguous />
    </HoverInfo>
  );
};

export const Result = ({ idx }: { idx: ResultIdx }) => {
  const tree = useContext(TreeContext)!;
  const result = tree.result(idx);
  return <ResultRaw result={result} />;
};

export const Candidate = ({ idx }: { idx: CandidateIdx }) => {
  const tree = useContext(TreeContext)!;
  const candidate = tree.candidate(idx);
  if ("Any" in candidate) {
    return candidate.Any;
  } else if ("Impl" in candidate) {
    return <PrintImplHeader impl={candidate.Impl} />;
  } else if ("ParamEnv" in candidate) {
    throw new Error("paramEnv not implemented");
  } else {
    throw new Error("Unknown candidate type", candidate);
  }
};

export const Node = ({ node }: { node: NodeTy }) => {
  const treeInfo = useContext(TreeContext)!;
  if ("Result" in node) {
    return <Result idx={node.Result} />;
  } else if ("Goal" in node) {
    return (
      <>
        <Result idx={node.Goal[1]} />
        <PrintGoal o={treeInfo.goal(node.Goal[0])} />
      </>
    );
  } else if ("Candidate" in node) {
    return <Candidate idx={node.Candidate} />;
  } else {
    throw new Error("Unknown node type", node);
  }
};
