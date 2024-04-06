use std::path::Path;

use anyhow::Result;

const SRC_DIR: &str = "../../ide/packages/panoptes/dist/";
const DST_DIR: &str = "./js";

fn main() -> Result<()> {
  mdbook_preprocessor_utils::copy_assets(Path::new(SRC_DIR), Path::new(DST_DIR))
}
