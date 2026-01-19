import Task from "../Model/Task.js";
import Employee from "../Model/Employee.js";
import { notifyTaskAssigned, notifyTaskStatusChange } from "../Utils/emailNotifications.js";
import { logTaskAction } from "../Utils/auditLogger.js";
import { getFileInfo } from "../Middleware/fileUpload.js";
import { createNotification, createBulkNotifications } from "./notificationController.js";

// Get all tasks (filtered by department and role)
export const getAllTasks = async (req, res) => {
  try {
    const { status, department, assignedTo, priority, startDate, endDate } = req.query;
    const filter = { isActive: true };

    const roleName = req.user.role?.name || req.user.role;

    // Role-based filtering
    if (roleName === "teamLead") {
      // For teamLead, filter by departments they are leading
      const currentEmployee = await Employee.findById(req.user._id)
        .populate("leadingDepartments", "_id");
      
      if (currentEmployee && currentEmployee.leadingDepartments?.length > 0) {
        const leadingDeptIds = currentEmployee.leadingDepartments.map(d => d._id);
        filter.department = { $in: leadingDeptIds };
      } else {
        // If no leading departments, only show their own department's tasks
        filter.department = req.user.department?._id || req.user.department;
      }
    } else if (roleName !== "superAdmin" && roleName !== "attendanceDepartment") {
      // For regular employees, only show their department's tasks
      filter.department = req.user.department?._id || req.user.department;
    }
    // superAdmin and attendanceDepartment can see all tasks

    if (status) filter.status = status;
    if (department) filter.department = department; // Allow override by query param
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

// Get tasks for employee's department (all can view, only assigned can update)
export const getMyTasks = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const userDepartment = req.user.department?._id || req.user.department;

    // Get all tasks from user's department
    const tasks = await Task.find({
      department: userDepartment,
      isActive: true,
    })
      .populate("assignedBy", "name email employeeId")
      .populate("department", "name")
      .populate("assignedTo", "name employeeId")
      .sort({ dueDate: 1 });

    // Add canUpdate flag for each task
    const tasksWithPermissions = tasks.map(task => {
      const taskObj = task.toObject();
      // User can update if they are one of the assigned employees
      taskObj.canUpdate = task.assignedTo.some(emp => emp._id.toString() === userId);
      taskObj.isAssignedToMe = taskObj.canUpdate;
      return taskObj;
    });

    res.status(200).json({
      success: true,
      count: tasksWithPermissions.length,
      data: tasksWithPermissions,
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
    const { assignedTo, department, ...otherData } = req.body;
    
    // Ensure assignedTo is an array
    const assignees = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    
    if (assignees.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one employee must be assigned",
      });
    }

    // Verify all assignees exist
    const employees = await Employee.find({ _id: { $in: assignees } });
    if (employees.length !== assignees.length) {
      return res.status(404).json({
        success: false,
        message: "One or more employees not found",
      });
    }

    const taskData = {
      ...otherData,
      assignedTo: assignees,
      department: department || employees[0].department,
      assignedBy: req.user._id,
    };

    // Handle file attachments if uploaded
    if (req.files && req.files.length > 0) {
      taskData.attachments = req.files.map((file) => {
        const fileInfo = getFileInfo(file);
        return {
          url: fileInfo.path,
          originalName: fileInfo.originalName,
          uploadedBy: req.user._id,
          uploadedAt: new Date(),
        };
      });
    }

    const task = await Task.create(taskData);

    const populatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name employeeId email")
      .populate("assignedBy", "name email")
      .populate("department", "name");

    // Send email notifications to all assignees
    for (const emp of employees) {
      if (emp.email) {
        notifyTaskAssigned(emp, populatedTask, req.user).catch((err) =>
          console.error("Email notification failed:", err)
        );
      }
    }

    // Send in-app notifications to assigned employees
    try {
      await createBulkNotifications({
        recipients: assignees,
        type: "task_assigned",
        title: "New Task Assigned",
        message: `${req.user.name} assigned you a task: ${populatedTask.title}`,
        data: {
          referenceId: populatedTask._id,
          referenceType: "Task",
          extra: { priority: populatedTask.priority, dueDate: populatedTask.dueDate },
        },
        sender: req.user._id,
      });
    } catch (notifError) {
      console.error("Error creating task notification:", notifError);
    }

    // Log the action
    await logTaskAction(req, "CREATE", populatedTask);

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

// Update task status (Only assigned employees can update status)
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

    // Check if user is one of the assigned employees
    const employeeId = req.user._id.toString();
    const isAssigned = task.assignedTo.some(id => id.toString() === employeeId);
    const roleName = req.user.role?.name || req.user.role;
    const isTeamLeadOrAbove = ["superAdmin", "teamLead"].includes(roleName);

    if (!isAssigned && !isTeamLeadOrAbove) {
      return res.status(403).json({
        success: false,
        message: "Only assigned employees or team leads can update task status",
      });
    }

    task.status = status;
    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name employeeId email")
      .populate("assignedBy", "name email")
      .populate("department", "name");

    // Notify task creator about status change
    try {
      if (updatedTask.assignedBy && updatedTask.assignedBy._id.toString() !== req.user._id.toString()) {
        await createNotification({
          recipient: updatedTask.assignedBy._id,
          type: "task_status_changed",
          title: "Task Status Updated",
          message: `${req.user.name} changed task "${updatedTask.title}" status to ${status}`,
          data: {
            referenceId: updatedTask._id,
            referenceType: "Task",
            extra: { status },
          },
          sender: req.user._id,
        });
      }
    } catch (notifError) {
      console.error("Error creating task status notification:", notifError);
    }

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
      .populate("comments.employee", "name employeeId");

    // Notify task creator (assignedBy) and all assigned employees about new comment
    try {
      const recipientsToNotify = new Set();
      
      // Add task creator (assignedBy) if not the commenter
      if (task.assignedBy && task.assignedBy.toString() !== req.user._id.toString()) {
        recipientsToNotify.add(task.assignedBy.toString());
      }
      
      // Add all assigned employees if not the commenter
      if (task.assignedTo && task.assignedTo.length > 0) {
        task.assignedTo.forEach(employeeId => {
          if (employeeId.toString() !== req.user._id.toString()) {
            recipientsToNotify.add(employeeId.toString());
          }
        });
      }
      
      if (recipientsToNotify.size > 0) {
        await createBulkNotifications({
          recipients: Array.from(recipientsToNotify),
          type: "task_comment",
          title: "New Comment on Task",
          message: `${req.user.name} commented on task: ${task.title}`,
          referenceId: task._id,
          referenceType: "Task",
          sender: req.user._id,
        });
      }
    } catch (notifError) {
      console.error("Error creating task comment notification:", notifError);
    }

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
