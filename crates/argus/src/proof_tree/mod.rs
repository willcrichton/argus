pub mod topology;
pub mod pretty;
#[macro_use]
mod macros;
pub(super) mod serialize;

use std::collections::HashSet;
use rustc_infer::traits::FulfilledObligation;
use rustc_utils::source_map::range::CharRange;

pub use topology::*;

use index_vec::IndexVec;
use ts_rs::TS;
use serde::{Serialize};

crate::define_usize_idx! {
    ProofNodeIdx
}

#[derive(TS, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Node {
    Result { data: String },
    Goal { data: String },
    Candidate { data: String },
}

#[derive(TS, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SerializedTree {
    pub root: ProofNodeIdx,
    pub nodes: IndexVec<ProofNodeIdx, Node>,
    pub topology: TreeTopology<ProofNodeIdx>,
    pub error_leaves: Vec<ProofNodeIdx>,
    pub unnecessary_roots: HashSet<ProofNodeIdx>,
}

#[derive(TS, Serialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum Obligation {
  Success {
    range: CharRange,
    data: String,
  },
  Failure {
    range: CharRange,
    data: String,
  },
}
