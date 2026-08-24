function Tasks(){
const {Card,Checkbox,Badge,Tabs,Button}=window.PanchoOSDesignSystem_f5b116;
const [filter,setFilter]=React.useState("Todas");
const [tasks,setTasks]=React.useState([
{t:"Cerrar reporte IESS",sys:"IESS",done:true},
{t:"Llamada con Carlos — BrainTech",sys:"BrainTech",done:false},
{t:"Revisar métricas CODEIS Q3",sys:"CODEIS",done:false},
{t:"Preparar lanzamiento taskr",sys:"taskr",done:false},
{t:"Actualizar guías de marca",sys:"Personal",done:true}]);
const toggle=i=>setTasks(tasks.map((x,idx)=>idx===i?{...x,done:!x.done}:x));
const visible=filter==="Todas"?tasks:tasks.filter(x=>filter==="Pendientes"?!x.done:x.done);
return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"24px"}},
React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}},
React.createElement("h1",{style:{fontFamily:"var(--font-display)",fontWeight:700,fontSize:"28px",color:"var(--text-heading-dark)",margin:0}},"Tareas"),
React.createElement(Button,{variant:"primary",size:"sm"},"+ Nueva tarea")),
React.createElement(Tabs,{tabs:["Todas","Pendientes","Completadas"],active:filter,onChange:setFilter}),
React.createElement(Card,{padded:false},
React.createElement("div",{style:{display:"flex",flexDirection:"column"}},
visible.map((x,i)=>React.createElement("div",{key:x.t,style:{display:"flex",alignItems:"center",gap:"14px",padding:"16px 24px",borderBottom:"1px solid var(--border-dark)",opacity:x.done?0.5:1}},
React.createElement(Checkbox,{checked:x.done,onChange:()=>toggle(tasks.indexOf(x))}),
React.createElement("span",{style:{flex:1,fontFamily:"var(--font-body)",fontSize:"14px",color:"var(--text-body-dark)",textDecoration:x.done?"line-through":"none"}},x.t),
React.createElement(Badge,{tone:"neutral"},x.sys))))));
}
window.Tasks=Tasks;
