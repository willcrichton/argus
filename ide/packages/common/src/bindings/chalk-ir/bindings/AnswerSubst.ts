// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import { Constraints } from '../../../types';
import { Goal } from '../../../types';
import { InEnvironment } from '../../../types';
import { Substitution } from '../../../types';

export interface AnswerSubst { subst: Substitution, constraints: Constraints, delayed_subgoals: Array<InEnvironment<Goal>>, }