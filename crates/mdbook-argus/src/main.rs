use std::{
  fs,
  ops::Range,
  path::{Path, PathBuf},
  process::{Command, Stdio},
};

use anyhow::{anyhow, ensure, Context, Result};
use block::ArgusBlock;
use mdbook_preprocessor_utils::{
  mdbook::preprocess::PreprocessorContext, Asset, HtmlElementBuilder,
  SimplePreprocessor,
};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tempfile::tempdir;

mod block;

mdbook_preprocessor_utils::asset_generator!("../js/");

const FRONTEND_ASSETS: [Asset; 2] =
  [make_asset!("panoptes.iife.js"), make_asset!("style.css")];

const TOOLCHAIN_TOML: &str = include_str!("../rust-toolchain.toml");

pub fn get_toolchain() -> Result<String> {
  let config: toml::Value = toml::from_str(TOOLCHAIN_TOML)?;
  Ok(
    config
      .get("toolchain")
      .context("Missing toolchain key")?
      .get("channel")
      .context("Missing channel key")?
      .as_str()
      .unwrap()
      .to_string(),
  )
}

struct ArgusPreprocessor {
  toolchain: String,
  target_libdir: PathBuf,
}

impl ArgusPreprocessor {
  fn new() -> Result<Self> {
    let run_and_get_output = |cmd: &mut Command| -> Result<String> {
      let output = cmd.output()?;
      ensure!(output.status.success(), "Command failed");
      let stdout = String::from_utf8(output.stdout)?;
      Ok(stdout.trim_end().to_string())
    };

    let toolchain = get_toolchain()?;
    let output = run_and_get_output(Command::new("rustup").args([
      "which",
      "--toolchain",
      &toolchain,
      "rustc",
    ]))?;
    let rustc = PathBuf::from(output);

    let output = run_and_get_output(
      Command::new(rustc).args(["--print", "target-libdir"]),
    )?;
    let target_libdir = PathBuf::from(output);

    Ok(ArgusPreprocessor {
      toolchain,
      target_libdir,
    })
  }

  fn run_argus(&self, block: &ArgusBlock) -> Result<String> {
    let tempdir = tempdir()?;
    let root = tempdir.path();
    let status = Command::new("cargo")
      .args(["new", "--bin", "example"])
      .current_dir(root)
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .status()?;
    ensure!(status.success(), "Cargo failed");

    let crate_root = root.join("example");
    fs::write(crate_root.join("src/main.rs"), &block.code)?;

    let mut cmd = Command::new("cargo");
    cmd
      .args([&format!("+{}", self.toolchain), "argus", "bundle"])
      .env("DYLD_LIBRARY_PATH", &self.target_libdir)
      .env("LD_LIBRARY_PATH", &self.target_libdir)
      .current_dir(crate_root);

    let child = cmd.stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
    let output = child.wait_with_output()?;
    ensure!(
      output.status.success(),
      "Argus failed for program:\n{}\nwith error:\n{}",
      block.code,
      String::from_utf8(output.stderr)?
    );

    let response = String::from_utf8(output.stdout)?;
    let response_json_res: Result<Vec<serde_json::Value>, String> =
      serde_json::from_str(&response)?;
    let response_json = response_json_res.map_err(|e| anyhow!("{e}"))?;

    let bodies = response_json
      .iter()
      .map(|obj| obj.as_object().unwrap().get("body").unwrap().clone())
      .collect::<Vec<_>>();
    let config = json!({
      "type": "WEB_BUNDLE",
      "closedSystem": response_json,
      "data": [("main.rs", bodies)]
    });

    Ok(serde_json::to_string(&config)?)
  }

  fn process_code(&self, block: ArgusBlock) -> Result<String> {
    let config = self.run_argus(&block)?;

    let mut element = HtmlElementBuilder::new("argus-embed");
    element.data("config", config)?;
    element.finish()
  }
}

impl SimplePreprocessor for ArgusPreprocessor {
  fn name() -> &'static str {
    "argus"
  }

  fn build(ctx: &PreprocessorContext) -> Result<Self> {
    ArgusPreprocessor::new()
  }

  fn replacements(
    &self,
    chapter_dir: &Path,
    content: &str,
  ) -> Result<Vec<(Range<usize>, String)>> {
    ArgusBlock::parse_all(content)
      .into_par_iter()
      .map(|(range, block)| {
        let html = self.process_code(block)?;
        Ok((range, html))
      })
      .collect()
  }

  fn linked_assets(&self) -> Vec<Asset> {
    FRONTEND_ASSETS.to_vec()
  }

  fn all_assets(&self) -> Vec<Asset> {
    self.linked_assets()
  }

  fn finish(self) {}
}

fn main() {
  mdbook_preprocessor_utils::main::<ArgusPreprocessor>()
}
