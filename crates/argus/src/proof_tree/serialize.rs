use std::{collections::HashSet, ops::ControlFlow};

use anyhow::{anyhow, bail, Result};
use ext::*;
use index_vec::IndexVec;
use rustc_hir::{self as hir, def_id::DefId};
use rustc_infer::infer::InferCtxt;
use rustc_middle::ty::Predicate;
use rustc_trait_selection::{
  solve::inspect::{
    InspectCandidate, InspectGoal, ProofTreeInferCtxtExt, ProofTreeVisitor,
  },
  traits::{query::NoSolution, solve},
};

use super::*;
use crate::{
  ext::{InferCtxtExt, TyCtxtExt},
  types::ObligationNecessity,
};

pub struct SerializedTreeVisitor {
  pub def_id: DefId,
  pub root: Option<ProofNodeIdx>,
  pub previous: Option<ProofNodeIdx>,
  pub nodes: IndexVec<ProofNodeIdx, Node>,
  pub topology: TreeTopology,
  pub error_leaves: Vec<ProofNodeIdx>,
  pub unnecessary_roots: HashSet<ProofNodeIdx>,
  pub cycle: Option<ProofCycle>,
}

impl SerializedTreeVisitor {
  pub fn new(def_id: DefId) -> Self {
    SerializedTreeVisitor {
      def_id,
      root: None,
      previous: None,
      nodes: IndexVec::default(),
      topology: TreeTopology::new(),
      error_leaves: Vec::default(),
      unnecessary_roots: HashSet::default(),
      cycle: None,
    }
  }

  pub fn into_tree(self) -> Result<SerializedTree> {
    let SerializedTreeVisitor {
      root: Some(root),
      nodes,
      topology,
      error_leaves,
      unnecessary_roots,
      cycle,
      ..
    } = self
    else {
      bail!("missing root node!");
    };

    Ok(SerializedTree {
      root,
      nodes,
      topology,
      error_leaves,
      unnecessary_roots,
      cycle,
    })
  }

  fn check_for_cycle_from(&mut self, from: ProofNodeIdx) {
    if self.cycle.is_some() {
      return;
    }

    let to_root = self.topology.path_to_root(from);

    let node_start = &self.nodes[from];
    if to_root.iter_exclusive().any(|idx| {
      let n = &self.nodes[*idx];
      n == node_start
    }) {
      self.cycle = Some(to_root.into());
    }
  }
}

impl Node {
  fn from_goal<'tcx>(goal: &InspectGoal<'_, 'tcx>, _def_id: DefId) -> Self {
    let infcx = goal.infcx();
    let goal = goal.goal();
    Node::Goal {
      data: Goal::new(infcx, &goal),
    }
  }

  fn from_candidate<'tcx>(
    candidate: &InspectCandidate<'_, 'tcx>,
    _def_id: DefId,
  ) -> Self {
    use rustc_trait_selection::traits::solve::{
      inspect::ProbeKind, CandidateSource,
    };

    let can = match candidate.kind() {
      ProbeKind::Root { .. } => "root".into(),
      ProbeKind::NormalizedSelfTyAssembly => "normalized-self-ty-asm".into(),
      ProbeKind::UnsizeAssembly => "unsize-asm".into(),
      ProbeKind::CommitIfOk => "commit-if-ok".into(),
      ProbeKind::UpcastProjectionCompatibility => "upcase-proj-compat".into(),
      ProbeKind::MiscCandidate { .. } => "misc".into(),
      ProbeKind::TraitCandidate { source, .. } => match source {
        CandidateSource::BuiltinImpl(_built_impl) => "builtin".into(),
        CandidateSource::AliasBound => "alias-bound".into(),
        // The only two we really care about.
        CandidateSource::ParamEnv(_idx) => "param-env".into(),
        CandidateSource::Impl(def_id) => {
          Self::from_impl(candidate.infcx(), def_id)
        }
      },
    };

    Node::Candidate { data: can }
  }

  fn from_impl(infcx: &InferCtxt, def_id: DefId) -> Candidate {
    let tcx = infcx.tcx;
    // First, try to get a local Impl definition
    // XXX: in the future we can do away with this and just use the
    // impl ty, but I don't want to fully rely on that yet.
    tcx
      .hir()
      .get_if_local(def_id)
      .and_then(|item| match item {
        hir::Node::Item(hir::Item {
          kind: hir::ItemKind::Impl(impl_),
          ..
        }) => Some(Candidate::new_impl_hir(infcx, *impl_)),
        _ => None,
      })
      // Second, try to get an impl header from the def_id ty
      .or_else(|| {
        tcx
          .get_impl_header(def_id)
          .map(|header| Candidate::new_impl_header(infcx, &header))
      })
      // Third, scramble to find a suitable span, or some error string.
      .unwrap_or_else(|| {
        tcx
          .span_of_impl(def_id)
          .map(|sp| {
            tcx
              .sess
              .source_map()
              .span_to_snippet(sp)
              .unwrap_or_else(|_| "failed to find impl".to_string())
          })
          .unwrap_or_else(|symb| {
            format!("foreign impl from: {}", symb.as_str())
          })
          .into()
      })
  }

  fn from_result(result: &Result<solve::Certainty, NoSolution>) -> Self {
    Node::Result {
      data: result.pretty(),
    }
  }
}

