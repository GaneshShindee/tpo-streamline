import { fetchCompanies, fetchCompanyOfferingInfo, fetchOfferingQuestions } from "@/lib/tpo/api";
import { parseOfferingInfo } from "@/lib/tpo/parseOfferingInfo";
import type { CompanyOffering, DynamicQuestion } from "@/types/application";

export const CompanyService = {
  list: () => fetchCompanies(),
  async getOffering(offeringId: number): Promise<CompanyOffering> {
    const [infoData, questionsData] = await Promise.all([
      fetchCompanyOfferingInfo(offeringId).catch(() => ({})),
      fetchOfferingQuestions(offeringId).catch(() => ({})),
    ]);
    const offering = parseOfferingInfo(infoData, offeringId);
    const liveQuestions = parseOfferingQuestions(questionsData);
    if (liveQuestions.length) offering.questions = liveQuestions;
    return offering;
  },
};

function parseOfferingQuestions(data: unknown): DynamicQuestion[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  const list =
    (Array.isArray(root.offering_questions_list) && root.offering_questions_list) ||
    (Array.isArray(root.offeringQuestionsList) && root.offeringQuestionsList) ||
    (Array.isArray(root.questions) && root.questions) ||
    [];
  return (list as unknown[])
    .filter((q): q is Record<string, unknown> => !!q && typeof q === "object")
    .map((q) => {
      const id = Number(q.id ?? q.question_id ?? q.questionId ?? 0);
      const question = String(q.question ?? q.questionText ?? q.label ?? `Question ${id}`);
      return { id, question };
    })
    .filter((q) => q.id > 0);
}