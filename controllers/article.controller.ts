export const slugifyArticleTitle = (title: string): string => {
  if (!title) return "";
  return title
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\u0600-\u06FF\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
};

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
      const s = doc.url && doc.url.trim() ? doc.url.trim() : slugifyArticleTitle(doc.title);
      return { ...doc, id: doc._id.toString(), url: s };
    });
  }

  try {
    const categories = await CategoryModel.find({ _id: { $in: categoryIds } });

    if (categories && categories.length > 0) {
      const catMap = new Map(categories.map((c) => [c._id.toString(), c]));
      return articles.map((art) => {
        const doc = art.toObject ? art.toObject() : art;
        const idStr = doc._id.toString();
        const s = doc.url && doc.url.trim() ? doc.url.trim() : slugifyArticleTitle(doc.title);
        if (doc.category_id && catMap.has(doc.category_id)) {
          const cat = catMap.get(doc.category_id)!;
          return {
            ...doc,
            id: idStr,
            url: s,
            category_name: doc.category_name || cat.name,
            category_color: doc.category_color || cat.color,
          };
        }
        return { ...doc, id: idStr, url: s };
      });
    }
  } catch (err) {
    console.error('Category enrichment error:', err);
  }

  return articles.map(art => {
    const doc = art.toObject ? art.toObject() : art;
    const s = doc.url && doc.url.trim() ? doc.url.trim() : slugifyArticleTitle(doc.title);
    return { ...doc, id: doc._id.toString(), url: s };
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

    const { title, content, status, excerpt, category_id, category_name, category_color, url: customUrl } = parsed.data;
    
    // Auto-generate unique slug
    const baseSlug = customUrl && customUrl.trim() ? slugifyArticleTitle(customUrl) : (slugifyArticleTitle(title) || `article-${Date.now()}`);
    let uniqueSlug = baseSlug;
    let counter = 1;
    while (await ArticleModel.findOne({ url: uniqueSlug })) {
      uniqueSlug = `${baseSlug}-${counter++}`;
    }
    const user = (req as any).user;
    const authorName = user?.user_metadata?.first_name 
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim() 
      : (user?.name || 'مدرب الأكاديمية');

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
      category_color: catColor || '',
      author_id: user?.id || '',
      author_name: authorName,
      url: uniqueSlug
    });

    await newArticle.save();

    const data = {
      ...newArticle.toObject(),
      id: newArticle._id.toString(),
      url: uniqueSlug,
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
    const user = (req as any).user;
    const userRole = user?.role || user?.user_metadata?.role;
    
    const query = (userRole === 'instructor' && user?.id) 
      ? { author_id: user.id } 
      : {};

    const articles = await ArticleModel.find(query).sort({ createdAt: -1 });
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

    // 1. Try finding by url slug
    let article = await ArticleModel.findOne({ url: id, status: 'published' });
    
    // 2. Try finding by MongoDB ObjectId
    if (!article && id.match(/^[0-9a-fA-F]{24}$/)) {
      article = await ArticleModel.findOne({ _id: id, status: 'published' });
    }

    // 3. Fallback: match slugify(title)
    if (!article) {
      const published = await ArticleModel.find({ status: 'published' });
      article = published.find((a: any) => {
        const s = slugifyArticleTitle(a.url || a.title);
        return s === id || a.url === id;
      }) || null;

      // Auto-save slug if missing
      if (article && (!article.url || !article.url.trim())) {
        article.url = slugifyArticleTitle(article.title) || id;
        await article.save();
      }
    }
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

    let article = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      article = await ArticleModel.findById(id);
    }
    if (!article) {
      article = await ArticleModel.findOne({ url: id });
    }
    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    if (userRole !== 'admin' && article.author_id && article.author_id !== user?.id) {
      res.status(403).json({ error: 'You do not have permission to edit this article' });
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
    const user = (req as any).user;
    const userRole = user?.role || user?.user_metadata?.role;
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

    if (userRole !== 'admin' && article.author_id && article.author_id !== user?.id) {
      res.status(403).json({ error: 'You do not have permission to edit this article' });
      return;
    }

    const dataObj = parsed.data;

    if (dataObj.title !== undefined) {
      article.title = dataObj.title;
      if (!article.url || article.url.trim() === '') {
        article.url = slugifyArticleTitle(dataObj.title);
      }
    }
    if (dataObj.url !== undefined && dataObj.url.trim() !== '') {
      article.url = slugifyArticleTitle(dataObj.url);
    }
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
    const user = (req as any).user;
    const userRole = user?.role || user?.user_metadata?.role;

    const article = await ArticleModel.findById(id);
    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    if (userRole !== 'admin' && article.author_id && article.author_id !== user?.id) {
      res.status(403).json({ error: 'You do not have permission to delete this article' });
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