impl<'tcx> ProofTreeVisitor<'tcx> for SerializedTreeVisitor {
  type BreakTy = !;

  fn visit_goal(
    &mut self,
    goal: &InspectGoal<'_, 'tcx>,
  ) -> ControlFlow<Self::BreakTy> {
    let infcx = goal.infcx();

    // TODO: we don't need to actually store/mark unnecessary roots atm.
    // The frontend doesn't use them, but eventually we will!
    // self.unnecessary_roots.insert(n);

    // Skip unnecessary predicates, but not the root goal.
    if self.root.is_some()
      && !matches!(
        infcx.guess_predicate_necessity(&goal.goal().predicate),
        ObligationNecessity::Yes
      )
    {
      return ControlFlow::Continue(());
    }

    let here_node = Node::from_goal(goal, self.def_id);
    let here_idx = self.nodes.push(here_node.clone());

    if self.root.is_none() {
      self.root = Some(here_idx);
    }

    if let Some(prev) = self.previous {
      self.topology.add(prev, here_idx);
    }

    // Check if there was an "overflow" from the freshly added node,
    // XXX: this is largely a HACK for right now; it ignores
    // how the solver actually works, and is ignorant of inference vars.
    self.check_for_cycle_from(here_idx);

    let prev = self.previous.clone();
    self.previous = Some(here_idx);

    for c in goal.candidates() {
      let here_candidate = Node::from_candidate(&c, self.def_id);
      let candidate_idx = self.nodes.push(here_candidate);

      let prev_idx = if c.is_informative_probe() {
        self.topology.add(here_idx, candidate_idx);
        self.previous = Some(candidate_idx);
        candidate_idx
      } else {
        here_idx
      };

      c.visit_nested(self)?;

      if self.topology.is_leaf(prev_idx) {
        let result = goal.result();
        let leaf = Node::from_result(&result);
        let leaf_idx = self.nodes.push(leaf);
        self.topology.add(prev_idx, leaf_idx);
        if !result.is_yes() {
          self.error_leaves.push(leaf_idx);
        }
      }
    }

    self.previous = prev;

    ControlFlow::Continue(())
  }
}

pub fn serialize_proof_tree<'tcx>(
  goal: solve::Goal<'tcx, Predicate<'tcx>>,
  infcx: &InferCtxt<'tcx>,
  def_id: DefId,
) -> Result<SerializedTree> {
  infcx.probe(|_| {
    let mut visitor = SerializedTreeVisitor::new(def_id);
    infcx.visit_proof_tree(goal, &mut visitor);
    visitor.into_tree()
  })
}
