import Task from "../Model/Task.js";
import Employee from "../Model/Employee.js";

// Get all tasks (filtered by department and role)
export const getAllTasks = async (req, res) => {
  try {
    const { status, department, assignedTo, priority, startDate, endDate } = req.query;
    const filter = { isActive: true };

    // Role-based filtering
    const userType = req.user.userType;
    const roleName = req.user.role?.name;

    // If not superAdmin, filter by user's department
    if (roleName !== "superAdmin") {
      if (userType === "employee") {
        // For employees/teamLeads, filter by their department
        filter.department = req.user.department?._id || req.user.department;
      } else if (userType === "user") {
        // For admin users (attendanceDepartment), show all tasks
        // They can filter by department using the query params
      }
    }

    if (status) filter.status = status;
    if (department) filter.department = department;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (priority) filter.priority = priority;
    
    if (startDate || endDate) {
      filter.dueDate = {};
      if (startDate) filter.dueDate.$gte = new Date(startDate);
      if (endDate) filter.dueDate.$lte = new Date(endDate);
    }

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name employeeId email position")
      .populate("assignedBy", "name email employeeId")
      .populate("department", "name code")
      .populate("comments.user", "name")
      .populate("comments.employee", "name employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    console.error("Error in getAllTasks:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get tasks for employee's department (all members can view, only assignee can update)
export const getMyTasks = async (req, res) => {
  try {
    const userType = req.user.userType;
    
    if (userType !== "employee") {
      return res.status(400).json({
        success: false,
        message: "Only employees can view their tasks",
      });
    }

    // Get all tasks from employee's department
    const tasks = await Task.find({
      department: req.user.department,
      isActive: true,
    })
      .populate("assignedBy", "name email employeeId")
      .populate("department", "name")
      .populate("assignedTo", "name employeeId")
      .sort({ dueDate: 1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    console.error("Error in getMyTasks:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get task by ID
export const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignedTo", "name employeeId email position department")
      .populate("assignedBy", "name email")
      .populate("department", "name code")
      .populate("comments.user", "name")
      .populate("comments.employee", "name employeeId");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create new task (Team leads and above)
export const createTask = async (req, res) => {
  try {
    const taskData = {
      ...req.body,
      assignedBy: req.user._id,
    };

    // Get employee details to set department
    const employee = await Employee.findById(req.body.assignedTo);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    taskData.department = employee.department;

    const task = await Task.create(taskData);

    const populatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name employeeId email")
      .populate("assignedBy", "name email")
      .populate("department", "name");

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: populatedTask,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update task status (Employees can update their own task status)
export const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check if user is the assigned employee
    const employeeId = req.user._id;

    if (task.assignedTo.toString() !== employeeId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own tasks",
      });
    }

    task.status = status;
    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name employeeId email")
      .populate("assignedBy", "name email")
      .populate("department", "name");

    res.status(200).json({
      success: true,
      message: "Task status updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update task (Team leads and above)
export const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate("assignedTo", "name employeeId email")
      .populate("assignedBy", "name email")
      .populate("department", "name");

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add comment to task
export const addComment = async (req, res) => {
  try {
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: "Comment is required",
      });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const commentData = {
      comment,
      employee: req.user._id, // All users are now employees
    };

    task.comments.push(commentData);
    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name employeeId email")
      .populate("assignedBy", "name email")
      .populate("department", "name")
      .populate("comments.user", "name")
      .populate("comments.employee", "name employeeId");

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: populatedTask,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete task (soft delete)
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    await Task.findByIdAndUpdate(req.params.id, {
      isActive: false,
    });

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get task statistics
export const getTaskStats = async (req, res) => {
  try {
    const { department, startDate, endDate } = req.query;
    const filter = { isActive: true };

    // Role-based filtering
    const userType = req.user.userType;
    const roleName = req.user.role?.name;

    // If not superAdmin, filter by user's department
    if (roleName !== "superAdmin") {
      if (userType === "employee") {
        // For employees/teamLeads, filter by their department
        filter.department = req.user.department?._id || req.user.department;
      }
    }

    if (department) filter.department = department;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const stats = await Task.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const formattedStats = {
      total: 0,
      todo: 0,
      inProgress: 0,
      completed: 0,
    };

    stats.forEach((stat) => {
      formattedStats.total += stat.count;
      if (stat._id === "todo") formattedStats.todo = stat.count;
      if (stat._id === "in-progress") formattedStats.inProgress = stat.count;
      if (stat._id === "completed") formattedStats.completed = stat.count;
    });

    // Get overdue tasks
    const overdueTasks = await Task.countDocuments({
      ...filter,
      status: { $ne: "completed" },
      dueDate: { $lt: new Date() },
    });

    formattedStats.overdue = overdueTasks;

    res.status(200).json({
      success: true,
      data: formattedStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get task report (daily/weekly/monthly)
export const getTaskReport = async (req, res) => {
  try {
    const { period, department, employee } = req.query;
    const filter = { isActive: true };

    // Role-based filtering - all users are now employees with roles
    if (req.user.role.name !== "admin") {
      filter.department = req.user.department;
    }

    if (department) filter.department = department;
    if (employee) filter.assignedTo = employee;

    // Set date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case "daily":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "weekly":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "monthly":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
    }

    filter.createdAt = { $gte: startDate };

    const tasks = await Task.find(filter)
      .populate("assignedTo", "name employeeId")
      .populate("department", "name")
      .sort({ createdAt: -1 });

    // Group by employee
    const employeeStats = {};
    tasks.forEach((task) => {
      const empId = task.assignedTo._id.toString();
      if (!employeeStats[empId]) {
        employeeStats[empId] = {
          employee: task.assignedTo,
          total: 0,
          todo: 0,
          inProgress: 0,
          completed: 0,
          overdue: 0,
        };
      }
      
      employeeStats[empId].total++;
      employeeStats[empId][task.status === "in-progress" ? "inProgress" : task.status]++;
      
      if (task.status !== "completed" && task.dueDate < new Date()) {
        employeeStats[empId].overdue++;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        period,
        startDate,
        endDate: new Date(),
        tasks,
        employeeStats: Object.values(employeeStats),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
