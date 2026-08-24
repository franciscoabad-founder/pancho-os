import React from "react";
export function Badge({tone="accent",children}){
const tones={accent:{background:"rgba(59,78,217,0.15)",color:"var(--accent-hover)"},metric:{background:"rgba(181,152,90,0.15)",color:"var(--metric)"},neutral:{background:"rgba(232,234,240,0.1)",color:"var(--text-body-dark)"}};
return React.createElement("span",{style:{display:"inline-flex",alignItems:"center",padding:"4px 10px",borderRadius:"var(--radius-pill)",fontSize:"12px",fontWeight:500,letterSpacing:"var(--tracking-label)",fontFamily:"var(--font-body)",...tones[tone]}},children);
}
