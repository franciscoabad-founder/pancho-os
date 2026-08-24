import React from "react";
export function Tooltip({label,children}){
const [show,setShow]=React.useState(false);
return React.createElement("span",{style:{position:"relative",display:"inline-flex"},onMouseEnter:()=>setShow(true),onMouseLeave:()=>setShow(false)},
children,
show&&React.createElement("span",{style:{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",background:"var(--charcoal)",color:"#fff",fontSize:"12px",padding:"6px 10px",borderRadius:"var(--radius-sm)",whiteSpace:"nowrap",fontFamily:"var(--font-body)"}},label));
}
