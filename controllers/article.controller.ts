import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { cloudinary } from '../config/cloudinary';
import { 
  Article, 
  createArticleSchema, 
  updateArticleSchema 
} from '../models/article.model';

// Helper: upload buffer to Cloudinary
const uploadToCloudinary = (buffer: Buffer, filename: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'articles', public_id: filename },
      (error, result) => {
        if (error) return reject(error);
        resolve(result!.secure_url);
      }
    );
    stream.end(buffer);
  });
};

// POST /api/articles — create article with image
export const createArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createArticleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
      return;
    }

    const { title, content, status, excerpt } = parsed.data;

    let image_url = '';
    if (req.file) {
      const filename = `article-${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
      image_url = await uploadToCloudinary(req.file.buffer, filename);
    }

    const { data, error } = await supabaseAdmin
      .from('articles')
      .insert({ title, content, status, excerpt, image_url })
      .select()
      .returns<Article>()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ data });
  } catch (err) {
    console.error('Create article error:', err);
    res.status(500).json({ error: 'Failed to create article' });
  }
};

// GET /api/articles/public — get only published articles (Public)
export const getPublicArticles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .returns<Article[]>();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({ data });
  } catch (err) {
    console.error('Get public articles error:', err);
    res.status(500).json({ error: 'Failed to fetch public articles' });
  }
};

// GET /api/articles — get all articles
export const getAllArticles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false })
      .returns<Article[]>();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({ data });
  } catch (err) {
    console.error('Get articles error:', err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
};

// GET /api/articles/public/:id — get single published article (Public)
export const getPublicArticleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('articles')
      .select('*')
      .eq('id', id)
      .eq('status', 'published')
      .returns<Article>()
      .single();

    if (error) {
      res.status(404).json({ error: 'Article not found or not published' });
      return;
    }

    res.status(200).json({ data });
  } catch (err) {
    console.error('Get public article error:', err);
    res.status(500).json({ error: 'Failed to fetch public article' });
  }
};

// GET /api/articles/:id — get single article
export const getArticleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('articles')
      .select('*')
      .eq('id', id)
      .returns<Article>()
      .single();

    if (error) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    res.status(200).json({ data });
  } catch (err) {
    console.error('Get article error:', err);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
};

// PUT /api/articles/:id — update article with optional image replacement
export const updateArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parsed = updateArticleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
      return;
    }

    const updates: Record<string, unknown> = { ...parsed.data };

    // If new image uploaded, replace it
    if (req.file) {
      // Delete old image from Cloudinary
      const oldArticle = await supabaseAdmin
        .from('articles')
        .select('image_url')
        .eq('id', id)
        .single();

      if (oldArticle.data?.image_url) {
        const publicId = oldArticle.data.image_url.split('/').pop()?.split('.')[0];
        if (publicId) {
          await cloudinary.uploader.destroy(`articles/${publicId}`);
        }
      }

      const filename = `article-${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
      updates.image_url = await uploadToCloudinary(req.file.buffer, filename);
    }

    const { data, error } = await supabaseAdmin
      .from('articles')
      .update(updates)
      .eq('id', id)
      .select()
      .returns<Article>()
      .single();

    if (error) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    res.status(200).json({ data });
  } catch (err) {
    console.error('Update article error:', err);
    res.status(500).json({ error: 'Failed to update article' });
  }
};

// DELETE /api/articles/:id — delete article and its image
export const deleteArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Get image_url to delete from Cloudinary
    const { data: article } = await supabaseAdmin
      .from('articles')
      .select('image_url')
      .eq('id', id)
      .single();

    if (article?.image_url) {
      const publicId = article.image_url.split('/').pop()?.split('.')[0];
      if (publicId) {
        await cloudinary.uploader.destroy(`articles/${publicId}`);
      }
    }

    const { error } = await supabaseAdmin
      .from('articles')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    res.status(200).json({ message: 'Article deleted successfully' });
  } catch (err) {
    console.error('Delete article error:', err);
    res.status(500).json({ error: 'Failed to delete article' });
  }
};
