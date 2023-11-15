// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import { AdtId } from '../../../types';
import { AliasTy } from '../../../types';
import { AssocTypeId } from '../../../types';
import { BoundVar } from '../../../types';
import { ClosureId } from '../../../types';
import { Const } from '../../../types';
import { DynTy } from '../../../types';
import { FnDefId } from '../../../types';
import { FnPointer } from '../../../types';
import { ForeignDefId } from '../../../types';
import { GeneratorId } from '../../../types';
import { InferenceVar } from '../../../types';
import { Lifetime } from '../../../types';
import { Mutability } from '../../../types';
import { OpaqueTyId } from '../../../types';
import { PlaceholderIndex } from '../../../types';
import { Scalar } from '../../../types';
import { Substitution } from '../../../types';
import { Ty } from '../../../types';
import { TyVariableKind } from '../../../types';

export type TyKind = { Adt: [AdtId, Substitution] } | { AssociatedType: [AssocTypeId, Substitution] } | { Scalar: Scalar } | { Tuple: [number, Substitution] } | { Array: [Ty, Const] } | { Slice: Ty } | { Raw: [Mutability, Ty] } | { Ref: [Mutability, Lifetime, Ty] } | { OpaqueType: [OpaqueTyId, Substitution] } | { FnDef: [FnDefId, Substitution] } | "Str" | "Never" | { Closure: [ClosureId, Substitution] } | { Generator: [GeneratorId, Substitution] } | { GeneratorWitness: [GeneratorId, Substitution] } | { Foreign: ForeignDefId } | "Error" | { Placeholder: PlaceholderIndex } | { Dyn: DynTy } | { Alias: AliasTy } | { Function: FnPointer } | { BoundVar: BoundVar } | { InferenceVar: [InferenceVar, TyVariableKind] };