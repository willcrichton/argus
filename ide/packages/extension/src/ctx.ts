import {
  CharRange,
  Obligation,
  ObligationHash,
  ObligationsInBody,
  SerializedTree,
} from "@argus/common/bindings";
import {
  ArgusArgs,
  ArgusResult,
  Filename,
  ObligationOutput,
  TreeOutput,
} from "@argus/common/lib";
import _ from "lodash";
import * as vscode from "vscode";

import {
  ambigErrorDecorate,
  rangeHighlight,
  traitErrorDecorate,
} from "./decorate";
import { showErrorDialog } from "./errors";
import { setup } from "./setup";
import {
  RustEditor,
  isDocumentInWorkspace,
  isRustDocument,
  isRustEditor,
  rustRangeToVscodeRange,
} from "./utils";
import { View } from "./view";

// NOTE: much of this file was inspired (or taken) from the rust-analyzer extension.
// See: https://github.com/rust-lang/rust-analyzer/blob/master/editors/code/src/ctx.ts#L1

export type Workspace =
  | { kind: "empty" }
  | { kind: "workspace-folder" }
  | { kind: "detached-files"; files: vscode.TextDocument[] };

export function fetchWorkspace(): Workspace {
  const folders = (vscode.workspace.workspaceFolders || []).filter(
    folder => folder.uri.scheme === "file"
  );
  const rustDocuments = vscode.workspace.textDocuments.filter(document =>
    isRustDocument(document)
  );

  return folders.length === 0
    ? rustDocuments.length === 0
      ? { kind: "empty" }
      : {
          kind: "detached-files",
          files: rustDocuments,
        }
    : { kind: "workspace-folder" };
}

export interface Disposable {
  dispose(): void;
}

export type Cmd = (...args: any[]) => unknown;

export type CommandFactory = {
  enabled: (ctx: CtxInit) => Cmd;
  // disabled?: (ctx: Ctx) => Cmd;
};

// We can modify this if the initializations state changes.
export type CtxInit = Ctx;

type CallBackend = <T>(
  _args: ArgusArgs,
  _noOutput?: boolean
) => Promise<ArgusResult<T>>;

export class Ctx {
  // Ranges used for highlighting code in the current Rust Editor.
  private highlightRanges: CharRange[] = [];
  private commandDisposables: Disposable[];
  private commandFactories: Record<string, CommandFactory>;
  private workspace: Workspace;
  private errorCollection;
  private cache: BackendCache;
  public view: View | undefined;

  constructor(
    readonly extCtx: vscode.ExtensionContext,
    commandFactories: Record<string, CommandFactory>,
    workspace: Workspace
  ) {
    this.commandDisposables = [];
    this.commandFactories = commandFactories;
    this.workspace = workspace;
    this.errorCollection = vscode.languages.createDiagnosticCollection("argus");
    this.cache = new BackendCache(async () => {
      showErrorDialog(`
        Argus backend left uninitialized.
      `);
      return {
        type: "analysis-error",
        error: "Argus uninitialized.",
      };
    });
  }

  dispose() {
    // TODO: all disposables should be disposed of here.
    _.forEach(this.commandDisposables, d => d.dispose());
  }

  async createOrShowView() {
    if (this.view) {
      this.view.panel.reveal();
    } else {
      const initialData = await this.getFreshWebViewData();
      this.view = new View(this.extCtx.extensionUri, initialData);
    }
  }

  get activeRustEditor(): RustEditor | undefined {
    let editor = vscode.window.activeTextEditor;
    return editor && isRustEditor(editor) ? editor : undefined;
  }

  get extensionPath(): string {
    return this.extCtx.extensionPath;
  }

  async setupBackend() {
    let b = await setup(this);
    if (b == null) {
      showErrorDialog("Failed to setup Argus");
      return;
    }
    // TODO: add some sort of "status loading" indicator.
    // Compile the workspace with the Argus version of rustc.
    await b(["preload"], true);
    this.cache = new BackendCache(b);

    // Register the commands with VSCode after the backend is setup.
    this.updateCommands();

    vscode.window.onDidChangeActiveTextEditor(async editor => {
      if (
        editor &&
        isRustEditor(editor) &&
        isDocumentInWorkspace(editor.document)
      ) {
        // Load the obligations in the file, while we have the editor.
        const obl = await this.loadObligations(editor);
        if (obl) {
          return this.view?.openEditor(editor, obl);
        }
      }
    });

    vscode.workspace.onDidSaveTextDocument(async document => {
      const editor = vscode.window.activeTextEditor;
      if (
        editor &&
        isRustEditor(editor) &&
        editor.document === document &&
        isDocumentInWorkspace(editor.document)
      ) {
        this.cache.havoc();
        this.view!.reset(await this.getFreshWebViewData());
      }
    });
  }

  get visibleEditors(): RustEditor[] {
    return _.filter(vscode.window.visibleTextEditors, isRustEditor);
  }

  private findVisibleEditorByName(name: Filename): RustEditor | undefined {
    return _.find(this.visibleEditors, e => e.document.fileName === name);
  }

  // Here we load the obligations for a file, and cache the results,
  // there's a distinction between having an editor and not because
  // we only have definitive access to the editor when it's visible.
  private async loadObligations(editor: RustEditor) {
    const obligations = await this.cache.getObligationsInBody(
      editor.document.fileName
    );
    if (obligations === undefined) {
      return;
    }
    this.registerBodyInfo(editor, obligations);
    return obligations;
  }

  async getObligations(filename: Filename) {
    return this.cache.getObligationsInBody(filename);
  }

