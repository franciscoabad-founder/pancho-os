import React from "react";
export function MetricCard({label,value,delta=""}){
return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"4px",fontFamily:"var(--font-body)"}},
React.createElement("span",{style:{fontWeight:900,fontSize:"var(--size-metric-md)",color:"var(--metric)",lineHeight:"var(--line-tight)"}},value),
React.createElement("span",{style:{fontSize:"12px",letterSpacing:"var(--tracking-label)",textTransform:"uppercase",color:"var(--text-muted-dark)"}},label),
delta&&React.createElement("span",{style:{fontSize:"12px",color:"var(--accent-hover)"}},delta));
}
