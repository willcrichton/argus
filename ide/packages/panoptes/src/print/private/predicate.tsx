import {
  AliasRelationDirection,
  Clause,
  ClauseKind,
  GoalPredicate,
  ParamEnv,
  PolyPredicateKind,
  PredicateKind,
  PredicateObligation,
  TraitPredicate,
  TraitRef,
} from "@argus/common/bindings";
import _ from "lodash";
import React from "react";

import { HoverInfo } from "../../HoverInfo";
import { IcoNote } from "../../Icons";
import { PrintConst } from "./const";
import { PrintDefPath } from "./path";
import { PrintTerm } from "./term";
import {
  PrintAliasTy,
  PrintBinder,
  PrintGenericArg,
  PrintRegion,
  PrintTy,
} from "./ty";

export const PrintPredicateObligation = ({ o }: { o: PredicateObligation }) => {
  const hoverContent =
    o.paramEnv.length === 0 ? null : (
      <HoverInfo Content={() => <PrintParamEnv o={o.paramEnv} />}>
        {" "}
        <IcoNote />
      </HoverInfo>
    );

  return (
    <>
      <PrintBinderPredicateKind o={o.predicate} />
      {hoverContent}
    </>
  );
};

export const PrintGoalPredicate = ({ o }: { o: GoalPredicate }) => {
  // NOTE: goals and obligations aren't the same thing, but they
  // currently have the same semantic structure.
  return <PrintPredicateObligation o={o} />;
};

export const PrintParamEnv = ({ o }: { o: ParamEnv }) => {
  const innerContent = _.map(o, (clause, idx) => (
    <div className="WhereConstraint" key={idx}>
      <PrintClause o={clause} />
    </div>
  ));

  return <div className="DirNode WhereParamArea">{innerContent}</div>;
};

export const PrintBinderPredicateKind = ({ o }: { o: PolyPredicateKind }) => {
  const inner = (o: PredicateKind) => <PrintPredicateKind o={o} />;
  return <PrintBinder binder={o} innerF={inner} />;
};

export const PrintPredicateKind = ({ o }: { o: PredicateKind }) => {
  if (o === "Ambiguous") {
    return "ambiguous";
  } else if ("Clause" in o) {
    return <PrintClauseKind o={o.Clause} />;
  } else if ("ObjectSafe" in o) {
    return (
      <span>
        The trait <PrintDefPath o={o.ObjectSafe} /> is object-safe
      </span>
    );
  } else if ("Subtype" in o) {
    const subty = o.Subtype;
    const st = "<:";
    return (
      <span>
        <PrintTy o={subty.a} /> {st} <PrintTy o={subty.b} />
      </span>
    );
  } else if ("Coerce" in o) {
    const coerce = o.Coerce;
    return (
      <span>
        <PrintTy o={coerce.a} /> → <PrintTy o={coerce.b} />
      </span>
    );
  } else if ("ConstEquate" in o) {
    const [a, b] = o.ConstEquate;
    return (
      <span>
        <PrintConst o={a} /> = <PrintConst o={b} />
      </span>
    );
  } else if ("AliasRelate" in o) {
    const [a, b, dir] = o.AliasRelate;
    return (
      <>
        <PrintTerm o={a} /> <PrintAliasRelationDirection o={dir} />{" "}
        <PrintTerm o={b} />
      </>
    );
  } else if ("NormalizesTo" in o) {
    return (
      <>
        <PrintAliasTy o={o.NormalizesTo.alias} /> normalizes to{" "}
        <PrintTerm o={o.NormalizesTo.term} />
      </>
    );
  } else {
    throw new Error("Unknown predicate kind", o);
  }
};

export const PrintAliasRelationDirection = ({
  o,
}: {
  o: AliasRelationDirection;
}) => {
  if (o === "Equate") {
    return "==";
  } else if (o === "Subtype") {
    return "<:";
  } else {
    throw new Error("Unknown alias relation direction", o);
  }
};

export const PrintClause = ({ o }: { o: Clause }) => {
  const inner = (o: ClauseKind) => <PrintClauseKind o={o} />;
  return <PrintBinder binder={o} innerF={inner} />;
};

export const PrintClauseKind = ({ o }: { o: ClauseKind }) => {
  if ("Trait" in o) {
    return <PrintTraitPredicate o={o.Trait} />;
  } else if ("RegionOutlives" in o) {
    const ro = o.RegionOutlives;
    return (
      <span>
        <PrintRegion o={ro.a} />: <PrintRegion o={ro.b} />
      </span>
    );
  } else if ("TypeOutlives" in o) {
    const to = o.TypeOutlives;
    return (
      <span>
        <PrintTy o={to.a} />: <PrintRegion o={to.b} />
      </span>
    );
  } else if ("Projection" in o) {
    const proj = o.Projection;
    return (
      <span>
        <PrintAliasTy o={proj.projection_ty} /> == <PrintTerm o={proj.term} />
      </span>
    );
  } else if ("ConstArgHasType" in o) {
    const [c, ty] = o.ConstArgHasType;
    return (
      <span>
        const <PrintConst o={c} /> as type <PrintTy o={ty} />
      </span>
    );
  } else if ("WellFormed" in o) {
    return (
      <span>
        <PrintGenericArg o={o.WellFormed} /> well-formed
      </span>
    );
  } else if ("ConstEvaluatable" in o) {
    return (
      <span>
        <PrintConst o={o.ConstEvaluatable} /> can be evaluated
      </span>
    );
  } else {
    throw new Error("Unknown clause kind", o);
  }
};

export const PrintTraitPredicate = ({ o }: { o: TraitPredicate }) => {
  let polarity = o.polarity === "Negative" ? "!" : "";
  return (
    <>
      <span>{polarity}</span>
      <PrintTraitRef o={o.trait_ref} />
    </>
  );
};

export const PrintTraitRef = ({ o }: { o: TraitRef }) => {
  return (
    <span>
      <PrintTy o={o.self_ty} />: <PrintDefPath o={o.trait_path} />
    </span>
  );
};