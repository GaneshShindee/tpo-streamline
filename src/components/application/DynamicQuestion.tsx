import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { DynamicQuestion as DQ } from "@/types/application";

type Props = {
  question: DQ;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function DynamicQuestionField({ question, value, onChange, disabled }: Props) {
  if (question.options?.length) {
    if (question.isMultiChoice) {
      const selected = new Set(
        value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      );
      return (
        <div className="space-y-2">
          <Label>{question.question}</Label>
          <div className="space-y-2 rounded-md border p-3">
            {question.options.map((option) => {
              const checked = selected.has(option.answer);
              return (
                <label key={String(option.id)} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(next) => {
                      const copy = new Set(selected);
                      if (next) copy.add(option.answer);
                      else copy.delete(option.answer);
                      onChange(Array.from(copy).join(", "));
                    }}
                  />
                  <span>{option.answer}</span>
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        <Label htmlFor={`q-${question.id}`}>{question.question}</Label>
        <select
          id={`q-${question.id}`}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Select an answer —</option>
          {question.options.map((option) => (
            <option key={String(option.id)} value={option.answer}>
              {option.answer}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const useTextarea = (question.question?.length ?? 0) > 60 || /address|describe|explain|why|link|url/i.test(question.question);
  const id = `q-${question.id}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{question.question}</Label>
      {useTextarea ? (
        <Textarea
          id={id}
          rows={3}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}