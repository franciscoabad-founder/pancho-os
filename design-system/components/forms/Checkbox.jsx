import React from "react";
export function Checkbox({label,checked=false,onChange}){
return React.createElement("label",{style:{display:"inline-flex",alignItems:"center",gap:"10px",cursor:"pointer",fontFamily:"var(--font-body)",fontSize:"14px",color:"var(--text-body-dark)"}},
React.createElement("span",{onClick:()=>onChange&&onChange(!checked),
style:{width:"18px",height:"18px",borderRadius:"4px",border:`1.5px solid ${checked?"var(--accent)":"var(--border-dark)"}`,background:checked?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all var(--duration-fast) var(--ease-standard)"}},
checked&&React.createElement("span",{style:{width:"8px",height:"8px",background:"#fff",borderRadius:"1px"}})),
label);
}
