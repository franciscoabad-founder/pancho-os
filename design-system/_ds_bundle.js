/* @ds-bundle: {"format":4,"namespace":"PanchoOSDesignSystem_f5b116","components":[{"name":"Card","sourcePath":"components/data/Card.jsx"},{"name":"MetricCard","sourcePath":"components/data/MetricCard.jsx"},{"name":"ProgressBar","sourcePath":"components/data/ProgressBar.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/data/Card.jsx":"6866e456a82c","components/data/MetricCard.jsx":"8f0b04205b11","components/data/ProgressBar.jsx":"211065a3eb3d","components/feedback/Badge.jsx":"fb2693cff073","components/feedback/Dialog.jsx":"456ac548c215","components/feedback/Tooltip.jsx":"4fa19e5749bf","components/forms/Button.jsx":"bf7019b2551f","components/forms/Checkbox.jsx":"f626841a4ab9","components/forms/Input.jsx":"60e57c276f33","components/forms/Select.jsx":"f3cd7489ea57","components/forms/Switch.jsx":"24f71816b770","components/navigation/Tabs.jsx":"d3e64c32b534","ui_kits/pancho-os/Dashboard.jsx":"5d1880d6705c","ui_kits/pancho-os/Finance.jsx":"99720310e8ab","ui_kits/pancho-os/Habits.jsx":"50c130efb05c","ui_kits/pancho-os/Sidebar.jsx":"8b995591ae98","ui_kits/pancho-os/Tasks.jsx":"ba7a2b271172"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PanchoOSDesignSystem_f5b116 = window.PanchoOSDesignSystem_f5b116 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data/Card.jsx
try { (() => {
function Card({
  children,
  padded = true
}) {
  return React.createElement("div", {
    style: {
      background: "var(--surface-card-dark)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border-dark)",
      boxShadow: "var(--shadow-card-dark)",
      padding: padded ? "24px" : 0
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/MetricCard.jsx
try { (() => {
function MetricCard({
  label,
  value,
  delta = ""
}) {
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      fontFamily: "var(--font-body)"
    }
  }, React.createElement("span", {
    style: {
      fontWeight: 900,
      fontSize: "var(--size-metric-md)",
      color: "var(--metric)",
      lineHeight: "var(--line-tight)"
    }
  }, value), React.createElement("span", {
    style: {
      fontSize: "12px",
      letterSpacing: "var(--tracking-label)",
      textTransform: "uppercase",
      color: "var(--text-muted-dark)"
    }
  }, label), delta && React.createElement("span", {
    style: {
      fontSize: "12px",
      color: "var(--accent-hover)"
    }
  }, delta));
}
Object.assign(__ds_scope, { MetricCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MetricCard.jsx", error: String((e && e.message) || e) }); }

// components/data/ProgressBar.jsx
try { (() => {
function ProgressBar({
  value = 0,
  tone = "accent"
}) {
  const color = tone === "metric" ? "var(--metric)" : "var(--accent)";
  return React.createElement("div", {
    style: {
      width: "100%",
      height: "6px",
      borderRadius: "var(--radius-pill)",
      background: "var(--border-dark)"
    }
  }, React.createElement("div", {
    style: {
      width: `${Math.min(100, value)}%`,
      height: "100%",
      borderRadius: "var(--radius-pill)",
      background: color,
      transition: "width var(--duration-standard) var(--ease-standard)"
    }
  }));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
function Badge({
  tone = "accent",
  children
}) {
  const tones = {
    accent: {
      background: "rgba(59,78,217,0.15)",
      color: "var(--accent-hover)"
    },
    metric: {
      background: "rgba(181,152,90,0.15)",
      color: "var(--metric)"
    },
    neutral: {
      background: "rgba(232,234,240,0.1)",
      color: "var(--text-body-dark)"
    }
  };
  return React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 10px",
      borderRadius: "var(--radius-pill)",
      fontSize: "12px",
      fontWeight: 500,
      letterSpacing: "var(--tracking-label)",
      fontFamily: "var(--font-body)",
      ...tones[tone]
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open,
  title,
  children,
  onClose
}) {
  if (!open) return null;
  return React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(14,23,56,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100
    }
  }, React.createElement("div", {
    style: {
      background: "var(--surface-card-dark)",
      borderRadius: "var(--radius-lg)",
      padding: "28px",
      minWidth: "320px",
      maxWidth: "480px",
      boxShadow: "var(--shadow-card-dark)",
      fontFamily: "var(--font-body)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px"
    }
  }, React.createElement("h3", {
    style: {
      color: "var(--text-heading-dark)",
      fontWeight: 700,
      fontSize: "19px",
      margin: 0
    }
  }, title), React.createElement("span", {
    onClick: onClose,
    style: {
      cursor: "pointer",
      color: "var(--text-muted-dark)",
      fontSize: "18px"
    }
  }, "×")), React.createElement("div", {
    style: {
      color: "var(--text-body-dark)",
      fontSize: "14px",
      lineHeight: "var(--line-body)"
    }
  }, children)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  label,
  children
}) {
  const [show, setShow] = React.useState(false);
  return React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex"
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && React.createElement("span", {
    style: {
      position: "absolute",
      bottom: "calc(100% + 8px)",
      left: "50%",
      transform: "translateX(-50%)",
      background: "var(--charcoal)",
      color: "#fff",
      fontSize: "12px",
      padding: "6px 10px",
      borderRadius: "var(--radius-sm)",
      whiteSpace: "nowrap",
      fontFamily: "var(--font-body)"
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  icon = null,
  children,
  onClick
}) {
  const sizes = {
    sm: {
      padding: "8px 14px",
      fontSize: "13px"
    },
    md: {
      padding: "12px 20px",
      fontSize: "14px"
    },
    lg: {
      padding: "15px 26px",
      fontSize: "16px"
    }
  };
  const base = {
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    borderRadius: "var(--radius-md)",
    border: "none",
    cursor: disabled ? "default" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    transition: "background var(--duration-fast) var(--ease-standard),color var(--duration-fast) var(--ease-standard),border-color var(--duration-fast) var(--ease-standard)",
    opacity: disabled ? 0.45 : 1,
    ...sizes[size]
  };
  const variants = {
    primary: {
      background: "var(--accent)",
      color: "#fff"
    },
    secondary: {
      background: "var(--surface-card-dark)",
      color: "var(--text-heading-dark)",
      border: "1px solid var(--border-dark)"
    },
    ghost: {
      background: "transparent",
      color: "var(--text-heading-dark)",
      border: "1px solid var(--border-dark)"
    },
    metric: {
      background: "var(--metric)",
      color: "#fff"
    }
  };
  const [hover, setHover] = React.useState(false);
  const hoverBg = {
    primary: "var(--accent-hover)",
    metric: "var(--metric-hover)",
    secondary: "rgba(255,255,255,0.06)",
    ghost: "rgba(255,255,255,0.06)"
  };
  const style = {
    ...base,
    ...variants[variant],
    ...(hover && !disabled ? {
      background: hoverBg[variant]
    } : {})
  };
  return React.createElement("button", {
    style,
    disabled,
    onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  label,
  checked = false,
  onChange
}) {
  return React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      cursor: "pointer",
      fontFamily: "var(--font-body)",
      fontSize: "14px",
      color: "var(--text-body-dark)"
    }
  }, React.createElement("span", {
    onClick: () => onChange && onChange(!checked),
    style: {
      width: "18px",
      height: "18px",
      borderRadius: "4px",
      border: `1.5px solid ${checked ? "var(--accent)" : "var(--border-dark)"}`,
      background: checked ? "var(--accent)" : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all var(--duration-fast) var(--ease-standard)"
    }
  }, checked && React.createElement("span", {
    style: {
      width: "8px",
      height: "8px",
      background: "#fff",
      borderRadius: "1px"
    }
  })), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  label,
  placeholder = "",
  value,
  onChange,
  type = "text",
  error = ""
}) {
  const [focus, setFocus] = React.useState(false);
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      fontFamily: "var(--font-body)"
    }
  }, label && React.createElement("label", {
    style: {
      fontSize: "13px",
      fontWeight: 500,
      letterSpacing: "var(--tracking-label)",
      color: "var(--text-muted-dark)"
    }
  }, label), React.createElement("input", {
    type,
    placeholder,
    value,
    onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      background: "var(--surface-card-dark)",
      border: `1px solid ${error ? "#C24A4A" : focus ? "var(--accent)" : "var(--border-dark)"}`,
      borderRadius: "var(--radius-md)",
      padding: "11px 14px",
      color: "var(--text-heading-dark)",
      fontSize: "14px",
      fontFamily: "inherit",
      outline: "none",
      transition: "border-color var(--duration-fast) var(--ease-standard)"
    }
  }), error && React.createElement("span", {
    style: {
      fontSize: "12px",
      color: "#C24A4A"
    }
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  label,
  options = [],
  value,
  onChange
}) {
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      fontFamily: "var(--font-body)"
    }
  }, label && React.createElement("label", {
    style: {
      fontSize: "13px",
      fontWeight: 500,
      letterSpacing: "var(--tracking-label)",
      color: "var(--text-muted-dark)"
    }
  }, label), React.createElement("select", {
    value,
    onChange,
    style: {
      background: "var(--surface-card-dark)",
      border: "1px solid var(--border-dark)",
      borderRadius: "var(--radius-md)",
      padding: "11px 14px",
      color: "var(--text-heading-dark)",
      fontSize: "14px",
      fontFamily: "inherit",
      outline: "none"
    }
  }, options.map(o => React.createElement("option", {
    key: o,
    value: o
  }, o))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  checked = false,
  onChange
}) {
  return React.createElement("span", {
    onClick: () => onChange && onChange(!checked),
    style: {
      width: "38px",
      height: "22px",
      borderRadius: "var(--radius-pill)",
      background: checked ? "var(--accent)" : "var(--border-dark)",
      position: "relative",
      cursor: "pointer",
      display: "inline-block",
      transition: "background var(--duration-fast) var(--ease-standard)"
    }
  }, React.createElement("span", {
    style: {
      position: "absolute",
      top: "3px",
      left: checked ? "19px" : "3px",
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      background: "#fff",
      transition: "left var(--duration-fast) var(--ease-standard)"
    }
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  tabs = [],
  active,
  onChange
}) {
  return React.createElement("div", {
    style: {
      display: "flex",
      gap: "4px",
      borderBottom: "1px solid var(--border-dark)"
    }
  }, tabs.map(t => React.createElement("button", {
    key: t,
    onClick: () => onChange && onChange(t),
    style: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      padding: "10px 16px",
      fontFamily: "var(--font-body)",
      fontWeight: 500,
      fontSize: "14px",
      color: t === active ? "var(--text-heading-dark)" : "var(--text-muted-dark)",
      borderBottom: t === active ? "2px solid var(--accent)" : "2px solid transparent",
      transition: "color var(--duration-fast) var(--ease-standard)"
    }
  }, t)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pancho-os/Dashboard.jsx
try { (() => {
function Dashboard() {
  const {
    Card,
    MetricCard,
    Badge,
    ProgressBar,
    Checkbox,
    Button
  } = window.PanchoOSDesignSystem_f5b116;
  const [tasks, setTasks] = React.useState([{
    t: "Cerrar reporte IESS",
    done: true
  }, {
    t: "Llamada con Carlos — BrainTech",
    done: false
  }, {
    t: "Revisar métricas CODEIS Q3",
    done: false
  }]);
  const toggle = i => setTasks(tasks.map((x, idx) => idx === i ? {
    ...x,
    done: !x.done
  } : x));
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "32px"
    }
  }, React.createElement("div", null, React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "28px",
      color: "var(--text-heading-dark)",
      margin: "0 0 4px"
    }
  }, "Hoy"), React.createElement("p", {
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "14px",
      color: "var(--text-muted-dark)",
      margin: 0
    }
  }, "Domingo 24 de agosto")), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: "16px"
    }
  }, React.createElement(Card, null, React.createElement(MetricCard, {
    label: "Eficiencia semanal",
    value: "78%",
    delta: "+6pp"
  })), React.createElement(Card, null, React.createElement(MetricCard, {
    label: "Racha hábitos",
    value: "12 días"
  })), React.createElement(Card, null, React.createElement(MetricCard, {
    label: "Tareas hoy",
    value: "3"
  })), React.createElement(Card, null, React.createElement(MetricCard, {
    label: "Runway",
    value: "14 meses"
  }))), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.3fr 1fr",
      gap: "20px"
    }
  }, React.createElement(Card, null, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px"
    }
  }, React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "16px",
      color: "var(--text-heading-dark)",
      margin: 0
    }
  }, "Tareas prioritarias"), React.createElement(Badge, {
    tone: "accent"
  }, "3 pendientes")), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "14px"
    }
  }, tasks.map((x, i) => React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      opacity: x.done ? 0.5 : 1
    }
  }, React.createElement(Checkbox, {
    checked: x.done,
    onChange: () => toggle(i)
  }), React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "14px",
      color: "var(--text-body-dark)",
      textDecoration: x.done ? "line-through" : "none"
    }
  }, x.t))))), React.createElement(Card, null, React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "16px",
      color: "var(--text-heading-dark)",
      margin: "0 0 16px"
    }
  }, "Agenda"), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      fontFamily: "var(--font-body)",
      fontSize: "13px"
    }
  }, [["09:00", "Standup CODEIS"], ["11:30", "Sesión de estrategia — taskr"], ["16:00", "Revisión financiera BrainTech"]].map(([h, t]) => React.createElement("div", {
    key: h,
    style: {
      display: "flex",
      gap: "12px"
    }
  }, React.createElement("span", {
    style: {
      color: "var(--accent-hover)",
      fontWeight: 500,
      minWidth: "44px"
    }
  }, h), React.createElement("span", {
    style: {
      color: "var(--text-body-dark)"
    }
  }, t)))))), React.createElement(Card, null, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "12px"
    }
  }, React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "16px",
      color: "var(--text-heading-dark)",
      margin: 0
    }
  }, "Hermes — segundo cerebro"), React.createElement(Button, {
    variant: "ghost",
    size: "sm"
  }, "Abrir agente")), React.createElement("p", {
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "13px",
      color: "var(--text-muted-dark)",
      margin: 0,
      maxWidth: "520px"
    }
  }, "Última sincronización hace 4 minutos vía MCP. Hermes actualizó 2 tareas y registró 1 hábito desde el calendario.")));
}
window.Dashboard = Dashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pancho-os/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pancho-os/Finance.jsx
try { (() => {
function Finance() {
  const {
    Card,
    MetricCard,
    Badge
  } = window.PanchoOSDesignSystem_f5b116;
  const rows = [["IESS (cierre)", "Ingreso", "+USD 4.200", "2026-08-01"], ["BrainTech", "Ingreso", "+USD 8.600", "2026-08-05"], ["CODEIS Academy", "Gasto operativo", "-USD 1.150", "2026-08-11"], ["Personal", "Gasto fijo", "-USD 2.300", "2026-08-15"]];
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }
  }, React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "28px",
      color: "var(--text-heading-dark)",
      margin: 0
    }
  }, "Finanzas"), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: "16px"
    }
  }, React.createElement(Card, null, React.createElement(MetricCard, {
    label: "Runway",
    value: "14 meses"
  })), React.createElement(Card, null, React.createElement(MetricCard, {
    label: "Ingresos del mes",
    value: "+USD 12.800",
    delta: "+9% vs julio"
  })), React.createElement(Card, null, React.createElement(MetricCard, {
    label: "Gasto fijo",
    value: "USD 3.450"
  }))), React.createElement(Card, {
    padded: false
  }, React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontFamily: "var(--font-body)",
      fontSize: "13px"
    }
  }, React.createElement("thead", null, React.createElement("tr", null, ["Sistema", "Tipo", "Monto", "Fecha"].map(h => React.createElement("th", {
    key: h,
    style: {
      textAlign: "left",
      padding: "14px 24px",
      color: "var(--text-muted-dark)",
      fontWeight: 500,
      letterSpacing: "var(--tracking-label)",
      textTransform: "uppercase",
      fontSize: "11px",
      borderBottom: "1px solid var(--border-dark)"
    }
  }, h)))), React.createElement("tbody", null, rows.map(r => React.createElement("tr", {
    key: r[0]
  }, React.createElement("td", {
    style: {
      padding: "14px 24px",
      color: "var(--text-body-dark)",
      borderBottom: "1px solid var(--border-dark)"
    }
  }, r[0]), React.createElement("td", {
    style: {
      padding: "14px 24px",
      borderBottom: "1px solid var(--border-dark)"
    }
  }, React.createElement(Badge, {
    tone: "neutral"
  }, r[1])), React.createElement("td", {
    style: {
      padding: "14px 24px",
      fontWeight: 700,
      color: r[2][0] === "+" ? "var(--metric)" : "var(--text-body-dark)",
      borderBottom: "1px solid var(--border-dark)"
    }
  }, r[2]), React.createElement("td", {
    style: {
      padding: "14px 24px",
      color: "var(--text-muted-dark)",
      borderBottom: "1px solid var(--border-dark)"
    }
  }, r[3])))))));
}
window.Finance = Finance;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pancho-os/Finance.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pancho-os/Habits.jsx
try { (() => {
function Habits() {
  const {
    Card,
    MetricCard,
    ProgressBar,
    Switch
  } = window.PanchoOSDesignSystem_f5b116;
  const [habits, setHabits] = React.useState([{
    name: "Lectura",
    pct: 62,
    reminder: true
  }, {
    name: "Entrenamiento",
    pct: 88,
    reminder: true
  }, {
    name: "Meditación",
    pct: 40,
    reminder: false
  }, {
    name: "Journaling",
    pct: 71,
    reminder: true
  }]);
  const toggle = i => setHabits(habits.map((h, idx) => idx === i ? {
    ...h,
    reminder: !h.reminder
  } : h));
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }
  }, React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "28px",
      color: "var(--text-heading-dark)",
      margin: 0
    }
  }, "Hábitos & Salud"), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: "16px"
    }
  }, React.createElement(Card, null, React.createElement(MetricCard, {
    label: "Racha activa",
    value: "12 días"
  })), React.createElement(Card, null, React.createElement(MetricCard, {
    label: "Horas de sueño (prom.)",
    value: "7.2h"
  })), React.createElement(Card, null, React.createElement(MetricCard, {
    label: "Frecuencia cardiaca reposo",
    value: "58 bpm"
  }))), React.createElement(Card, null, React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    }
  }, habits.map((h, i) => React.createElement("div", {
    key: h.name,
    style: {
      display: "grid",
      gridTemplateColumns: "140px 1fr 60px 90px",
      alignItems: "center",
      gap: "16px"
    }
  }, React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "14px",
      color: "var(--text-body-dark)",
      fontWeight: 500
    }
  }, h.name), React.createElement(ProgressBar, {
    value: h.pct,
    tone: "metric"
  }), React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "13px",
      color: "var(--metric)",
      fontWeight: 700,
      textAlign: "right"
    }
  }, h.pct + "%"), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      justifySelf: "end"
    }
  }, React.createElement(Switch, {
    checked: h.reminder,
    onChange: () => toggle(i)
  }), React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontSize: "11px",
      color: "var(--text-muted-dark)"
    }
  }, "recordatorio")))))));
}
window.Habits = Habits;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pancho-os/Habits.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pancho-os/Sidebar.jsx
try { (() => {
function Sidebar({
  active,
  onChange
}) {
  const items = [["Hoy", "dashboard"], ["Tareas", "tasks"], ["Hábitos & Salud", "habits"], ["Finanzas", "finance"]];
  return React.createElement("div", {
    style: {
      width: "220px",
      background: "var(--ink)",
      borderRight: "1px solid var(--border-dark)",
      display: "flex",
      flexDirection: "column",
      padding: "28px 0",
      flexShrink: 0
    }
  }, React.createElement("div", {
    style: {
      padding: "0 24px 28px",
      fontFamily: "var(--font-body)"
    }
  }, React.createElement("span", {
    style: {
      fontWeight: 200,
      letterSpacing: "var(--tracking-wordmark-light)",
      fontSize: "11px",
      color: "rgba(250,250,247,.45)"
    }
  }, "FRANCISCO "), React.createElement("span", {
    style: {
      fontWeight: 900,
      letterSpacing: "var(--tracking-wordmark-bold)",
      fontSize: "14px",
      color: "var(--accent)"
    }
  }, "OS")), items.map(([label, key]) => React.createElement("div", {
    key,
    onClick: () => onChange(key),
    style: {
      padding: "12px 24px",
      fontFamily: "var(--font-body)",
      fontSize: "14px",
      fontWeight: 500,
      cursor: "pointer",
      color: active === key ? "var(--text-heading-dark)" : "var(--text-muted-dark)",
      borderLeft: active === key ? "2px solid var(--accent)" : "2px solid transparent",
      background: active === key ? "rgba(59,78,217,0.08)" : "transparent"
    }
  }, label)), React.createElement("div", {
    style: {
      marginTop: "auto",
      padding: "16px 24px",
      fontSize: "11px",
      color: "var(--text-muted-dark)",
      letterSpacing: "var(--tracking-label)",
      textTransform: "uppercase"
    }
  }, "Hermes activo · MCP"));
}
window.Sidebar = Sidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pancho-os/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pancho-os/Tasks.jsx
try { (() => {
function Tasks() {
  const {
    Card,
    Checkbox,
    Badge,
    Tabs,
    Button
  } = window.PanchoOSDesignSystem_f5b116;
  const [filter, setFilter] = React.useState("Todas");
  const [tasks, setTasks] = React.useState([{
    t: "Cerrar reporte IESS",
    sys: "IESS",
    done: true
  }, {
    t: "Llamada con Carlos — BrainTech",
    sys: "BrainTech",
    done: false
  }, {
    t: "Revisar métricas CODEIS Q3",
    sys: "CODEIS",
    done: false
  }, {
    t: "Preparar lanzamiento taskr",
    sys: "taskr",
    done: false
  }, {
    t: "Actualizar guías de marca",
    sys: "Personal",
    done: true
  }]);
  const toggle = i => setTasks(tasks.map((x, idx) => idx === i ? {
    ...x,
    done: !x.done
  } : x));
  const visible = filter === "Todas" ? tasks : tasks.filter(x => filter === "Pendientes" ? !x.done : x.done);
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end"
    }
  }, React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "28px",
      color: "var(--text-heading-dark)",
      margin: 0
    }
  }, "Tareas"), React.createElement(Button, {
    variant: "primary",
    size: "sm"
  }, "+ Nueva tarea")), React.createElement(Tabs, {
    tabs: ["Todas", "Pendientes", "Completadas"],
    active: filter,
    onChange: setFilter
  }), React.createElement(Card, {
    padded: false
  }, React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, visible.map((x, i) => React.createElement("div", {
    key: x.t,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      padding: "16px 24px",
      borderBottom: "1px solid var(--border-dark)",
      opacity: x.done ? 0.5 : 1
    }
  }, React.createElement(Checkbox, {
    checked: x.done,
    onChange: () => toggle(tasks.indexOf(x))
  }), React.createElement("span", {
    style: {
      flex: 1,
      fontFamily: "var(--font-body)",
      fontSize: "14px",
      color: "var(--text-body-dark)",
      textDecoration: x.done ? "line-through" : "none"
    }
  }, x.t), React.createElement(Badge, {
    tone: "neutral"
  }, x.sys))))));
}
window.Tasks = Tasks;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pancho-os/Tasks.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Card = __ds_scope.Card;

__ds_ns.MetricCard = __ds_scope.MetricCard;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
