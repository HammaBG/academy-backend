import { Request, Response } from 'express';
import 'multer';
import { cloudinary } from '../config/cloudinary';
import { 
  Article as ArticleModel, 
  createArticleSchema, 
  updateArticleSchema 
} from '../models/article.model';
import { Category as CategoryModel } from '../models/category.model';

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
const enrichArticlesWithCategory = async (articles: any[]): Promise<any[]> => {
  if (!articles || articles.length === 0) return articles;

  const categoryIds = Array.from(
    new Set(articles.map((a) => a.category_id).filter((id): id is string => Boolean(id)))
  );

  if (categoryIds.length === 0) {
    return articles.map(art => {
      const doc = art.toObject ? art.toObject() : art;
      return { ...doc, id: doc._id.toString() };
    });
  }

  try {
    const categories = await CategoryModel.find({ _id: { $in: categoryIds } });

    if (categories && categories.length > 0) {
      const catMap = new Map(categories.map((c) => [c._id.toString(), c]));
      return articles.map((art) => {
        const doc = art.toObject ? art.toObject() : art;
        const idStr = doc._id.toString();
        if (doc.category_id && catMap.has(doc.category_id)) {
          const cat = catMap.get(doc.category_id)!;
          return {
            ...doc,
            id: idStr,
            category_name: doc.category_name || cat.name,
            category_color: doc.category_color || cat.color,
          };
        }
        return { ...doc, id: idStr };
      });
    }
  } catch (err) {
    console.error('Category enrichment error:', err);
  }

  return articles.map(art => {
    const doc = art.toObject ? art.toObject() : art;
    return { ...doc, id: doc._id.toString() };
  });
};

// POST /api/articles ? create article with image
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
      const catData = await CategoryModel.findById(category_id);
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

    const newArticle = new ArticleModel({
      title,
      content,
      status,
      excerpt: excerpt || '',
      image_url,
      category_id: category_id || '',
      category_name: catName || '',
      category_color: catColor || ''
    });

    await newArticle.save();

    const data = {
      ...newArticle.toObject(),
      id: newArticle._id.toString(),
      category_name: newArticle.category_name || catName,
      category_color: newArticle.category_color || catColor,
    };

    res.status(201).json({ data });
  } catch (err) {
    console.error('Create article error:', err);
    res.status(500).json({ error: 'Failed to create article' });
  }
};

// GET /api/articles/public ? get only published articles (Public)
export const getPublicArticles = async (req: Request, res: Response): Promise<void> => {
  try {
    const articles = await ArticleModel.find({ status: 'published' }).sort({ createdAt: -1 });
    const enriched = await enrichArticlesWithCategory(articles || []);
    res.status(200).json({ data: enriched });
  } catch (err) {
    console.error('Get public articles error:', err);
    res.status(500).json({ error: 'Failed to fetch public articles' });
  }
};

// GET /api/articles ? get all articles
export const getAllArticles = async (req: Request, res: Response): Promise<void> => {
  try {
    const articles = await ArticleModel.find().sort({ createdAt: -1 });
    const enriched = await enrichArticlesWithCategory(articles || []);
    res.status(200).json({ data: enriched });
  } catch (err) {
    console.error('Get articles error:', err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
};

// GET /api/articles/public/:id ? get single published article (Public)
export const getPublicArticleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const article = await ArticleModel.findOne({ _id: id, status: 'published' });
    if (!article) {
      res.status(404).json({ error: 'Article not found or not published' });
      return;
    }

    const [enriched] = await enrichArticlesWithCategory([article]);
    res.status(200).json({ data: enriched });
  } catch (err) {
    console.error('Get public article error:', err);
    res.status(500).json({ error: 'Failed to fetch public article' });
  }
};

// GET /api/articles/:id ? get single article
export const getArticleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const article = await ArticleModel.findById(id);
    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    const [enriched] = await enrichArticlesWithCategory([article]);
    res.status(200).json({ data: enriched });
  } catch (err) {
    console.error('Get article error:', err);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
};

// PUT /api/articles/:id ? update article with optional image replacement
export const updateArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parsed = updateArticleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
      return;
    }

    const article = await ArticleModel.findById(id);
    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    const dataObj = parsed.data;

    if (dataObj.title !== undefined) article.title = dataObj.title;
    if (dataObj.content !== undefined) article.content = dataObj.content;
    if (dataObj.status !== undefined) article.status = dataObj.status;
    if (dataObj.excerpt !== undefined) article.excerpt = dataObj.excerpt;
    if (dataObj.category_id !== undefined) article.category_id = dataObj.category_id;
    if (dataObj.category_name !== undefined) article.category_name = dataObj.category_name;
    if (dataObj.category_color !== undefined) article.category_color = dataObj.category_color;

    if (dataObj.category_id && (!article.category_name || !article.category_color)) {
      const catData = await CategoryModel.findById(dataObj.category_id);
      if (catData) {
        article.category_name = article.category_name || catData.name;
        article.category_color = article.category_color || catData.color;
      }
    }

    // If new image uploaded, replace it
    if (req.file) {
      if (article.image_url) {
        const publicId = article.image_url.split('/').pop()?.split('.')[0];
        if (publicId) {
          await cloudinary.uploader.destroy(`articles/${publicId}`);
        }
      }

      const filename = `article-${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
      article.image_url = await uploadToCloudinary(req.file.buffer, filename);
    }

    await article.save();

    const [enriched] = await enrichArticlesWithCategory([article]);
    res.status(200).json({ data: enriched });
  } catch (err) {
    console.error('Update article error:', err);
    res.status(500).json({ error: 'Failed to update article' });
  }
};

// DELETE /api/articles/:id ? delete article and its image
export const deleteArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const article = await ArticleModel.findById(id);
    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    if (article.image_url) {
      const publicId = article.image_url.split('/').pop()?.split('.')[0];
      if (publicId) {
        await cloudinary.uploader.destroy(`articles/${publicId}`);
      }
    }

    await ArticleModel.findByIdAndDelete(id);

    res.status(200).json({ message: 'Article deleted successfully' });
  } catch (err) {
    console.error('Delete article error:', err);
    res.status(500).json({ error: 'Failed to delete article' });
  }
};
