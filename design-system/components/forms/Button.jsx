import React from "react";
export function Button({variant="primary",size="md",disabled=false,icon=null,children,onClick}){
const sizes={sm:{padding:"8px 14px",fontSize:"13px"},md:{padding:"12px 20px",fontSize:"14px"},lg:{padding:"15px 26px",fontSize:"16px"}};
const base={fontFamily:"var(--font-body)",fontWeight:500,borderRadius:"var(--radius-md)",border:"none",cursor:disabled?"default":"pointer",display:"inline-flex",alignItems:"center",gap:"8px",transition:"background var(--duration-fast) var(--ease-standard),color var(--duration-fast) var(--ease-standard),border-color var(--duration-fast) var(--ease-standard)",opacity:disabled?0.45:1,...sizes[size]};
const variants={
primary:{background:"var(--accent)",color:"#fff"},
secondary:{background:"var(--surface-card-dark)",color:"var(--text-heading-dark)",border:"1px solid var(--border-dark)"},
ghost:{background:"transparent",color:"var(--text-heading-dark)",border:"1px solid var(--border-dark)"},
metric:{background:"var(--metric)",color:"#fff"}
};
const [hover,setHover]=React.useState(false);
const hoverBg={primary:"var(--accent-hover)",metric:"var(--metric-hover)",secondary:"rgba(255,255,255,0.06)",ghost:"rgba(255,255,255,0.06)"};
const style={...base,...variants[variant],...(hover&&!disabled?{background:hoverBg[variant]}:{})};
return React.createElement("button",{style,disabled,onClick,onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false)},icon,children);
}
