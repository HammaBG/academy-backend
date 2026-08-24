import mongoose, { Schema } from "mongoose";
import { z } from "zod";

export interface IComment {
  id?: string;
  _id?: string;
  user: any;
  question: string;
  question_replies: IComment[];
  created_at?: string;
}

export interface IReview {
  user: any;
  rating?: number;
  comment: string;
  comment_replies?: IReview[];
  created_at?: string;
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
  _id?: string;
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
  id?: string;
  _id?: string;
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
  course_data: z.array(z.any()),
  test: z.any().optional(),
  status: z.boolean().default(false),
  ready: z.boolean().default(false),
  url: z.string().optional(),
  fake_user: z.number().optional(),
  display_order: z.number().optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

// Mongoose Schemas
const CommentSchema = new Schema({
  id: { type: String },
  user: { type: Object, required: true },
  question: { type: String, required: true },
  question_replies: { type: [Object], default: [] },
  created_at: { type: Date, default: Date.now }
}, { _id: true });

const LinkSchema = new Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  public_id: { type: String },
  source: { type: String, enum: ["url", "file"], default: "url" }
});

const CourseDataSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  video_url: { type: String, required: true },
  video_thumbnail: { type: Object },
  video_section: { type: String, required: true },
  video_length: { type: Number, default: 0 },
  video_player: { type: String, default: "" },
  links: { type: [LinkSchema], default: [] },
  suggestion: { type: String, default: "" },
  questions: { type: [CommentSchema], default: [] }
}, { _id: true });

const ReviewSchema = new Schema({
  user: { type: Object, required: true },
  rating: { type: Number, default: 0 },
  comment: { type: String, required: true },
  comment_replies: { type: [Object], default: [] },
  created_at: { type: Date, default: Date.now }
});

const CourseSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  short_description: { type: String, required: true },
  categories: { type: String, required: true },
  price: { type: Number, default: 0 },
  estimated_price: { type: Number, default: 0 },
  thumbnail: {
    public_id: { type: String, default: "" },
    url: { type: String, default: "" }
  },
  tags: { type: String, required: true },
  level: { type: String, required: true },
  demo_url: { type: String, default: "" },
  benefits: { type: [{ title: String }], default: [] },
  prerequisites: { type: [{ title: String }], default: [] },
  reviews: { type: [ReviewSchema], default: [] },
  course_data: { type: [CourseDataSchema], default: [] },
  ratings: { type: Number, default: 0 },
  purchased: { type: Number, default: 0 },
  creator: { type: String, required: true },
  status: { type: Boolean, default: false },
  ready: { type: Boolean, default: false },
  url: { type: String, default: "" },
  test: { type: Object, default: {} },
  fake_user: { type: Number, default: 0 },
  display_order: { type: Number, default: 0 }
}, {
  timestamps: true
});

export const Course = mongoose.models.Course || mongoose.model("Course", CourseSchema);
