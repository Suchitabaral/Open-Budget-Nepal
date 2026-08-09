import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Kind = "procurement" | "contractors" | "transfers";
const records = {
  procurement: [
    ["PPMO-81-4472", "Kathmandu–Terai Fast Track package", "Nepal Infrastructure JV", "NPR 12.40B", "Open"],
    ["DWRI-81-1189", "Sunsari Morang irrigation upgrade", "Himal Builders", "NPR 4.82B", "Awarded"],
    ["DOR-81-9031", "Muglin–Pokhara road works", "Annapurna Construction", "NPR 7.16B", "Review"],
    ["NEA-81-2204", "Koshi transmission corridor", "Himalayan Energy JV", "NPR 5.64B", "Awarded"],
    ["MOHP-81-7402", "Provincial hospital equipment", "MediTech Nepal", "NPR 1.18B", "Open"],
  ],
  contractors: [
    ["CNT-00241", "Nepal Infrastructure JV", "Civil works", "NPR 24.8B", "Verified"],
    ["CNT-00198", "Himal Builders", "Infrastructure", "NPR 16.2B", "Verified"],
    ["CNT-00402", "Annapurna Construction", "Roads", "NPR 11.7B", "Review"],
    ["CNT-00314", "Himalayan Energy JV", "Energy", "NPR 9.4B", "Verified"],
    ["CNT-00612", "MediTech Nepal", "Medical supply", "NPR 3.1B", "Verified"],
  ],
  transfers: [
    ["FT-81-KOS", "Koshi Province", "Equalization grant", "NPR 18.32B", "Released"],
    ["FT-81-MAD", "Madhesh Province", "Conditional grant", "NPR 21.74B", "Released"],
    ["FT-81-BAG", "Bagmati Province", "Revenue sharing", "NPR 27.61B", "Scheduled"],
    ["FT-81-GAN", "Gandaki Province", "Equalization grant", "NPR 15.08B", "Released"],
    ["FT-81-LUM", "Lumbini Province", "Special grant", "NPR 12.96B", "Review"],
  ],
};
const copy = {
  procurement: ["Procurement", "Track public tenders and contract awards across Nepal.", ["Reference", "Project", "Contractor", "Value", "Status"]],
  contractors: ["Contractors", "Review suppliers, awarded value, and verification status.", ["ID", "Contractor", "Category", "Awarded value", "Status"]],
  transfers: ["Fiscal transfers", "Follow intergovernmental grants and revenue sharing by province.", ["Reference", "Recipient", "Transfer type", "Amount", "Status"]],
} as const;

export default function DirectoryPage({ kind }: { kind: Kind }) {
  const [query, setQuery] = useState("");
  const [descending, setDescending] = useState(false);
  const rows = useMemo(() => records[kind].filter(r => r.join(" ").toLowerCase().includes(query.toLowerCase())).slice().sort((a,b) => descending ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])), [kind, query, descending]);
  const [title, subtitle, headings] = copy[kind];
  return <Layout><PageHeader eyebrow="Public records · FY 2081/82" title={title} subtitle={subtitle} action={<Button variant="outline"><Download className="h-4 w-4"/>Export CSV</Button>}/>
    <Card><div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input value={query} onChange={e=>setQuery(e.target.value)} className="pl-9" placeholder={`Search ${title.toLowerCase()}…`} aria-label={`Search ${title.toLowerCase()}`}/></div><div className="flex gap-2"><Button variant="outline">All statuses</Button><Button variant="outline">FY 2081/82</Button></div></div>
      <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50"><tr>{headings.map((h,i)=><th key={h} className="border-b px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">{i===0?<button className="flex items-center gap-1" onClick={()=>setDescending(v=>!v)}>{h}<ArrowUpDown className="h-3 w-3"/></button>:h}</th>)}</tr></thead><tbody>{rows.map((row)=><tr key={row[0]} className="border-b last:border-0 hover:bg-slate-50">{row.map((cell,i)=><td key={cell} className="px-5 py-3.5 text-slate-600 first:font-mono first:text-xs first:text-slate-500">{i===4?<Badge variant={cell==="Review"?"warning":cell==="Open"||cell==="Scheduled"?"secondary":"success"}>{cell}</Badge>:<span className={i===3?"font-semibold tabular-nums text-slate-900":""}>{cell}</span>}</td>)}</tr>)}</tbody></table>{rows.length===0?<div className="p-12 text-center text-sm text-slate-500">No records match your search.</div>:null}</div>
      <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-slate-500"><span>Showing {rows.length} of {records[kind].length} records</span><div className="flex items-center gap-1"><Button variant="ghost" size="icon" disabled aria-label="Previous page"><ChevronLeft className="h-4 w-4"/></Button><span className="grid h-8 w-8 place-items-center rounded-md bg-slate-900 text-white">1</span><Button variant="ghost" size="icon" disabled aria-label="Next page"><ChevronRight className="h-4 w-4"/></Button></div></div></CardContent></Card>
  </Layout>;
}