  async getTree(filename: Filename, obligation: Obligation, range: CharRange) {
    return this.cache.getTreeForObligation(filename, obligation, range);
  }

  // TODO: this isn't updated to the new ambiguity / error boundaries cases.
  private registerBodyInfo(editor: RustEditor, info: ObligationsInBody[]) {
    this.setTraitErrors(editor, info);
    this.setAmbiguityErrors(editor, info);
  }

  // ------------------------------------
  // Diagnostic helpers

  private setTraitErrors(editor: RustEditor, oib: ObligationsInBody[]) {
    editor.setDecorations(
      traitErrorDecorate,
      _.flatMap(oib, (ob, bodyIdx) => {
        return _.map(ob.traitErrors, (e, errIdx) => ({
          range: rustRangeToVscodeRange(ob.exprs[e].range),
          hoverMessage: this.buildOpenErrorItemCmd(
            editor.document.fileName,
            bodyIdx,
            errIdx,
            "trait"
          ),
        }));
      })
    );
  }

  private setAmbiguityErrors(editor: RustEditor, oib: ObligationsInBody[]) {
    editor.setDecorations(
      ambigErrorDecorate,
      _.flatMap(oib, (ob, bodyIdx) => {
        return _.map(ob.ambiguityErrors, (e, errIdx) => ({
          range: rustRangeToVscodeRange(ob.exprs[e].range),
          hoverMessage: this.buildOpenErrorItemCmd(
            editor.document.fileName,
            bodyIdx,
            errIdx,
            "ambig"
          ),
        }));
      })
    );
  }

  private buildOpenErrorItemCmd(
    filename: Filename,
    bodyIdx: number,
    errorIdx: number,
    type: "trait" | "ambig"
  ): string {
    // TODO: the webview needs to add a signal for opening an error expression.
    // const blingCommandUri = vscode.Uri.parse(
    //   `command:argus.openError?${encodeURIComponent(
    //     JSON.stringify([filename, type, bodyIdx, errorIdx])
    //   )}`
    // );
    return "This is an error — Argus"; // `[Debug error in window](${blingCommandUri})`;
  }

  async addHighlightRange(filename: Filename, range: CharRange) {
    const editor = this.findVisibleEditorByName(filename);
    if (editor) {
      this.highlightRanges.push(range);
      await this._refreshHighlights(editor);
    }
  }

  async removeHighlightRange(filename: Filename, range: CharRange) {
    const editor = this.findVisibleEditorByName(filename);
    if (editor) {
      this.highlightRanges = _.filter(
        this.highlightRanges,
        r => !_.isEqual(r, range)
      );
      await this._refreshHighlights(editor);
    }
  }

  private async _refreshHighlights(editor: RustEditor) {
    editor.setDecorations(
      rangeHighlight,
      _.map(this.highlightRanges, r => rustRangeToVscodeRange(r))
    );
  }

  private async getFreshWebViewData(): Promise<
    [Filename, ObligationOutput[]][]
  > {
    const initialData = await Promise.all(
      _.map(this.visibleEditors, async e => [
        e.document.fileName,
        await this.cache.getObligationsInBody(e.document.fileName),
      ])
    );
    // FIXME: how to make TS figure this out?
    return _.filter(initialData, ([_, obl]) => obl !== undefined) as any;
  }

  private updateCommands() {
    this.commandDisposables.forEach(disposable => disposable.dispose());
    this.commandDisposables = [];
    for (const [name, factory] of Object.entries(this.commandFactories)) {
      const fullName = `argus.${name}`;
      let callback = factory.enabled(this);
      this.commandDisposables.push(
        vscode.commands.registerCommand(fullName, callback)
      );
    }
  }
}

class BackendCache {
  private obligationCache: Record<Filename, ObligationsInBody[]>;
  private treeCache: Record<Filename, Record<ObligationHash, SerializedTree>>;
  private backend: CallBackend;

  constructor(backend: CallBackend) {
    this.obligationCache = {};
    this.treeCache = {};
    this.backend = backend;
  }

  havoc() {
    this.obligationCache = {};
    this.treeCache = {};
  }

  async getObligationsInBody(filename: Filename) {
    if (this.obligationCache[filename] !== undefined) {
      return this.obligationCache[filename];
    }

    const res = await this.backend<ObligationOutput[]>([
      "obligations",
      filename,
    ]);

    if (res.type !== "output") {
      showErrorDialog(res.error);
      return;
    }

    this.obligationCache[filename] = res.value;
    return res.value;
  }

  async getTreeForObligation(
    filename: Filename,
    obl: Obligation,
    range: CharRange
  ) {
    if (this.treeCache[filename] !== undefined) {
      if (this.treeCache[filename][obl.hash] !== undefined) {
        return this.treeCache[filename][obl.hash];
      }
    } else {
      this.treeCache[filename] = {};
    }

    const res = await this.backend<TreeOutput[]>([
      "tree",
      filename,
      obl.hash,
      range.start.line,
      range.start.column,
      range.end.line,
      range.end.column,
      obl.isSynthetic,
    ]);

    if (res.type !== "output") {
      showErrorDialog(res.error);
      return;
    }

    // NOTE: the returned value should be an array of a single tree, however,
    // it is possible that no tree is returned. (Yes, but I'm working on it.)
    const tree = _.filter(res.value, t => t !== undefined) as Array<
      SerializedTree | undefined
    >;

    const tree0 = tree[0];
    if (tree0 === undefined) {
      return;
    }

    this.treeCache[filename][obl.hash] = tree0;
    return tree0;
  }
}
