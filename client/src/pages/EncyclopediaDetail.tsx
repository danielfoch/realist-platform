import { Link, useRoute } from "wouter";
import { ArrowLeft, Calculator, CheckCircle2 } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getEncyclopediaGuide,
  getEncyclopediaToolSpec,
} from "@shared/encyclopedia";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-muted-foreground leading-7">{children}</div>
    </section>
  );
}

export default function EncyclopediaDetail() {
  const [, params] = useRoute("/insights/encyclopedia/:slug");
  const guide = getEncyclopediaGuide(params?.slug);
  const toolSpec = getEncyclopediaToolSpec(guide?.toolSpecSlug);

  if (!guide) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title="Encyclopedia Entry Not Found"
          description="This Realist.ca encyclopedia entry could not be found."
          canonicalUrl="/insights/encyclopedia"
          noIndex
        />
        <Navigation />
        <main className="container mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="mb-4 text-muted-foreground">This encyclopedia entry could not be found.</p>
          <Link href="/insights/encyclopedia">
            <Button>Browse Encyclopedia</Button>
          </Link>
        </main>
      </div>
    );
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary,
    mainEntityOfPage: `https://realist.ca${guide.canonicalPath}`,
    publisher: {
      "@type": "Organization",
      name: "Realist.ca",
      url: "https://realist.ca",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${guide.title} - Real Estate Investor Encyclopedia`}
        description={guide.summary}
        canonicalUrl={guide.canonicalPath}
        keywords={[guide.title, guide.slug, guide.category, ...(guide.tags ?? []), ...(guide.searchKeywords ?? [])].join(", ")}
        ogType="article"
        structuredData={structuredData}
      />
      <Navigation />

      <main className="container mx-auto max-w-5xl px-4 py-10">
        <Link href="/insights/encyclopedia">
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Encyclopedia
          </Button>
        </Link>

        <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <header className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{guide.category}</Badge>
                {guide.difficulty && <Badge variant="outline">{guide.difficulty}</Badge>}
                {toolSpec && <Badge variant="outline">Calculator spec</Badge>}
              </div>
              <h1 className="text-4xl font-bold tracking-tight">{guide.title}</h1>
            </header>

            <Section title="Summary">
              <p>{guide.summary}</p>
            </Section>
            <Section title="Definition">
              <p>{guide.definition}</p>
            </Section>
            {guide.formula && (
              <Section title="Formula">
                <p className="rounded-md bg-muted p-4 font-mono text-sm text-foreground">{guide.formula}</p>
              </Section>
            )}
            {guide.example && (
              <Section title="Example">
                <p>{guide.example}</p>
              </Section>
            )}
            <Section title="Why It Matters">
              <p>{guide.whyItMatters}</p>
            </Section>
            {guide.investorInterpretation && (
              <Section title="Investor Interpretation">
                <p>{guide.investorInterpretation}</p>
              </Section>
            )}
            {guide.commonMistakes && guide.commonMistakes.length > 0 && (
              <Section title="Common Mistakes">
                <ul className="list-disc space-y-2 pl-5">
                  {guide.commonMistakes.map((mistake) => (
                    <li key={mistake}>{mistake}</li>
                  ))}
                </ul>
              </Section>
            )}
            {guide.realistTieIn && (
              <Section title="Realist Tie-In">
                <p>{guide.realistTieIn}</p>
              </Section>
            )}
            {guide.sourceCaveatNotes && (
              <Section title="Caveats">
                <p>{guide.sourceCaveatNotes}</p>
              </Section>
            )}
            {guide.relatedTerms && guide.relatedTerms.length > 0 && (
              <Section title="Related Terms">
                <div className="flex flex-wrap gap-2">
                  {guide.relatedTerms.map((term) => {
                    const relatedGuide = getEncyclopediaGuide(term);
                    const relatedTool = getEncyclopediaToolSpec(term);
                    if (relatedGuide) {
                      return (
                        <Link key={term} href={`/insights/encyclopedia/${term}`}>
                          <Badge variant="outline" className="cursor-pointer">{relatedGuide.title}</Badge>
                        </Link>
                      );
                    }
                    return (
                      <Badge key={term} variant="outline">
                        {relatedTool?.title || term.replace(/-/g, " ")}
                      </Badge>
                    );
                  })}
                </div>
              </Section>
            )}
            <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
              Educational content only. Verify tax, legal, lending, insurance, appraisal, construction, and local-rule assumptions with qualified professionals and current source documents.
            </p>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {toolSpec ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{toolSpec.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    {toolSpec.uiCopy?.headline || toolSpec.userProblem}
                  </p>
                  <Link href={`/tools/analyzer?calculator=${toolSpec.slug}`}>
                    <Button className="w-full gap-2">
                      <Calculator className="h-4 w-4" />
                      {toolSpec.uiCopy?.primaryCta || "Run the numbers"}
                    </Button>
                  </Link>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Inputs</h3>
                    <div className="space-y-2">
                      {toolSpec.inputs.map((input) => (
                        <div key={input.name} className="rounded-md border p-2 text-sm">
                          <div className="font-medium">{input.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {input.type}{input.unit ? ` · ${input.unit}` : ""}{input.required ? " · required" : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Outputs</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {toolSpec.outputs.map((output) => (
                        <Badge key={output} variant="secondary">{output}</Badge>
                      ))}
                    </div>
                  </div>
                  {toolSpec.formulaNotes && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Formula Notes</h3>
                      <p className="text-sm text-muted-foreground">{toolSpec.formulaNotes}</p>
                    </div>
                  )}
                  {toolSpec.validationRules && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Validation Rules</h3>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {toolSpec.validationRules.map((rule) => (
                          <li key={rule} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {toolSpec.uiCopy?.caveat && (
                    <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{toolSpec.uiCopy.caveat}</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">
                    This entry is informational and does not have a calculator spec yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </aside>
        </article>
      </main>
    </div>
  );
}
