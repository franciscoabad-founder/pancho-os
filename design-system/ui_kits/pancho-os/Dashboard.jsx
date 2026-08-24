function Dashboard(){
const {Card,MetricCard,Badge,ProgressBar,Checkbox,Button}=window.PanchoOSDesignSystem_f5b116;
const [tasks,setTasks]=React.useState([{t:"Cerrar reporte IESS",done:true},{t:"Llamada con Carlos — BrainTech",done:false},{t:"Revisar métricas CODEIS Q3",done:false}]);
const toggle=i=>setTasks(tasks.map((x,idx)=>idx===i?{...x,done:!x.done}:x));
return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"32px"}},
React.createElement("div",null,
React.createElement("h1",{style:{fontFamily:"var(--font-display)",fontWeight:700,fontSize:"28px",color:"var(--text-heading-dark)",margin:"0 0 4px"}},"Hoy"),
React.createElement("p",{style:{fontFamily:"var(--font-body)",fontSize:"14px",color:"var(--text-muted-dark)",margin:0}},"Domingo 24 de agosto")),
React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"16px"}},
React.createElement(Card,null,React.createElement(MetricCard,{label:"Eficiencia semanal",value:"78%",delta:"+6pp"})),
React.createElement(Card,null,React.createElement(MetricCard,{label:"Racha hábitos",value:"12 días"})),
React.createElement(Card,null,React.createElement(MetricCard,{label:"Tareas hoy",value:"3"})),
React.createElement(Card,null,React.createElement(MetricCard,{label:"Runway",value:"14 meses"}))),
React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:"20px"}},
React.createElement(Card,null,
React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}},
React.createElement("h3",{style:{fontFamily:"var(--font-display)",fontWeight:700,fontSize:"16px",color:"var(--text-heading-dark)",margin:0}},"Tareas prioritarias"),
React.createElement(Badge,{tone:"accent"},"3 pendientes")),
React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"14px"}},
tasks.map((x,i)=>React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",gap:"10px",opacity:x.done?0.5:1}},
React.createElement(Checkbox,{checked:x.done,onChange:()=>toggle(i)}),
React.createElement("span",{style:{fontFamily:"var(--font-body)",fontSize:"14px",color:"var(--text-body-dark)",textDecoration:x.done?"line-through":"none"}},x.t))))),
React.createElement(Card,null,
React.createElement("h3",{style:{fontFamily:"var(--font-display)",fontWeight:700,fontSize:"16px",color:"var(--text-heading-dark)",margin:"0 0 16px"}},"Agenda"),
React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"12px",fontFamily:"var(--font-body)",fontSize:"13px"}},
[["09:00","Standup CODEIS"],["11:30","Sesión de estrategia — taskr"],["16:00","Revisión financiera BrainTech"]].map(([h,t])=>
React.createElement("div",{key:h,style:{display:"flex",gap:"12px"}},
React.createElement("span",{style:{color:"var(--accent-hover)",fontWeight:500,minWidth:"44px"}},h),
React.createElement("span",{style:{color:"var(--text-body-dark)"}},t)))))),
React.createElement(Card,null,
React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}},
React.createElement("h3",{style:{fontFamily:"var(--font-display)",fontWeight:700,fontSize:"16px",color:"var(--text-heading-dark)",margin:0}},"Hermes — segundo cerebro"),
React.createElement(Button,{variant:"ghost",size:"sm"},"Abrir agente")),
React.createElement("p",{style:{fontFamily:"var(--font-body)",fontSize:"13px",color:"var(--text-muted-dark)",margin:0,maxWidth:"520px"}},"Última sincronización hace 4 minutos vía MCP. Hermes actualizó 2 tareas y registró 1 hábito desde el calendario.")));
}
window.Dashboard=Dashboard;
