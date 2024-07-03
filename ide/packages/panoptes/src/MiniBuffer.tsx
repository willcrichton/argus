import { TyCtxt } from "@argus/print/context";
import { PrintDefPathFull } from "@argus/print/lib";
import { observer } from "mobx-react";
import React from "react";

import { IcoPinned } from "@argus/print/Icons";
import { MiniBufferDataStore } from "./signals";
import "./MiniBuffer.css";

const MiniBuffer = observer(() => {
  const data = MiniBufferDataStore.data;
  if (data === undefined) {
    return null;
  }

  const unpinClick = () => MiniBufferDataStore.unpin();
  const heading = data.kind === "path" ? <h2>Definition Path</h2> : null;
  const pinned = data.pinned ? <IcoPinned onClick={unpinClick} /> : null;

  return (
    <>
      <div id="MiniBuffer">
        {pinned}
        {heading}
        <div className="Data">
          <TyCtxt.Provider value={data.ctx}>
            <PrintDefPathFull defPath={data.path} />
          </TyCtxt.Provider>
        </div>
      </div>
      <div className="spacer">{"\u00A0"}</div>
    </>
  );
});

export default MiniBuffer;
