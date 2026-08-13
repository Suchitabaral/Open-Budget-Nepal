import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { componentOptions, filterConfig, fiscalYears, provinces as fallbackProvinces, subcomponentOptions, subSubcomponentOptions, typeOptions, type FilterOption, type InsightScope } from "@/features/budget-insights/model/filterConfig";
import { fetchBudgetInsightMetadata, fetchBudgetInsights, getMockBudgetInsightMetadata, getMockBudgetInsights, type BudgetInsightFilters, type BudgetInsightResponse } from "@/features/budget-insights/api/budgetInsightsApi";
import { administrativeRegistry } from "@/features/budget-insights/data/administrativeRegistry";

const all: FilterOption = { id: "all", label: "All" };
const colors = ["#047857", "#0f766e", "#475569", "#94a3b8", "#cbd5e1"];
const scopeCopy = {
  federal: { title: "Federal government", description: "National revenue, grants, and fiscal-year performance", stat: "1 national account" },
  provincial: { title: "Provincial governments", description: "Compare revenue and grants across Nepal’s seven provinces", stat: "7 provinces" },
  local: { title: "Local governments", description: "Explore municipal revenue and intergovernmental transfers", stat: "753 local levels" },
};

function SelectField({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: FilterOption[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="min-w-0 text-xs font-medium text-slate-700">{label}<select value={value} disabled={disabled} onChange={event=>onChange(event.target.value)} className="mt-1.5 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500">{options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <Card className="shadow-none"><CardHeader className="border-b px-5 py-4"><CardTitle className="text-sm">{title}</CardTitle><p className="text-xs text-slate-600">{subtitle}</p></CardHeader><CardContent className="p-4"><div className="h-[300px]">{children}</div></CardContent></Card>;
}

function EmptyChart({ message }: { message: string }) {
  return <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-600">{message}</div>;
}

function SkeletonCharts() {
  return <div className="grid gap-5 xl:grid-cols-2" aria-label="Loading budget data">{[0,1,2].map(item=><div key={item} className="h-[365px] animate-pulse rounded-xl border border-slate-200 bg-white p-5"><div className="h-4 w-36 rounded bg-slate-200"/><div className="mt-3 h-3 w-52 rounded bg-slate-100"/><div className="mt-8 h-64 rounded-lg bg-slate-100"/></div>)}</div>;
}

export default function FiscalExplorer({ scope }: { scope: InsightScope }) {
  const defaults = filterConfig.defaults;
  const [searchParams] = useSearchParams();
  const [filters,setFilters]=useState<BudgetInsightFilters>(()=>{
    const requestedProvince = searchParams.get("province");
    const province = administrativeRegistry.provinces.some(item=>item.label===requestedProvince) ? requestedProvince! : "all";
    const requestedMunicipalityCode = searchParams.get("municipalityCode");
    const municipality = administrativeRegistry.localLevels.find(item=>item.code===requestedMunicipalityCode && (province==="all" || item.provinceId===administrativeRegistry.provinces.find(provinceItem=>provinceItem.label===province)?.id));
    const requestedFiscalYear = searchParams.get("fy");
    return { fiscalYear: requestedFiscalYear && fiscalYears.includes(requestedFiscalYear) ? requestedFiscalYear : defaults.fiscalYear, type: defaults.type, indicator: defaults.indicator, category: defaults.category, subcategory: defaults.subcategory, component: defaults.component, subcomponent: defaults.subcomponent, subSubcomponent: defaults.subSubcomponent, province, municipality: municipality?.nameEn??"", municipalityCode: municipality?.code??"all", municipalityType: "all" };
  });
  const [metadata,setMetadata]=useState<{provinces:string[];municipalities:string[]}>({provinces:[],municipalities:[]});
  const [data,setData]=useState<BudgetInsightResponse|null>(null);
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");

  useEffect(()=>{ const controller=new AbortController(); fetchBudgetInsightMetadata(controller.signal).then(setMetadata).catch(error=>{if(error instanceof DOMException&&error.name==="AbortError")return;setMetadata(getMockBudgetInsightMetadata())}); return ()=>controller.abort(); },[]);
  useEffect(()=>{ const controller=new AbortController(); const timer=window.setTimeout(()=>{ setStatus("loading"); fetchBudgetInsights(scope,filters,controller.signal).then(result=>{setData(result);setStatus("ready")}).catch(error=>{if(error instanceof DOMException&&error.name==="AbortError")return;
    // TODO(api): Remove this fixture fallback once the production insights API
    // is guaranteed in every deployment environment.
    setData(getMockBudgetInsights(scope,filters.indicator));setStatus("ready")}); },180); return ()=>{window.clearTimeout(timer);controller.abort()}; },[scope,filters]);

  const components=useMemo(()=>componentOptions(scope),[scope]);
  const subcomponents=useMemo(()=>subcomponentOptions(scope,filters.component),[scope,filters.component]);
  const subSubs=useMemo(()=>subSubcomponentOptions(scope,filters.subcomponent),[scope,filters.subcomponent]);
  const provinceOptions=useMemo(()=>[all,...(metadata.provinces.length?metadata.provinces.map(label=>({id:label,label})):fallbackProvinces)],[metadata.provinces]);
  const municipalityOptions=useMemo(()=>{
    const selectedProvince=administrativeRegistry.provinces.find(item=>item.label===filters.province);
    return [all,...administrativeRegistry.localLevels.filter(item=>(!selectedProvince||item.provinceId===selectedProvince.id)&&(filters.municipalityType==="all"||item.type===filters.municipalityType)).map(item=>({id:item.code,label:item.nameEn}))];
  },[filters.province,filters.municipalityType]);
  const set=(key:keyof BudgetInsightFilters,value:string)=>setFilters(current=>{const next={...current,[key]:value};if(key==="component"){next.subcomponent="all";next.subSubcomponent="all"}if(key==="subcomponent")next.subSubcomponent="all";return next});
  const reset=()=>setFilters({ fiscalYear: defaults.fiscalYear, type: defaults.type, indicator: defaults.indicator, category: defaults.category, subcategory: defaults.subcategory, component: defaults.component, subcomponent: defaults.subcomponent, subSubcomponent: defaults.subSubcomponent, province:"all",municipality:"",municipalityCode:"all",municipalityType:"all" });
  const format=(value:number)=>filters.indicator==="percentage"?`${value.toFixed(1)}%`:`NPR ${value.toLocaleString(undefined,{maximumFractionDigits:1})}M`;
  const copy=scopeCopy[scope];

  return <section className="space-y-5" aria-labelledby={`${scope}-title`}>
    <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 id={`${scope}-title`} className="text-xl font-semibold tracking-[-.02em] text-slate-950">{copy.title}</h1><p className="mt-1 text-sm text-slate-600">{copy.description}</p></div><div className="flex items-center gap-2"><span className="text-xs font-medium text-emerald-800">{copy.stat}</span>{data?.source==="mock"?<span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Sample data</span>:null}</div></div>

    <Card className="shadow-none"><div className="flex items-center justify-between border-b px-4 py-3"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><SlidersHorizontal className="h-4 w-4 text-emerald-700"/>Filters</div><Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-3.5 w-3.5"/>Reset</Button></div><CardContent className="space-y-5 p-4">
      <div><p className="mb-3 text-xs font-semibold text-slate-500">Report context</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {scope==="provincial"?<SelectField label="Province" value={filters.province??"all"} options={provinceOptions} onChange={value=>set("province",value)}/>:null}
        {scope==="local"?<><SelectField label="Province" value={filters.province??"all"} options={provinceOptions} onChange={value=>setFilters(current=>({...current,province:value,municipality:"",municipalityCode:"all"}))}/><SelectField label="Municipality type" value={filters.municipalityType??"all"} options={filterConfig.scopes.local.municipalityTypes} onChange={value=>setFilters(current=>({...current,municipalityType:value,municipality:"",municipalityCode:"all"}))}/><SelectField label={`Municipality (${municipalityOptions.length-1})`} value={filters.municipalityCode??"all"} options={municipalityOptions} onChange={value=>{const selected=administrativeRegistry.localLevels.find(item=>item.code===value);setFilters(current=>({...current,municipalityCode:value,municipality:selected?.nameEn??""}))}}/></>:null}
        <SelectField label="Fiscal year" value={filters.fiscalYear} options={fiscalYears.map(value=>({id:value,label:value}))} onChange={value=>set("fiscalYear",value)}/>
        <SelectField label="Type" value={filters.type} options={typeOptions(scope)} onChange={value=>set("type",value)}/>
        <SelectField label="Indicator" value={filters.indicator} options={filterConfig.common.indicators} onChange={value=>set("indicator",value)}/>
      </div></div>
      <div><p className="mb-3 text-xs font-semibold text-slate-500">Classification</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SelectField label="Category" value={filters.category} options={filterConfig.common.categories} onChange={value=>set("category",value)}/><SelectField label="Subcategory" value={filters.subcategory} options={filterConfig.common.categories} onChange={value=>set("subcategory",value)}/><SelectField label="Component" value={filters.component} options={components} onChange={value=>set("component",value)}/><SelectField label="Subcomponent" value={filters.subcomponent} options={subcomponents} onChange={value=>set("subcomponent",value)}/><SelectField label="Sub-subcomponent" value={filters.subSubcomponent} options={subSubs} onChange={value=>set("subSubcomponent",value)}/>
      </div></div>
    </CardContent></Card>

    {status==="loading"?<SkeletonCharts/>:status==="error"?<div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-800">Budget data could not be loaded. Check the API connection and try again.</div>:<div className="grid gap-5 xl:grid-cols-2">
      <ChartCard title="Components" subtitle={`${filters.fiscalYear} · ${typeOptions(scope).find(item=>item.id===filters.type)?.label??filters.type}`}>
        {data?.components.length?<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.components} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={2}>{data.components.map((item,index)=><Cell key={item.name} fill={colors[index%colors.length]}/>)}</Pie><Tooltip formatter={(value)=>format(Number(value))}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/></PieChart></ResponsiveContainer>:<EmptyChart message="No component data matches these filters."/>}
      </ChartCard>
      <ChartCard title="Subcomponents" subtitle="Breakdown of the selected component">
        {data?.subcomponents.length?<ResponsiveContainer width="100%" height="100%"><BarChart data={data.subcomponents} layout="vertical" margin={{left:16,right:16}}><CartesianGrid stroke="#e2e8f0" horizontal={false}/><XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize:10,fill:"#64748b"}}/><YAxis type="category" dataKey="name" width={130} axisLine={false} tickLine={false} tick={{fontSize:10,fill:"#64748b"}}/><Tooltip formatter={(value)=>format(Number(value))}/><Bar dataKey="value" name="Value" fill="#047857" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer>:<EmptyChart message="No subcomponent data matches these filters."/>}
      </ChartCard>
      {scope==="federal"?<ChartCard title="Sub-subcomponents" subtitle="Most detailed available classification">{data?.subSubcomponents.length?<ResponsiveContainer width="100%" height="100%"><BarChart data={data.subSubcomponents} layout="vertical"><XAxis type="number" hide/><YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{fontSize:10}}/><Tooltip formatter={(value)=>format(Number(value))}/><Bar dataKey="value" fill="#0f766e" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer>:<EmptyChart message="The current source does not contain this classification depth."/>}</ChartCard>:null}
      <ChartCard title="Fiscal-year total" subtitle="Available history for the selected government scope">{data?.trend.length?<ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.trend} margin={{left:-8,right:8}}><CartesianGrid stroke="#e2e8f0" vertical={false}/><XAxis dataKey="fiscalYear" axisLine={false} tickLine={false} tick={{fontSize:10,fill:"#64748b"}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:"#64748b"}}/><Tooltip formatter={(value)=>value==null?"Unavailable":format(Number(value))}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/><Bar dataKey="budget" name="Budget" fill="#cbd5e1" radius={[3,3,0,0]}/><Line dataKey="actual" name="Actual" stroke="#047857" strokeWidth={2.5} dot={false}/></ComposedChart></ResponsiveContainer>:<EmptyChart message="No historical series is available for this selection."/>}</ChartCard>
    </div>}
  </section>;
}
