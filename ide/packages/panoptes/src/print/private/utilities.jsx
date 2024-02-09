import _ from "lodash";
import React from "react";

export const Kw = ({ children }) => {
  return <span className="kw">{children}</span>;
};

export function anyElems(...lists) {
  return _.some(lists, l => l.length > 0);
}

export function intersperse(arr, sep, proc = undefined) {
  const doInner = proc === undefined ? (e, _i) => e : proc;
  return _.flatMap(arr, (entry, i) => {
    let e = doInner(entry, i);
    return arr.length - 1 === i ? [e] : [e, sep];
  });
}

// NOTE: difference between this and _.takeRightWhile is that
// this *does* include the first element that matches the predicate.
export function takeRightUntil(arr, pred) {
  if (arr.length <= 1) {
    return arr;
  }

  let i = arr.length - 1;
  while (0 <= i) {
    if (pred(arr[i])) {
      break;
    }
    i--;
  }
  return arr.slice(i, arr.length);
}

export function fnInputsAndOutput(args) {
  let inputs = args[(0).args.length - 1];
  let output = args[args.length - 1];
  return [inputs, output];
}

export function tyIsUnit(o) {
  return "Tuple" in o && o.Tuple.length === 0;
}
