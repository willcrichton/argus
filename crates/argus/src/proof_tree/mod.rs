//! Proof tree types sent to the Argus frontend.

pub mod ext;
pub(super) mod serialize;
pub mod topology;

use std::collections::HashSet;

use index_vec::IndexVec;
use rustc_infer::infer::InferCtxt;
use rustc_middle::ty;
use rustc_trait_selection::traits::solve;
use serde::Serialize;
pub use topology::*;
#[cfg(feature = "testing")]
use ts_rs::TS;

use crate::{
  ext::InferCtxtExt,
  serialize::{serialize_to_value, ty::Goal__PredicateDef},
  types::{
    intermediate::{EvaluationResult, EvaluationResultDef},
    ImplHeader, ObligationNecessity,
  },
};

crate::define_idx! {
  usize,
  ProofNodeIdx
}

// FIXME: Nodes shouldn't be PartialEq, or Eq. They are currently
// so we can "detect cycles" by doing a raw comparison of the nodes.
// Of course, this isn't robust and should be removed ASAP.
//
// Same goes for Candidates and Goals.
#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "testing", derive(TS))]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Node {
  Result {
    #[serde(with = "EvaluationResultDef")]
    #[cfg_attr(feature = "testing", ts(type = "EvaluationResult"))]
    data: EvaluationResult,
  },
  Candidate {
    data: Candidate,
  },
  Goal {
    data: Goal,
  },
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "testing", derive(TS))]
#[serde(rename_all = "camelCase")]
pub struct Goal {
  #[cfg_attr(feature = "testing", ts(type = "any"))]
  goal: serde_json::Value,

  #[serde(with = "EvaluationResultDef")]
  #[cfg_attr(feature = "testing", ts(type = "EvaluationResult"))]
  result: EvaluationResult,

  // TODO: remove this is only for debugging
  debug_comparison: String,
  necessity: ObligationNecessity,
  num_vars: usize,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "testing", derive(TS))]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Candidate {
  Impl {
    #[cfg_attr(feature = "testing", ts(type = "any"))]
    // Type is ImplHeader from mod `crate::types`.
    data: serde_json::Value,
  },
  ParamEnv {
    idx: usize,
  },
  // TODO remove variant once everything is structured
  Any {
    data: String,
  },
}

#[derive(Serialize, Debug, Clone)]
#[cfg_attr(feature = "testing", derive(TS))]
#[serde(rename_all = "camelCase")]
pub struct SerializedTree {
  pub root: ProofNodeIdx,
  #[cfg_attr(feature = "testing", ts(type = "Node[]"))]
  pub nodes: IndexVec<ProofNodeIdx, Node>,
  pub topology: TreeTopology,
  pub error_leaves: Vec<ProofNodeIdx>,
  pub unnecessary_roots: HashSet<ProofNodeIdx>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub cycle: Option<ProofCycle>,
}

#[derive(Serialize, Debug, Clone)]
#[cfg_attr(feature = "testing", derive(TS))]
pub struct ProofCycle(Vec<ProofNodeIdx>);

// ----------------------------------------
// impls

impl Goal {
  fn new<'tcx>(
    infcx: &InferCtxt<'tcx>,
    goal: &solve::Goal<'tcx, ty::Predicate<'tcx>>,
    result: EvaluationResult,
  ) -> Self {
    #[derive(Serialize)]
    struct Wrapper<'a, 'tcx: 'a>(
      #[serde(with = "Goal__PredicateDef")]
      &'a solve::Goal<'tcx, ty::Predicate<'tcx>>,
    );
    // TODO remove after deubbing
    let debug_comparison = format!("{:?}", goal.predicate.kind().skip_binder());
    let necessity = infcx.guess_predicate_necessity(&goal.predicate);
    let num_vars =
      serialize::var_counter::count_vars(infcx.tcx, goal.predicate);
    let goal = serialize_to_value(infcx, &Wrapper(goal))
      .expect("failed to serialize goal");
    Self {
      goal,
      result,
      debug_comparison,
      necessity,
      num_vars,
    }
  }
}

impl Candidate {
  fn new_impl_header<'tcx>(
    infcx: &InferCtxt<'tcx>,
    impl_: &ImplHeader<'tcx>,
  ) -> Self {
    let impl_ =
      serialize_to_value(infcx, impl_).expect("couldn't serialize impl header");

    Self::Impl { data: impl_ }
  }

  // TODO: we should pass the ParamEnv here for certainty.
  fn new_param_env(idx: usize) -> Self {
    Self::ParamEnv { idx }
  }
}

impl From<&'static str> for Candidate {
  fn from(value: &'static str) -> Self {
    value.to_string().into()
  }
}

impl From<String> for Candidate {
  fn from(value: String) -> Self {
    Candidate::Any { data: value }
  }
}
