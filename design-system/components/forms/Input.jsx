import React from "react";
export function Input({label,placeholder="",value,onChange,type="text",error=""}){
const [focus,setFocus]=React.useState(false);
return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"6px",fontFamily:"var(--font-body)"}},
label&&React.createElement("label",{style:{fontSize:"13px",fontWeight:500,letterSpacing:"var(--tracking-label)",color:"var(--text-muted-dark)"}},label),
React.createElement("input",{type,placeholder,value,onChange,onFocus:()=>setFocus(true),onBlur:()=>setFocus(false),
style:{background:"var(--surface-card-dark)",border:`1px solid ${error?"#C24A4A":focus?"var(--accent)":"var(--border-dark)"}`,borderRadius:"var(--radius-md)",padding:"11px 14px",color:"var(--text-heading-dark)",fontSize:"14px",fontFamily:"inherit",outline:"none",transition:"border-color var(--duration-fast) var(--ease-standard)"}}),
error&&React.createElement("span",{style:{fontSize:"12px",color:"#C24A4A"}},error));
}
