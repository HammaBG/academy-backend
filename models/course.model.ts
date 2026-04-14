import { z } from "zod";

export interface IComment {
  user: any;
  question: string;
  question_replies: IComment[];
}

export interface IReview {
  user: any;
  rating?: number;
  comment: string;
  comment_replies?: IReview[];
}

export interface ILink {
  title: string;
  url: string;
  public_id?: string;
  source: "url" | "file";
}

export interface IAnswers {
  answer: string;
  is_correct: boolean;
}

export interface IQuestions {
  question: string;
  answers: IAnswers[];
}

export interface ITest {
  duration: number;
  questions: IQuestions[];
}

export interface ICourseData {
  id?: string;
  title: string;
  description: string;
  video_url: string;
  video_thumbnail: object;
  video_section: string;
  video_length: number;
  video_player: string;
  links: ILink[];
  suggestion: string;
  questions: IComment[];
}

export interface ICourse {
  id: string;
  name: string;
  description: string;
  short_description: string;
  categories: string;
  price: number;
  estimated_price?: number;
  thumbnail: {
    public_id: string;
    url: string;
  };
  tags: string;
  level: string;
  demo_url: string;
  benefits: { title: string }[];
  prerequisites: { title: string }[];
  reviews: IReview[];
  course_data: ICourseData[];
  ratings?: number;
  purchased: number;
  creator: any;
  status: boolean;
  ready: boolean;
  url: string;
  test: ITest;
  fake_user: number;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

// Zod schemas for validation
export const createCourseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  short_description: z.string().min(1, "Short description is required"),
  categories: z.string().min(1, "Categories are required"),
  price: z.coerce.number().optional(),
  estimated_price: z.coerce.number().optional(),
  thumbnail: z.object({
    public_id: z.string().optional(),
    url: z.string().optional(),
  }).optional(),
  tags: z.string().min(1, "Tags are required"),
  level: z.string().min(1, "Level is required"),
  demo_url: z.string().optional(),
  benefits: z.array(z.object({ title: z.string() })),
  prerequisites: z.array(z.object({ title: z.string() })),
  course_data: z.array(z.any()), // More detailed validation can be added
  test: z.any().optional(),
  status: z.boolean().default(false),
  ready: z.boolean().default(false),
  url: z.string().optional(),
  fake_user: z.number().optional(),
  display_order: z.number().optional(),
});

export const updateCourseSchema = createCourseSchema.partial();
