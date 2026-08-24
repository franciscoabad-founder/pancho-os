import React from "react";
export function ProgressBar({value=0,tone="accent"}){
const color=tone==="metric"?"var(--metric)":"var(--accent)";
return React.createElement("div",{style:{width:"100%",height:"6px",borderRadius:"var(--radius-pill)",background:"var(--border-dark)"}},
React.createElement("div",{style:{width:`${Math.min(100,value)}%`,height:"100%",borderRadius:"var(--radius-pill)",background:color,transition:"width var(--duration-standard) var(--ease-standard)"}}));
}
