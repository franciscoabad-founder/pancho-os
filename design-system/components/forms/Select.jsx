import React from "react";
export function Select({label,options=[],value,onChange}){
return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"6px",fontFamily:"var(--font-body)"}},
label&&React.createElement("label",{style:{fontSize:"13px",fontWeight:500,letterSpacing:"var(--tracking-label)",color:"var(--text-muted-dark)"}},label),
React.createElement("select",{value,onChange,
style:{background:"var(--surface-card-dark)",border:"1px solid var(--border-dark)",borderRadius:"var(--radius-md)",padding:"11px 14px",color:"var(--text-heading-dark)",fontSize:"14px",fontFamily:"inherit",outline:"none"}},
options.map(o=>React.createElement("option",{key:o,value:o},o))));
}
