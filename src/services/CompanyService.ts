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
      const id = Number(q.id ?? q.question_id ?? q.questionId ?? q.offeringquestionquestion_id ?? 0);
      const question = String(q.question ?? q.questionText ?? q.label ?? q.title ?? `Question ${id}`);
      const type = q.question_type == null ? undefined : String(q.question_type);
      const optionRows = Array.isArray(q.optionlist)
        ? q.optionlist
        : Array.isArray(q.options)
          ? q.options
          : [];
      const options = optionRows
        .filter((option): option is Record<string, unknown> => !!option && typeof option === "object")
        .map((option, index) => ({
          id: option.id == null || option.id === "" ? index : (option.id as number | string),
          answer: String(option.answer ?? option.label ?? option.name ?? option.value ?? option.text ?? ""),
          remark: option.option_remark == null ? undefined : String(option.option_remark),
        }))
        .filter((option) => option.answer.trim() !== "");
      return {
        id,
        question,
        type,
        isChoice: Boolean(q.question_choice) || options.length > 0,
        isMultiChoice: Boolean(q.question_multichoice) || /multi/i.test(type ?? ""),
        options,
      };
    })
    .filter((q) => q.id > 0);
}