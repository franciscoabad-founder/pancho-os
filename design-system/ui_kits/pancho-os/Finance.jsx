function Finance(){
const {Card,MetricCard,Badge}=window.PanchoOSDesignSystem_f5b116;
const rows=[["IESS (cierre)","Ingreso","+USD 4.200","2026-08-01"],["BrainTech","Ingreso","+USD 8.600","2026-08-05"],["CODEIS Academy","Gasto operativo","-USD 1.150","2026-08-11"],["Personal","Gasto fijo","-USD 2.300","2026-08-15"]];
return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"24px"}},
React.createElement("h1",{style:{fontFamily:"var(--font-display)",fontWeight:700,fontSize:"28px",color:"var(--text-heading-dark)",margin:0}},"Finanzas"),
React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"16px"}},
React.createElement(Card,null,React.createElement(MetricCard,{label:"Runway",value:"14 meses"})),
React.createElement(Card,null,React.createElement(MetricCard,{label:"Ingresos del mes",value:"+USD 12.800",delta:"+9% vs julio"})),
React.createElement(Card,null,React.createElement(MetricCard,{label:"Gasto fijo",value:"USD 3.450"}))),
React.createElement(Card,{padded:false},
React.createElement("table",{style:{width:"100%",borderCollapse:"collapse",fontFamily:"var(--font-body)",fontSize:"13px"}},
React.createElement("thead",null,React.createElement("tr",null,
["Sistema","Tipo","Monto","Fecha"].map(h=>React.createElement("th",{key:h,style:{textAlign:"left",padding:"14px 24px",color:"var(--text-muted-dark)",fontWeight:500,letterSpacing:"var(--tracking-label)",textTransform:"uppercase",fontSize:"11px",borderBottom:"1px solid var(--border-dark)"}},h)))),
React.createElement("tbody",null,
rows.map(r=>React.createElement("tr",{key:r[0]},
React.createElement("td",{style:{padding:"14px 24px",color:"var(--text-body-dark)",borderBottom:"1px solid var(--border-dark)"}},r[0]),
React.createElement("td",{style:{padding:"14px 24px",borderBottom:"1px solid var(--border-dark)"}},React.createElement(Badge,{tone:"neutral"},r[1])),
React.createElement("td",{style:{padding:"14px 24px",fontWeight:700,color:r[2][0]==="+"?"var(--metric)":"var(--text-body-dark)",borderBottom:"1px solid var(--border-dark)"}},r[2]),
React.createElement("td",{style:{padding:"14px 24px",color:"var(--text-muted-dark)",borderBottom:"1px solid var(--border-dark)"}},r[3])))))));
}
window.Finance=Finance;
