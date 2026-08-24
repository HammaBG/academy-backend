import { Request, Response } from 'express';
import { 
  Category as CategoryModel, 
  createCategorySchema, 
  updateCategorySchema 
} from '../models/category.model';

// POST /api/categories ? create category
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
      return;
    }

    const { name, color, description } = parsed.data;

    const newCategory = new CategoryModel({ name, color, description });
    await newCategory.save();

    const data = {
      ...newCategory.toObject(),
      id: newCategory._id.toString()
    };

    res.status(201).json({ data });
  } catch (err: any) {
    console.error('Create category error:', err);
    res.status(500).json({ error: err.message || 'Failed to create category' });
  }
};

// GET /api/categories ? get all categories
export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await CategoryModel.find().sort({ name: 1 });
    
    const data = categories.map(c => ({
      ...c.toObject(),
      id: c._id.toString()
    }));

    res.status(200).json({ data });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

// GET /api/categories/:id ? get single category
export const getCategoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await CategoryModel.findById(id);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const data = {
      ...category.toObject(),
      id: category._id.toString()
    };

    res.status(200).json({ data });
  } catch (err) {
    console.error('Get category error:', err);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

// PUT /api/categories/:id ? update category
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
      return;
    }

    const { name, color, description } = parsed.data;

    const category = await CategoryModel.findById(id);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    if (name !== undefined) category.name = name;
    if (color !== undefined) category.color = color;
    if (description !== undefined) category.description = description;

    await category.save();

    const data = {
      ...category.toObject(),
      id: category._id.toString()
    };

    res.status(200).json({ data });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

// DELETE /api/categories/:id ? delete category
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await CategoryModel.findByIdAndDelete(id);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};
