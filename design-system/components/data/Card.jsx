import React from "react";
export function Card({children,padded=true}){
return React.createElement("div",{style:{background:"var(--surface-card-dark)",borderRadius:"var(--radius-lg)",border:"1px solid var(--border-dark)",boxShadow:"var(--shadow-card-dark)",padding:padded?"24px":0}},children);
}
