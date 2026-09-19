import { useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const stages = ["Searching for a site", "Evaluating a site", "Under contract", "Own the property", "Permits in progress", "Ready to build", "Under construction"];
export default function BuildWithUs() {
  const [stage, setStage] = useState("");
  const [attendedEvent, setAttendedEvent] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const submissionId = useRef(crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!stage || !attendedEvent || !consent) {setError("Choose your project stage, event attendance, and permission to contact you."); return;}
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/multiplex-applications", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({...fields, units: Number(fields.units), submissionId: submissionId.current, stage, attendedEvent, consent})});
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Your application could not be saved. Please try again.");
      setReference(result.reference);
    } catch (err) {setError(err instanceof Error ? err.message : "Please try again. Your entries are still here.");}
    finally {setBusy(false);}
  }
  const field = (name: string, label: string, required = false, type = "text", maxLength = 160) => <div className="space-y-2"><Label htmlFor={name}>{label}{required ? " *" : " (optional)"}</Label><Input id={name} name={name} type={type} required={required} maxLength={maxLength} min={type === "number" ? 2 : undefined} max={type === "number" ? 100 : undefined} className="h-12 bg-white text-slate-950" /></div>;
  return <div className="min-h-screen bg-[#f8f7f2] text-slate-900">
    <SEO title="Build with us — Multiplex investment applications | Realist" description="Bring us your multiplex project. Our mandate is to invest in six deals over 365 days with attendees of Unpacking Multiplexes Toronto 2026." />
    <header className="border-b border-slate-200 px-6 py-5"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/" className="text-2xl font-bold">realist.</Link><Link href="/community/events/unpacking-multiplexes-toronto" className="text-sm underline">The event</Link></div></header>
    <main className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
      <section><p className="mb-5 text-sm font-semibold uppercase tracking-widest">Multiplexes Toronto · Year three</p><h1 className="text-5xl font-bold leading-tight lg:text-6xl">We want to invest in your deals.</h1><p className="mt-7 text-xl leading-relaxed">Our mandate: invest in <strong>6 deals over 365 days</strong> with people in the room at Unpacking Multiplexes Toronto on September 15, 2026.</p><p className="mt-5 leading-relaxed text-slate-600">Tell us about your project and the partnership you have in mind. Still looking for a site? Share the market and plan you’re working toward.</p><p className="mt-6 text-sm leading-relaxed text-slate-600">Applying is free. We review each project for fit; an application does not guarantee investment. Any partnership depends on due diligence and mutually agreed terms.</p><p className="mt-10"><Link className="underline" href="/tools">Use Realist’s free tools while you build →</Link></p></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        {reference ? <div role="status" className="py-10"><h2 className="text-3xl font-bold">Your application is in.</h2><p className="mt-5 leading-relaxed">Thanks for sharing your project. The Realist team will review your application and use the contact details you provided if there’s a fit or we need more information.</p><p className="mt-5 break-all text-sm text-slate-500">Reference: {reference}</p><Link href="/tools/multiplex-underwriter" className="mt-8 inline-block underline">Explore the multiplex underwriter →</Link></div> : <form onSubmit={submit} className="space-y-6">
        <h2 className="text-2xl font-bold">Tell us what you want to build</h2><p className="text-sm text-slate-500">About 5 minutes. * Required. Amounts in CAD; estimates are welcome.</p>
        <div className="grid gap-5 sm:grid-cols-2">{field("name", "Full name", true, "text", 120)}{field("email", "Email", true, "email", 254)}{field("phone", "Phone", false, "tel", 40)}{field("company", "Company / team")}</div>
        <div className="space-y-2"><Label htmlFor="attendance">Are you attending Multiplexes Toronto 2026? *</Label><Select value={attendedEvent} onValueChange={setAttendedEvent}><SelectTrigger id="attendance"><SelectValue placeholder="Choose one" /></SelectTrigger><SelectContent><SelectItem value="yes">Yes, I’m at / attended the event</SelectItem><SelectItem value="registered">I’m registered to attend</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div>
        {field("location", "Property address, or target city / neighbourhood", true, "text", 300)}
        <div className="space-y-2"><Label htmlFor="stage">Project stage *</Label><Select value={stage} onValueChange={setStage}><SelectTrigger id="stage"><SelectValue placeholder="Choose your stage" /></SelectTrigger><SelectContent>{stages.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-5 sm:grid-cols-2">{field("units", "Planned number of homes", true, "number")}{field("timeline", "Target start / next milestone", true)}{field("totalBudget", "Estimated total project cost", false, "text", 80)}{field("capitalRequested", "Capital you’re seeking", false, "text", 80)}{field("ownCapital", "Your available project equity", false, "text", 80)}</div>
        <div className="space-y-2"><Label htmlFor="experience">Your experience and project team *</Label><Textarea id="experience" name="experience" required minLength={10} maxLength={3000} rows={4} placeholder="Relevant projects, your role, and who is helping you execute." /></div>
        <div className="space-y-2"><Label htmlFor="project">The project and what you need from us *</Label><Textarea id="project" name="project" required minLength={20} maxLength={5000} rows={5} placeholder="Proposed homes, site control, approvals, major assumptions, and the partnership you’re looking for." /></div>
        <div aria-hidden="true" className="hidden"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
        <div className="flex items-start gap-3"><Checkbox id="consent" checked={consent} onCheckedChange={value => setConsent(value === true)} /><Label htmlFor="consent" className="text-sm font-normal leading-relaxed">I agree that Realist may store and review this application and contact me about this project. This does not subscribe me to marketing. <Link href="/privacy" className="underline">Privacy policy</Link> *</Label></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy} className="h-12 w-full bg-[#101d2c] text-lg text-white hover:bg-slate-700">{busy ? "Saving application…" : "Submit my project"}</Button>
        </form>}
      </section>
    </main>
  </div>;
}
