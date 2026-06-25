import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { applyToCompany, fetchCompanies, fetchCompanyOffering } from "@/lib/tpo/api";
import { extractCompanies, extractOfferingDetail, type DynamicQuestion } from "@/lib/tpo/normalize";
import { addHistory } from "@/lib/tpo/credentials";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";

const searchSchema = z.object({ apply: z.coerce.number().optional() });

export const Route = createFileRoute("/companies/$offeringId")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Company details — TPO Assistant" }] }),
  component: CompanyDetailsPage,
});

type Stage = "details" | "form" | "review" | "result";

function CompanyDetailsPage() {
  const { offeringId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const offering = Number(offeringId);

  const companiesQ = useQuery({ queryKey: ["companies"], queryFn: fetchCompanies, staleTime: 60_000 });
  const detailQ = useQuery({
    queryKey: ["offering", offering],
    queryFn: () => fetchCompanyOffering(offering),
    enabled: !Number.isNaN(offering),
  });

  const company = useMemo(
    () => extractCompanies(companiesQ.data).find((c) => c.id === offering),
    [companiesQ.data, offering],
  );
  const detail = useMemo(() => (detailQ.data ? extractOfferingDetail(detailQ.data) : null), [detailQ.data]);

  const [stage, setStage] = useState<Stage>("details");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [cvFile, setCvFile] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; response: unknown; timestamp: number } | null>(null);

  useEffect(() => {
    if (search.apply && detail) setStage("form");
  }, [search.apply, detail]);

  useEffect(() => {
    if (detail?.cvOptions?.[0]?.id && !cvFile) setCvFile(String(detail.cvOptions[0].id));
  }, [detail, cvFile]);

  function setAnswer(id: number, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function validateForm(): string | null {
    if (!detail) return "Loading…";
    if (detail.cvOptions.length > 0 && !cvFile) return "Please select a resume.";
    for (const q of detail.questions) {
      if (q.required && !(answers[q.id]?.trim())) return `"${q.question}" is required.`;
    }
    return null;
  }

  async function submit() {
    if (!detail) return;
    setSubmitting(true);
    const payload = {
      companyOfferingid: offering,
      cvFile: cvFile || 0,
      questions: detail.questions.map((q) => ({ id: q.id, answer: answers[q.id] ?? "" })),
    };
    try {
      const res = await applyToCompany(payload);
      setResult({ ok: true, response: res, timestamp: Date.now() });
      addHistory({
        id: `${offering}-${Date.now()}`,
        companyName: company?.name ?? `Offering ${offering}`,
        companyOfferingId: offering,
        timestamp: Date.now(),
        answers: detail.questions.map((q) => ({ id: q.id, question: q.question, answer: answers[q.id] ?? "" })),
        cvFile: Number(cvFile) || null,
        status: "success",
        response: res,
      });
      toast.success("Application submitted");
      setStage("result");
    } catch (err) {
      const message = (err as Error).message;
      setResult({ ok: false, response: { error: message }, timestamp: Date.now() });
      addHistory({
        id: `${offering}-${Date.now()}`,
        companyName: company?.name ?? `Offering ${offering}`,
        companyOfferingId: offering,
        timestamp: Date.now(),
        answers: detail.questions.map((q) => ({ id: q.id, question: q.question, answer: answers[q.id] ?? "" })),
        cvFile: Number(cvFile) || null,
        status: "failure",
        response: { error: message },
      });
      toast.error("Submission failed", { description: message });
      setStage("result");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/companies"><ArrowLeft className="mr-1 size-4" />Back to companies</Link>
        </Button>
      </div>

      {detailQ.isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Loading…
        </div>
      )}
      {detailQ.isError && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="font-medium">Couldn't load company details</p>
              <p className="text-muted-foreground">{(detailQ.error as Error).message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {detail && (
        <>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>{company?.name ?? `Offering #${offering}`}</CardTitle>
              {company?.package && <CardDescription>{company.package}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {detail.jobDescription && <Block title="Job description" body={detail.jobDescription} />}
              {detail.eligibility && <Block title="Eligibility" body={detail.eligibility} />}
              {detail.hiringProcess && <Block title="Hiring process" body={detail.hiringProcess} />}
              {detail.attachments.length > 0 && (
                <div>
                  <p className="mb-1 font-medium">Attachments</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {detail.attachments.map((a) => <li key={a.id}>{a.name}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {stage === "details" && (
            <div className="flex justify-end">
              <Button onClick={() => setStage("form")}>Start application</Button>
            </div>
          )}

          {stage === "form" && (
            <Card>
              <CardHeader>
                <CardTitle>Application form</CardTitle>
                <CardDescription>Answer the questions and pick a resume.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {detail.cvOptions.length > 0 ? (
                  <div className="space-y-1.5">
                    <Label>Resume</Label>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={cvFile}
                      onChange={(e) => setCvFile(e.target.value)}
                    >
                      <option value="">Select a resume</option>
                      {detail.cvOptions.map((c) => (
                        <option key={String(c.id)} value={String(c.id)}>{c.name} (#{c.id})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Resume / CV file ID</Label>
                    <Input
                      placeholder="Enter cvFile ID (e.g. 37925)"
                      value={cvFile}
                      onChange={(e) => setCvFile(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">No resume options were returned; enter your stored CV file ID.</p>
                  </div>
                )}

                {detail.questions.map((q) => (
                  <QuestionField key={q.id} q={q} value={answers[q.id] ?? ""} onChange={(v) => setAnswer(q.id, v)} />
                ))}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStage("details")}>Back</Button>
                  <Button
                    onClick={() => {
                      const err = validateForm();
                      if (err) toast.error(err);
                      else setStage("review");
                    }}
                  >
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {stage === "review" && (
            <Card>
              <CardHeader>
                <CardTitle>Review your application</CardTitle>
                <CardDescription>Confirm your answers before submitting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border p-3 text-sm">
                  <p><span className="text-muted-foreground">Company:</span> <span className="font-medium">{company?.name ?? offering}</span></p>
                  <p><span className="text-muted-foreground">Offering ID:</span> {offering}</p>
                  <p><span className="text-muted-foreground">Resume ID:</span> {cvFile || "—"}</p>
                </div>
                <ul className="divide-y rounded-md border">
                  {detail.questions.map((q) => (
                    <li key={q.id} className="p-3 text-sm">
                      <p className="text-muted-foreground">{q.question}</p>
                      <p className="mt-0.5 font-medium whitespace-pre-wrap">{answers[q.id] || <span className="text-muted-foreground">(empty)</span>}</p>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setStage("form")} disabled={submitting}>Edit</Button>
                  <Button onClick={submit} disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Confirm & submit
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {stage === "result" && result && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  {result.ok ? (
                    <CheckCircle2 className="size-5 text-green-500" />
                  ) : (
                    <XCircle className="size-5 text-destructive" />
                  )}
                  <CardTitle>{result.ok ? "Application submitted" : "Submission failed"}</CardTitle>
                </div>
                <CardDescription>{new Date(result.timestamp).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
{JSON.stringify(result.response, null, 2)}
                </pre>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => navigate({ to: "/companies" })}>Back to companies</Button>
                  <Button onClick={() => navigate({ to: "/history" })}>View history</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      <p className="whitespace-pre-wrap text-muted-foreground">{body}</p>
    </div>
  );
}

function QuestionField({ q, value, onChange }: { q: DynamicQuestion; value: string; onChange: (v: string) => void }) {
  const label = (
    <Label>
      {q.question}
      {q.required ? <span className="ml-1 text-destructive">*</span> : <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
    </Label>
  );
  if (q.type === "textarea") {
    return (
      <div className="space-y-1.5">
        {label}
        <Textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  if (q.type === "dropdown") {
    return (
      <div className="space-y-1.5">
        {label}
        <select
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(q.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {label}
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}