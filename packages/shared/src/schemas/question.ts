import { z } from 'zod';

export const questionTypeSchema = z.enum([
  'single_choice',
  'multi_choice',
  'fill_blank',
  'short_answer',
]);

export type QuestionType = z.infer<typeof questionTypeSchema>;

export const questionSchema = z.object({
  type: questionTypeSchema,
  stem: z.string().min(1),
  options: z.array(z.string()).optional(),
  answer: z.string().min(1),
  explanation: z.string().optional(),
  categoryHint: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type Question = z.infer<typeof questionSchema>;
