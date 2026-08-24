function Sidebar({active,onChange}){
const items=[["Hoy","dashboard"],["Tareas","tasks"],["Hábitos & Salud","habits"],["Finanzas","finance"]];
return React.createElement("div",{style:{width:"220px",background:"var(--ink)",borderRight:"1px solid var(--border-dark)",display:"flex",flexDirection:"column",padding:"28px 0",flexShrink:0}},
React.createElement("div",{style:{padding:"0 24px 28px",fontFamily:"var(--font-body)"}},
React.createElement("span",{style:{fontWeight:200,letterSpacing:"var(--tracking-wordmark-light)",fontSize:"11px",color:"rgba(250,250,247,.45)"}},"FRANCISCO "),
React.createElement("span",{style:{fontWeight:900,letterSpacing:"var(--tracking-wordmark-bold)",fontSize:"14px",color:"var(--accent)"}},"OS")),
items.map(([label,key])=>React.createElement("div",{key,onClick:()=>onChange(key),
style:{padding:"12px 24px",fontFamily:"var(--font-body)",fontSize:"14px",fontWeight:500,cursor:"pointer",color:active===key?"var(--text-heading-dark)":"var(--text-muted-dark)",borderLeft:active===key?"2px solid var(--accent)":"2px solid transparent",background:active===key?"rgba(59,78,217,0.08)":"transparent"}},label)),
React.createElement("div",{style:{marginTop:"auto",padding:"16px 24px",fontSize:"11px",color:"var(--text-muted-dark)",letterSpacing:"var(--tracking-label)",textTransform:"uppercase"}},"Hermes activo · MCP"));
}
window.Sidebar=Sidebar;
