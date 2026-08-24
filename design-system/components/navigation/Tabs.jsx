import React from "react";
export function Tabs({tabs=[],active,onChange}){
return React.createElement("div",{style:{display:"flex",gap:"4px",borderBottom:"1px solid var(--border-dark)"}},
tabs.map(t=>React.createElement("button",{key:t,onClick:()=>onChange&&onChange(t),
style:{background:"transparent",border:"none",cursor:"pointer",padding:"10px 16px",fontFamily:"var(--font-body)",fontWeight:500,fontSize:"14px",color:t===active?"var(--text-heading-dark)":"var(--text-muted-dark)",borderBottom:t===active?"2px solid var(--accent)":"2px solid transparent",transition:"color var(--duration-fast) var(--ease-standard)"}},t)));
}
