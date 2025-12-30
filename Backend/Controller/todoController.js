import Todo from "../Model/Todo.js";
import { logSystemAction } from "../Utils/auditLogger.js";

// Get all todos for the current user
export const getMyTodos = async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    const filter = { user: req.user._id };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const todos = await Todo.find(filter).sort({ 
      priority: -1, // High priority first
      dueDate: 1,   // Earlier due dates first
      createdAt: -1 
    });

    res.status(200).json({
      success: true,
      count: todos.length,
      data: todos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get todo by ID
export const getTodoById = async (req, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      user: req.user._id, // Ensure user can only access their own todos
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Todo not found",
      });
    }

    res.status(200).json({
      success: true,
      data: todo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create a new todo
export const createTodo = async (req, res) => {
  try {
    const { title, description, priority, dueDate, tags, status } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const todo = await Todo.create({
      user: req.user._id,
      title,
      description: description || "",
      priority: priority || "medium",
      status: status || "pending",
      dueDate: dueDate || null,
      tags: tags || [],
    });

    // Audit log
    await logSystemAction(req, "CREATE", todo, {
      after: { title, status: todo.status, priority: todo.priority }
    }, `Todo created: ${title}`);

    res.status(201).json({
      success: true,
      message: "Todo created successfully",
      data: todo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update todo
export const updateTodo = async (req, res) => {
  try {
    const { title, description, priority, status, dueDate, tags } = req.body;

    const todo = await Todo.findOne({
      _id: req.params.id,
      user: req.user._id, // Ensure user can only update their own todos
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Todo not found",
      });
    }

    const oldStatus = todo.status;

    if (title) todo.title = title;
    if (description !== undefined) todo.description = description;
    if (priority) todo.priority = priority;
    if (status) {
      todo.status = status;
      // Set completedAt if status is completed
      if (status === "completed" && !todo.completedAt) {
        todo.completedAt = new Date();
      } else if (status !== "completed") {
        todo.completedAt = null;
      }
    }
    if (dueDate !== undefined) todo.dueDate = dueDate;
    if (tags !== undefined) todo.tags = tags;

    await todo.save();

    // Audit log
    await logSystemAction(req, "UPDATE", todo, {
      before: { status: oldStatus, title: todo.title },
      after: { status: todo.status, title: todo.title, priority: todo.priority }
    }, `Todo updated: ${todo.title}`);

    res.status(200).json({
      success: true,
      message: "Todo updated successfully",
      data: todo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete todo
export const deleteTodo = async (req, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      user: req.user._id, // Ensure user can only delete their own todos
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Todo not found",
      });
    }

    const todoTitle = todo.title;
    await Todo.findByIdAndDelete(req.params.id);

    // Audit log
    await logSystemAction(req, "DELETE", todo, {
      before: { title: todoTitle, status: todo.status }
    }, `Todo deleted: ${todoTitle}`);

    res.status(200).json({
      success: true,
      message: "Todo deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Toggle todo status (quick action)
export const toggleTodoStatus = async (req, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Todo not found",
      });
    }

    const oldStatus = todo.status;
    
    if (todo.status === "completed") {
      todo.status = "pending";
      todo.completedAt = null;
    } else {
      todo.status = "completed";
      todo.completedAt = new Date();
    }

    await todo.save();

    // Audit log
    await logSystemAction(req, "UPDATE", todo, {
      before: { status: oldStatus },
      after: { status: todo.status }
    }, `Todo status toggled: ${todo.title}`);

    res.status(200).json({
      success: true,
      message: "Todo status updated",
      data: todo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

