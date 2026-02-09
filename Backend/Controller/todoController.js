import Todo from "../Model/Todo.js";
import { logSystemAction } from "../Utils/auditLogger.js";

// Get all personal notes for the current user
export const getMyTodos = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { user: req.user._id };

    if (search) {
      filter.description = { $regex: search, $options: "i" };
    }

    const todos = await Todo.find(filter).sort({ 
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

// Get note by ID
export const getTodoById = async (req, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      user: req.user._id, // Ensure user can only access their own todos
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
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

// Create a new note
export const createTodo = async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Description is required",
      });
    }

    const todo = await Todo.create({
      user: req.user._id,
      description: description.trim(),
      status: "pending",
    });

    // Audit log
    await logSystemAction(req, "CREATE", todo, {
      after: { description: description.trim().slice(0, 50) }
    }, `Note created`);

    res.status(201).json({
      success: true,
      message: "Note created successfully",
      data: todo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update note
export const updateTodo = async (req, res) => {
  try {
    const { description } = req.body;

    const todo = await Todo.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    if (description !== undefined && description.trim()) {
      todo.description = description.trim();
    }

    await todo.save();

    // Audit log
    await logSystemAction(req, "UPDATE", todo, {
      after: { description: description?.slice(0, 50) }
    }, `Note updated`);

    res.status(200).json({
      success: true,
      message: "Note updated successfully",
      data: todo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete note
export const deleteTodo = async (req, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    await Todo.findByIdAndDelete(req.params.id);

    // Audit log
    await logSystemAction(req, "DELETE", todo, {
      before: { description: todo.description?.slice(0, 50) }
    }, `Note deleted`);

    res.status(200).json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Toggle note status (quick action)
export const toggleTodoStatus = async (req, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
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
    }, `Note marked as ${todo.status}`);

    res.status(200).json({
      success: true,
      message: "Note status updated",
      data: todo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

