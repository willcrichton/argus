// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import { ClausePriority } from '../../../types';
import { Constraints } from '../../../types';
import { DomainGoal } from '../../../types';
import { Goals } from '../../../types';

export interface ProgramClauseImplication { consequence: DomainGoal, conditions: Goals, constraints: Constraints, priority: ClausePriority, }