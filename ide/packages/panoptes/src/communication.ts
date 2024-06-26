import { BodyBundle } from "@argus/common/bindings";
import {
  PanoptesToSystemCmds,
  PanoptesToSystemMsg,
  SystemReturn,
  isPanoMsgTree,
} from "@argus/common/lib";
import { messageHandler } from "@estruyf/vscode/dist/client";
import _ from "lodash";

import { rangeContains } from "./utilities/func";

export interface MessageSystem {
  postData<T extends PanoptesToSystemCmds>(body: PanoptesToSystemMsg<T>): void;

  requestData<T extends PanoptesToSystemCmds>(
    body: PanoptesToSystemMsg<T>
  ): Promise<SystemReturn<T>>;
}

export const vscodeMessageSystem: MessageSystem = {
  postData<T extends PanoptesToSystemCmds>(body: PanoptesToSystemMsg<T>) {
    return messageHandler.send(body.command, body);
  },

  requestData<T extends PanoptesToSystemCmds>(body: PanoptesToSystemMsg<T>) {
    return messageHandler.request<SystemReturn<T>>(body.command, body);
  },
};

export function createClosedMessageSystem(bodies: BodyBundle[]): MessageSystem {
  const systemMap = _.groupBy(bodies, bundle => bundle.filename);
  return {
    postData<T extends PanoptesToSystemCmds>(_body: PanoptesToSystemMsg<T>) {
      // Intentionally blank, no system to post to.
    },

    requestData<T extends PanoptesToSystemCmds>(body: PanoptesToSystemMsg<T>) {
      return new Promise<SystemReturn<T>>((resolve, reject) => {
        if (!isPanoMsgTree(body)) {
          return reject(new Error(`"Invalid message type" ${body.command}`));
        }

        const rangesInFile = systemMap[body.file];
        if (rangesInFile === undefined) {
          return reject(
            new Error(`file messages not found for '${body.file}'`)
          );
        }

        const obligationRange = body.range;
        const foundBodies = _.filter(rangesInFile, bundle =>
          rangeContains(bundle.body.range, obligationRange)
        );
        if (foundBodies.length == 0) {
          return reject(new Error(`body in range ${body.range} not found`));
        }

        const tree = _.head(
          _.compact(
            _.map(foundBodies, found => found.trees[body.predicate.hash])
          )
        );
        if (tree === undefined) {
          console.error("Body", foundBodies, "hash", body.predicate.hash);
          return reject(new Error(`Obligation hash not found in maps`));
        }

        const treeReturn = { tree } as SystemReturn<"tree">;
        resolve(treeReturn as SystemReturn<T>);
      });
    },
  };
}
