import { Request, Response } from 'express';
import 'multer';
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

// Helper: attach category details to articles list
const enrichArticlesWithCategory = async (articles: Article[]): Promise<Article[]> => {
  if (!articles || articles.length === 0) return articles;

  const categoryIds = Array.from(
    new Set(articles.map((a) => a.category_id).filter((id): id is string => Boolean(id)))
  );

  if (categoryIds.length === 0) return articles;

  try {
    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('id, name, color')
      .in('id', categoryIds);

    if (categories && categories.length > 0) {
      const catMap = new Map(categories.map((c) => [c.id, c]));
      return articles.map((art) => {
        if (art.category_id && catMap.has(art.category_id)) {
          const cat = catMap.get(art.category_id)!;
          return {
            ...art,
            category_name: art.category_name || cat.name,
            category_color: art.category_color || cat.color,
          };
        }
        return art;
      });
    }
  } catch (err) {
    console.error('Category enrichment error:', err);
  }

  return articles;
};

// POST /api/articles — create article with image
export const createArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createArticleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
      return;
    }

    const { title, content, status, excerpt, category_id, category_name, category_color } = parsed.data;

    let catName = category_name;
    let catColor = category_color;

    if (category_id && (!catName || !catColor)) {
      const { data: catData } = await supabaseAdmin
        .from('categories')
        .select('name, color')
        .eq('id', category_id)
        .single();
      if (catData) {
        catName = catName || catData.name;
        catColor = catColor || catData.color;
      }
    }

    let image_url = '';
    if (req.file) {
      const filename = `article-${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
      image_url = await uploadToCloudinary(req.file.buffer, filename);
    }

    const insertPayload: Record<string, unknown> = {
      title,
      content,
      status,
    };
    if (excerpt) insertPayload.excerpt = excerpt;
    if (image_url) insertPayload.image_url = image_url;
    if (category_id) insertPayload.category_id = category_id;
    if (catName) insertPayload.category_name = catName;
    if (catColor) insertPayload.category_color = catColor;

    let { data, error } = await supabaseAdmin
      .from('articles')
      .insert(insertPayload)
      .select()
      .returns<Article[]>()
      .single();

    // Fallback if category_name or category_color columns don't exist in Supabase table schema
    if (error && (error.message.includes('category_name') || error.message.includes('category_color'))) {
      delete insertPayload.category_name;
      delete insertPayload.category_color;

      const fallback = await supabaseAdmin
        .from('articles')
        .insert(insertPayload)
        .select()
        .returns<Article[]>()
        .single();

      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) {
      res.status(400).json({ error: error?.message || 'Failed to create article' });
      return;
    }

    const result = {
      ...data,
      category_name: data.category_name || catName,
      category_color: data.category_color || catColor,
    };

    res.status(201).json({ data: result });
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

    const enriched = await enrichArticlesWithCategory(data || []);
    res.status(200).json({ data: enriched });
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

    const enriched = await enrichArticlesWithCategory(data || []);
    res.status(200).json({ data: enriched });
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
      .returns<Article[]>()
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Article not found or not published' });
      return;
    }

    const [enriched] = await enrichArticlesWithCategory([data]);
    res.status(200).json({ data: enriched });
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
      .returns<Article[]>()
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    const [enriched] = await enrichArticlesWithCategory([data]);
    res.status(200).json({ data: enriched });
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

    const updates: Record<string, unknown> = {};
    const dataObj = parsed.data;

    if (dataObj.title !== undefined) updates.title = dataObj.title;
    if (dataObj.content !== undefined) updates.content = dataObj.content;
    if (dataObj.status !== undefined) updates.status = dataObj.status;
    if (dataObj.excerpt !== undefined) updates.excerpt = dataObj.excerpt;
    if (dataObj.category_id !== undefined) updates.category_id = dataObj.category_id;
    if (dataObj.category_name !== undefined) updates.category_name = dataObj.category_name;
    if (dataObj.category_color !== undefined) updates.category_color = dataObj.category_color;

    if (updates.category_id && (!updates.category_name || !updates.category_color)) {
      const { data: catData } = await supabaseAdmin
        .from('categories')
        .select('name, color')
        .eq('id', updates.category_id as string)
        .single();
      if (catData) {
        updates.category_name = updates.category_name || catData.name;
        updates.category_color = updates.category_color || catData.color;
      }
    }

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

    let { data, error } = await supabaseAdmin
      .from('articles')
      .update(updates)
      .eq('id', id)
      .select()
      .returns<Article[]>()
      .single();

    // Fallback if category_name or category_color columns don't exist in Supabase table schema
    if (error && (error.message.includes('category_name') || error.message.includes('category_color'))) {
      delete updates.category_name;
      delete updates.category_color;

      const fallback = await supabaseAdmin
        .from('articles')
        .update(updates)
        .eq('id', id)
        .select()
        .returns<Article[]>()
        .single();

      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    const [enriched] = await enrichArticlesWithCategory([data]);
    res.status(200).json({ data: enriched });
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
