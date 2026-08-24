import React from "react";
export function Dialog({open,title,children,onClose}){
if(!open)return null;
return React.createElement("div",{style:{position:"fixed",inset:0,background:"rgba(14,23,56,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}},
React.createElement("div",{style:{background:"var(--surface-card-dark)",borderRadius:"var(--radius-lg)",padding:"28px",minWidth:"320px",maxWidth:"480px",boxShadow:"var(--shadow-card-dark)",fontFamily:"var(--font-body)"}},
React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}},
React.createElement("h3",{style:{color:"var(--text-heading-dark)",fontWeight:700,fontSize:"19px",margin:0}},title),
React.createElement("span",{onClick:onClose,style:{cursor:"pointer",color:"var(--text-muted-dark)",fontSize:"18px"}},"×")),
React.createElement("div",{style:{color:"var(--text-body-dark)",fontSize:"14px",lineHeight:"var(--line-body)"}},children)));
}
