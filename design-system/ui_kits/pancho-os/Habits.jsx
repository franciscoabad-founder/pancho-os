function Habits(){
const {Card,MetricCard,ProgressBar,Switch}=window.PanchoOSDesignSystem_f5b116;
const [habits,setHabits]=React.useState([
{name:"Lectura",pct:62,reminder:true},
{name:"Entrenamiento",pct:88,reminder:true},
{name:"Meditación",pct:40,reminder:false},
{name:"Journaling",pct:71,reminder:true}]);
const toggle=i=>setHabits(habits.map((h,idx)=>idx===i?{...h,reminder:!h.reminder}:h));
return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"24px"}},
React.createElement("h1",{style:{fontFamily:"var(--font-display)",fontWeight:700,fontSize:"28px",color:"var(--text-heading-dark)",margin:0}},"Hábitos & Salud"),
React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"16px"}},
React.createElement(Card,null,React.createElement(MetricCard,{label:"Racha activa",value:"12 días"})),
React.createElement(Card,null,React.createElement(MetricCard,{label:"Horas de sueño (prom.)",value:"7.2h"})),
React.createElement(Card,null,React.createElement(MetricCard,{label:"Frecuencia cardiaca reposo",value:"58 bpm"}))),
React.createElement(Card,null,
React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"20px"}},
habits.map((h,i)=>React.createElement("div",{key:h.name,style:{display:"grid",gridTemplateColumns:"140px 1fr 60px 90px",alignItems:"center",gap:"16px"}},
React.createElement("span",{style:{fontFamily:"var(--font-body)",fontSize:"14px",color:"var(--text-body-dark)",fontWeight:500}},h.name),
React.createElement(ProgressBar,{value:h.pct,tone:"metric"}),
React.createElement("span",{style:{fontFamily:"var(--font-body)",fontSize:"13px",color:"var(--metric)",fontWeight:700,textAlign:"right"}},h.pct+"%"),
React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"8px",justifySelf:"end"}},
React.createElement(Switch,{checked:h.reminder,onChange:()=>toggle(i)}),
React.createElement("span",{style:{fontFamily:"var(--font-body)",fontSize:"11px",color:"var(--text-muted-dark)"}},"recordatorio")))))));
}
window.Habits=Habits;
