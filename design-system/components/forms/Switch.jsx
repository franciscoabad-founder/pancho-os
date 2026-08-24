import React from "react";
export function Switch({checked=false,onChange}){
return React.createElement("span",{onClick:()=>onChange&&onChange(!checked),
style:{width:"38px",height:"22px",borderRadius:"var(--radius-pill)",background:checked?"var(--accent)":"var(--border-dark)",position:"relative",cursor:"pointer",display:"inline-block",transition:"background var(--duration-fast) var(--ease-standard)"}},
React.createElement("span",{style:{position:"absolute",top:"3px",left:checked?"19px":"3px",width:"16px",height:"16px",borderRadius:"50%",background:"#fff",transition:"left var(--duration-fast) var(--ease-standard)"}}));
}
