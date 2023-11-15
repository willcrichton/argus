use std::ops::ControlFlow;

use rustc_hir::{BodyId, FnSig};
use rustc_hir::def_id::DefId;
use rustc_hir_analysis::astconv::AstConv;
use rustc_hir_typeck::{FnCtxt, Inherited};
use rustc_infer::infer::InferCtxt;
use rustc_middle::ty::{TyCtxt, Predicate};

use rustc_trait_selection::solve::inspect::{ProofTreeVisitor, InspectGoal, ProofTreeInferCtxtExt};
use rustc_trait_selection::traits::{ObligationCtxt, FulfillmentError};
use rustc_trait_selection::traits::solve::{Goal, QueryInput};
use rustc_type_ir::Canonical;

use rustc_utils::mir::body::BodyExt;

use serde::Serialize;
use index_vec::IndexVec;


use super::*;

pub struct SerializedTreeVisitor {
    pub def_id: DefId,
    pub root: Option<ProofNodeIdx>,
    pub previous: Option<ProofNodeIdx>,
    pub nodes: IndexVec<ProofNodeIdx, String>,
    pub topology: TreeTopology<ProofNodeIdx>,
    pub error_leaves: Vec<ProofNodeIdx>,
    pub unnecessary_roots: Vec<ProofNodeIdx>,
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
            unnecessary_roots: Vec::default(),
        }
    }

    pub fn into_tree(self) -> Option<SerializedTree> {
        let SerializedTreeVisitor {
            root: Some(root),
            nodes,
            topology,
            error_leaves,
            ..
        } = self else {
            return None;
        };

        Some(SerializedTree {
            descr: TreeDescription { root, leaf: root, },
            nodes,
            error_leaves,
            topology,
        })
    }
}

impl SerializedTreeVisitor {
    /// Flag a goal as unnecessary iff:
    /// - it is not a `TraitPredicate`
    /// - it is `_: Sized` predicate.
    /// - ...
    fn flag_if_unnecessary(&self, goal: &InspectGoal) {
        // TODO
    }
}

impl ProofTreeVisitor<'_> for SerializedTreeVisitor {
    type BreakTy = !;

    fn visit_goal(
        &mut self,
        goal: &InspectGoal<'_, '_>
    ) -> ControlFlow<Self::BreakTy> {
        use pretty::{PrettyPrintExt, PrettyResultExt};

        let infcx = goal.infcx();

        self.flag_if_unnecessary(goal);

        let here_string = goal.goal().predicate.pretty(infcx, self.def_id);
        let here_idx = self.nodes.push(here_string.clone());

        if self.root.is_none() {
            self.root = Some(here_idx);
        }

        if let Some(prev) = self.previous {
            self.topology.add(prev, here_idx);
        }

        let prev = self.previous.clone();

        for c in goal.candidates() {
            let candidate_idx = self.nodes.push(here_string.clone());
            self.topology.add(here_idx, candidate_idx);
            self.previous = Some(candidate_idx);
            c.visit_nested(self)?;

            if self.topology.is_leaf(candidate_idx) {
                let result = goal.result();
                let leaf_string = result.pretty();
                let leaf_idx = self.nodes.push(leaf_string);
                self.topology.add(candidate_idx, leaf_idx);
                if !result.is_yes() {
                    self.error_leaves.push(leaf_idx);
                }
            }
        }

        self.previous = prev;

        ControlFlow::Continue(())
    }
}

pub fn serialize_proof_tree<'tcx>(goal: Goal<'tcx, Predicate<'tcx>>, infcx: &InferCtxt<'tcx>, def_id: DefId) -> Option<SerializedTree> {
    infcx.probe(|_| {
      let mut visitor = SerializedTreeVisitor::new(def_id);
      infcx.visit_proof_tree(goal, &mut visitor);
      visitor.into_tree()
  })
}
