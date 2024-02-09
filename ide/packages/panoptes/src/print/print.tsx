import {
  ExtensionCandidates,
  Goal,
  Impl,
  Obligation,
} from "@argus/common/bindings";
import _ from "lodash";
import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import ReactJson from "react-json-view";

import "./print.css";
import { PrintImpl as UnsafePrintImplHir } from "./private/hir";
import {
  PrintDefPath as UnsafePrintDefPath,
  PrintDefPathFull as UnsafePrintDefPathFull,
} from "./private/path";
import {
  PrintBinderPredicateKind,
  PrintGoalPredicate as UnsafePrintGoalPredicate,
} from "./private/predicate";
import {
  PrintImplHeader as UnsafePrintImplHeader,
  PrintTy as UnsafePrintTy,
} from "./private/ty";

// NOTE: please Please PLEASE wrap all printing components in this
// PrintWithFallback. Pretty printing is still a fragile process and
// I can never be sure if it's working correctly or not.
//
// Nothing should ever be imported from the 'private' directory except
// from within this file.
export const PrintWithFallback = ({
  object,
  Content,
}: {
  object: any;
  Content: React.FC;
}) => {
  const FallbackFromError = ({
    error,
    resetErrorBoundary,
  }: {
    error: any;
    resetErrorBoundary: (...args: any[]) => void;
  }) => {
    // NOTE: Call resetErrorBoundary() to reset the error boundary and retry the render.
    return (
      <div className="PrintError">
        <p>Whoops! Something went wrong while printing:</p>
        <ReactJson src={object ?? "null"} collapsed={true} />
        <pre>`{error.message}`</pre>
      </div>
    );
  };

  return (
    <ErrorBoundary
      FallbackComponent={FallbackFromError}
      onReset={details => {
        console.error(details);
      }}
    >
      <Content />
    </ErrorBoundary>
  );
};

export const PrintTy = ({ ty }: { ty: any }) => {
  return (
    <PrintWithFallback object={ty} Content={() => <UnsafePrintTy o={ty} />} />
  );
};

export const PrintObligation = ({ obligation }: { obligation: Obligation }) => {
  return (
    <PrintWithFallback
      object={obligation}
      Content={() => <PrintBinderPredicateKind o={obligation.predicate} />}
    />
  );
};

export const PrintImplHir = ({ impl }: { impl: Impl }) => {
  return (
    <PrintWithFallback
      object={impl}
      Content={() => <UnsafePrintImplHir impl={impl} />}
    />
  );
};

export const PrintImplHeader = ({ impl }: { impl: any }) => {
  return (
    <PrintWithFallback
      object={impl}
      Content={() => <UnsafePrintImplHeader o={impl} />}
    />
  );
};

export const PrintGoal = ({ o }: { o: Goal }) => {
  return (
    <PrintWithFallback
      object={o}
      Content={() => <UnsafePrintGoalPredicate o={o.goal} />}
    />
  );
};

// The individual components aren't typed, so we'll require passing the entire array for now.
export const PrintExtensionCandidate = ({
  candidates,
  idx,
}: {
  candidates: ExtensionCandidates;
  idx: number;
}) => {
  const o = candidates.data[idx];
  return o === undefined ? (
    "?"
  ) : (
    <PrintWithFallback
      object={o}
      Content={() => <UnsafePrintDefPath o={o} />}
    />
  );
};

export const PrintBodyName = ({ defPath }: { defPath: any }) => {
  return (
    <PrintWithFallback
      object={defPath}
      Content={() => <UnsafePrintDefPathFull o={defPath} />}
    />
  );
};
