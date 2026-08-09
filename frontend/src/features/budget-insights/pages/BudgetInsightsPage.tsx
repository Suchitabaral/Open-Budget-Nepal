import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, Landmark, MapPin } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Layout from "@/components/layout/Layout";
import FiscalExplorer from "@/features/budget-insights/components/FiscalExplorer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fiscalTrendsData } from "@/data/budgetData";
import { cn } from "@/lib/utils";

type Scope = "overview" | "federal" | "provincial" | "local";
const scopes = [
  { id: "overview", label: "Overview", detail: "National snapshot", icon: Landmark, path: "/insights" },
  { id: "federal", label: "Federal", detail: "National accounts", icon: Building2, path: "/insights/federal" },
  { id: "provincial", label: "Provincial", detail: "7 governments", icon: Landmark, path: "/insights/provincial" },
  { id: "local", label: "Local", detail: "753 local levels", icon: MapPin, path: "/insights/local" },
] as const;

function Summary() {
  const items = [{label:"Consolidated budget",value:"NPR 3,720.6B"},{label:"Actual expenditure",value:"NPR 3,295.3B"},{label:"Utilization",value:"88.6%"}];
  return <div className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3">{items.map(item=><div key={item.label} className="bg-white px-5 py-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-2 text-xl font-semibold tracking-tight text-slate-950 tabular-nums">{item.value}</p></div>)}</div>;
}

export default function Insights() {
  const { pathname } = useLocation();
  const scope: Scope = pathname.endsWith("/federal") ? "federal" : pathname.endsWith("/provincial") ? "provincial" : pathname.endsWith("/local") ? "local" : "overview";
  const trends=useMemo(()=>fiscalTrendsData.slice(-8),[]);
  return <Layout>
    <nav className="mb-7 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 md:flex-row" aria-label="Budget insight sections">
      {scopes.map(({id,label,detail,icon:Icon,path},index)=><Link key={id} to={path} aria-current={scope===id?"page":undefined} className={cn("group flex min-h-14 items-center gap-3 rounded-lg px-4 transition-colors md:flex-1",index===0&&"md:max-w-48 md:border-r md:border-slate-200 md:rounded-r-none",scope===id?"bg-slate-900 text-white":"text-slate-600 hover:bg-slate-50 hover:text-slate-950")}><span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg",scope===id?"bg-white/10 text-emerald-300":"bg-slate-100 text-slate-500 group-hover:text-emerald-700")}><Icon className="h-4 w-4"/></span><span><span className="block text-sm font-semibold">{label}</span><span className={cn("mt-0.5 block text-xs",scope===id?"text-slate-300":"text-slate-500")}>{detail}</span></span></Link>)}
    </nav>
    {scope === "overview" ? <div className="space-y-5"><Summary/><Card><CardHeader className="border-b px-5 py-4"><CardTitle className="text-sm">Revenue trend</CardTitle><p className="text-xs text-slate-500">NPR billions · B.S.</p></CardHeader><CardContent className="p-4"><div className="h-[330px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trends} margin={{left:-8,right:12}}><CartesianGrid stroke="#e2e8f0" vertical={false}/><XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize:11,fill:"#64748b"}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:"#64748b"}}/><Tooltip formatter={(value)=>`NPR ${value}B`}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/><Line dataKey="revenue" name="Revenue" stroke="#047857" strokeWidth={2.5} dot={false}/><Line dataKey="expenditure" name="Expenditure" stroke="#475569" strokeWidth={2.5} dot={false}/></LineChart></ResponsiveContainer></div></CardContent></Card></div> : null}
    {scope === "federal" ? <FiscalExplorer scope="federal"/> : null}
    {scope === "provincial" ? <FiscalExplorer scope="provincial"/> : null}
    {scope === "local" ? <FiscalExplorer scope="local"/> : null}
  </Layout>;
}
